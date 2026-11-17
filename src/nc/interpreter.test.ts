// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runProgram, workPosition } from './interpreter';
import type { InterpreterOptions, MotionSegment, Vec3, WorkSystem } from './types';

function run(source: string, options?: InterpreterOptions) {
  const result = runProgram(source, options);
  expect(result.alarms).toEqual([]);
  return result;
}
function arc(segment: MotionSegment | undefined) {
  if (!segment || !('center' in segment)) throw new Error('Expected an arc');
  return segment;
}
const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

describe('linear motion and modal state', () => {
  it('starts in metric XY absolute mode with G54, no selected motion and no tool', () => {
    expect(run('').state).toMatchObject({ position: v(), plane: 17, units: 'mm', distance: 'absolute', workSystem: 54, motion: null, tool: null });
  });
  it('retains motion and feed across blocks and preserves omitted axes', () => {
    const result = run('G21 G17 G90 G94 G40\nG0 X10 Y20 Z5\nG1 X15 F120\nY25\nG0 Z10');
    expect(result.segments.map(s => [s.kind, s.to, s.feed])).toEqual([
      ['rapid', v(10, 20, 5), null], ['linear', v(15, 20, 5), 120],
      ['linear', v(15, 25, 5), 120], ['rapid', v(15, 25, 10), null],
    ]);
    expect(result.segments[2]?.from).toEqual(v(15, 20, 5));
  });
  it('switches G90/G91 before applying coordinates regardless of word order', () => {
    const result = run('X10 Y20 G0\nX-2 Y3 G91\nZ4\nG90 X1');
    expect(result.state.position).toEqual(v(1, 23, 4));
    expect(result.state.distance).toBe('absolute');
  });
  it('does not create motion for feed/mode-only blocks or identical linear targets', () => {
    expect(run('G0\nF200\nG1\nX0 Y0 Z0').segments).toHaveLength(0);
  });
  it('retains tool selection, spindle and coolant state', () => {
    const result = run('T2\nM6 S1600 M3 M8\nG0 X1');
    expect(result.state).toMatchObject({ selectedTool: 2, tool: 2, speed: 1600, spindle: 'cw', coolant: true });
    expect(result.segments[0]?.tool).toBe(2);
    expect(run('T3 M6 M4 M8\nM5 M9').state).toMatchObject({ tool: 3, spindle: 'off', coolant: false });
  });
  it.each(['M2', 'M30'])('stops after %s and turns spindle/coolant off', end => {
    const result = run(`M3 M8\nG0 X1 ${end}\nG0 X99`);
    expect(result.state).toMatchObject({ position: v(1), ended: true, spindle: 'off', coolant: false });
    expect(result.segments).toHaveLength(1);
  });
  it('keeps physical source line numbers rather than N numbers', () => {
    expect(run('%\nO1\n(comment)\nN999 G0 X1').segments[0]?.line).toBe(4);
  });
  it('does not mutate the input position or earlier segment snapshots', () => {
    const initialPosition = v(1, 2, 3);
    const result = run('G0 X4\nX5', { initialPosition });
    result.state.position.x = 100;
    expect(initialPosition).toEqual(v(1, 2, 3));
    expect(result.segments[0]?.to).toEqual(v(4, 2, 3));
    expect(result.segments[1]?.to).toEqual(v(5, 2, 3));
  });
});

describe('work coordinates and tool-length compensation', () => {
  it.each([54, 55, 56, 57, 58, 59] as WorkSystem[])('applies G%i in all three axes', code => {
    const result = run(`G${code} G0 X1 Y2 Z3`, { workOffsets: { [code]: v(100, 200, 300) } });
    expect(result.state.position).toEqual(v(101, 202, 303));
    expect(result.segments[0]?.workSystem).toBe(code);
  });
  it('changes WCS without moving and rebases omitted coordinates', () => {
    const options = { workOffsets: { 54: v(100, 200, 300), 55: v(500, 600, 700) } };
    const changed = run('G0 X1 Y2 Z3\nG55', options);
    expect(changed.segments).toHaveLength(1);
    expect(changed.state.position).toEqual(v(101, 202, 303));
    expect(workPosition(changed.state, options)).toEqual(v(-399, -398, -397));
    expect(run('G0 X1 Y2 Z3\nG55\nX10', options).state.position).toEqual(v(510, 202, 303));
  });
  it('does not add WCS translation to incremental displacement', () => {
    expect(run('G55 G91 G0 X2 Y-3 Z4', { initialPosition: v(10, 20, 30), workOffsets: { 55: v(100, 100, 100) } }).state.position).toEqual(v(12, 17, 34));
  });
  it('adds G43 H to programmed absolute Z and cancels with G49', () => {
    const options = { workOffsets: { 54: v(10, 20, 30) }, toolLengths: { 2: 50 } };
    const result = run('G43 H2 G0 X1 Y2 Z5\nG49\nZ5', options);
    expect(result.segments.map(s => s.to)).toEqual([v(11, 22, 85), v(11, 22, 35)]);
    expect(result.segments.map(s => s.lengthOffset)).toEqual([2, null]);
    expect(workPosition(result.state, options)).toEqual(v(1, 2, 5));
  });
  it('activates or changes H without implicit movement; explicit Z uses the new H', () => {
    const options = { toolLengths: { 1: 20, 2: 40 } };
    const result = run('G0 Z10\nG43 H1\nH2\nG43\nG91 Z5', options);
    expect(result.segments.map(s => s.to.z)).toEqual([10, 15]);
    expect(workPosition(result.state, options).z).toBe(-25);
  });
  it('applies offsets to arcs and drilling planes', () => {
    const options = { workOffsets: { 56: v(100, 200, 300) }, toolLengths: { 1: 50 } };
    const result = run('G56 G43 H1 G0 X0 Y0 Z10\nG3 X10 Y10 I0 J10 F100\nG99 G81 X5 Y5 Z-5 R2', options);
    expect(arc(result.segments[1]).center).toEqual(v(100, 210, 360));
    expect(result.segments.filter(s => s.kind === 'linear').at(-1)?.to).toEqual(v(105, 205, 345));
    expect(result.state.position.z).toBe(352);
  });
});

describe('G17 circular and helical interpolation', () => {
  it.each([
    ['G3 X10 Y10 I0 J10', 'arcCCW', v(0, 10)],
    ['G2 X10 Y-10 I0 J-10', 'arcCW', v(0, -10)],
  ])('calculates a quarter circle: %s', (code, kind, center) => {
    const segment = arc(run(`G0 X0 Y0\n${code} F100`).segments[0]);
    expect(segment.kind).toBe(kind);
    expect(segment.center).toEqual(center);
    expect(segment.radius).toBe(10);
    expect(segment.sweep).toBeCloseTo(Math.PI / 2);
  });
  it.each([2, 3])('accepts an I/J full circle in G%i without axis words', code => {
    const segment = arc(run(`G${code} I5 F80`).segments[0]);
    expect(segment.from).toEqual(segment.to);
    expect(segment.sweep).toBeCloseTo(2 * Math.PI);
    expect(segment.radius).toBe(5);
  });
  it.each([2, 3])('selects minor and major R arcs in G%i', code => {
    const minor = arc(run(`G${code} X10 R10 F100`).segments[0]);
    const major = arc(run(`G${code} X10 R-10 F100`).segments[0]);
    expect(minor.sweep).toBeCloseTo(Math.PI / 3);
    expect(major.sweep).toBeCloseTo(5 * Math.PI / 3);
    expect(minor.center.x).toBe(5);
    expect(minor.center.y).toBeCloseTo(code === 2 ? -Math.sqrt(75) : Math.sqrt(75));
  });
  it.each([2, 3])('accepts exact semicircles in G%i', code => {
    expect(arc(run(`G${code} X10 R5 F100`).segments[0]).sweep).toBeCloseTo(Math.PI);
  });
  it('uses incremental I/J even with absolute endpoints and retains arc motion', () => {
    const result = run('G0 X10 Y10\nG3 X20 Y20 I0 J10 F100\nX10 Y30 I-10 J0');
    expect(arc(result.segments[1]).center).toEqual(v(10, 20));
    expect(arc(result.segments[2]).center).toEqual(v(10, 20));
  });
  it('supports incremental endpoints and helical Z interpolation', () => {
    const result = run('G0 X10 Y10 Z5\nG91 G3 X10 Y10 Z-2 I0 J10 F100');
    const segment = arc(result.segments[1]);
    expect(segment.to).toEqual(v(20, 20, 3));
    expect(segment.center).toEqual(v(10, 20, 5));
    expect(segment.sweep).toBeCloseTo(Math.PI / 2);
  });
  it.each([
    ['G2 X10 F100', 'arcDefinition'], ['G3 X10 I5 R5 F100', 'arcDefinition'],
    ['G3 X10 I0 J0 F100', 'arcGeometry'], ['G3 X10 Y10 I5 F100', 'arcGeometry'],
    ['G2 X10 R2 F100', 'arcGeometry'], ['G3 R5 F100', 'arcGeometry'],
    ['G3 X10 R0 F100', 'arcGeometry'], ['G2 X1 I1', 'missingFeed'],
  ])('alarms for invalid arc %s', (source, code) => {
    expect(runProgram(source).alarms[0]?.code).toBe(code);
  });
  it('does not retain I/J or R across arc blocks', () => {
    const result = runProgram('G3 X10 Y10 I0 J10 F100\nX20 Y20');
    expect(result.alarms[0]).toMatchObject({ line: 2, code: 'arcDefinition' });
  });
});

describe('G81 and G83 fixed cycles', () => {
  it('expands G81 approach, feed and G98 return and repeats at the next XY', () => {
    const result = run('G0 Z10\nG98 G81 X5 Y6 Z-4 R2 F100\nX15');
    expect(result.segments.slice(1, 5).map(s => [s.kind, s.to])).toEqual([
      ['rapid', v(5, 6, 10)], ['rapid', v(5, 6, 2)],
      ['linear', v(5, 6, -4)], ['rapid', v(5, 6, 10)],
    ]);
    expect(result.segments.filter(s => s.kind === 'linear').map(s => s.to)).toEqual([v(5, 6, -4), v(15, 6, -4)]);
    expect(result.state.position).toEqual(v(15, 6, 10));
  });
  it('supports G99 and later G98 using the original initial plane', () => {
    const result = run('G0 Z10\nG99 G81 Z-5 R2 F100\nG98\nX10');
    expect(result.segments.filter(s => s.kind === 'linear')).toHaveLength(2);
    expect(result.state.position).toEqual(v(10, 0, 10));
  });
  it('raises to R before lateral positioning if starting below R', () => {
    const result = run('G81 X20 Y10 R2 Z-5 F100');
    expect(result.segments[0]).toMatchObject({ kind: 'rapid', from: v(), to: v(0, 0, 2) });
    expect(result.segments[1]?.to).toEqual(v(20, 10, 2));
    expect(result.state.position.z).toBe(2);
  });
  it('pecks to exact depth, fully retracts to R and re-enters above the last bottom', () => {
    const result = run('G0 Z10\nG99 G83 X5 Z-8 R2 Q3 F100');
    expect(result.segments.filter(s => s.kind === 'linear').map(s => [s.from.z, s.to.z])).toEqual([
      [2, -1], [-.5, -4], [-3.5, -7], [-6.5, -8],
    ]);
    expect(result.segments.filter(s => s.kind === 'rapid').map(s => s.to.z)).toEqual([10, 10, 2, 2, -.5, 2, -3.5, 2, -6.5, 2]);
    expect(result.state.position).toEqual(v(5, 0, 2));
  });
  it('allows a single peck larger than the depth and clamps large re-entry clearance', () => {
    expect(run('G83 R2 Z-3 Q100 F100').segments.filter(s => s.kind === 'linear')).toHaveLength(1);
    const result = run('G83 R2 Z-3 Q2 F100', { peckClearance: 100 });
    expect(result.segments.filter(s => s.kind === 'linear').map(s => s.from.z)).toEqual([2, 2, 2]);
  });
  it('retains R, Z, Q and feed across G83 repetitions', () => {
    const result = run('G0 Z10\nG99 G83 X5 R2 Z-4 Q2 F100\nX10');
    const feeds = result.segments.filter(s => s.kind === 'linear');
    expect(feeds.map(s => s.to.z)).toEqual([0, -2, -4, 0, -2, -4]);
    expect(feeds.every(s => s.feed === 100)).toBe(true);
    expect(result.state.position.x).toBe(10);
  });
  it('uses G91 R relative to the initial plane and Z relative to R on every hole', () => {
    const result = run('G0 Z10\nG91 G99 G81 X5 R-8 Z-6 F100\nX5');
    expect(result.segments.filter(s => s.kind === 'linear').map(s => s.to)).toEqual([v(5, 0, -4), v(10, 0, -4)]);
    expect(result.state.position).toEqual(v(10, 0, 2));
  });
  it('updates incremental R while preserving sticky depth relative to R', () => {
    const result = run('G0 Z10\nG91 G99 G81 R-8 Z-6 F100\nX5 R-7');
    expect(result.segments.filter(s => s.kind === 'linear').map(s => s.to.z)).toEqual([-4, -3]);
    expect(result.state.position.z).toBe(3);
  });
  it('updates Z and feed in an active cycle without losing R', () => {
    const result = run('G81 R2 Z-4 F100\nF80\nX10 Z-6');
    expect(result.segments.filter(s => s.kind === 'linear').map(s => [s.to.z, s.feed])).toEqual([[-4, 100], [-6, 80]]);
  });
  it.each(['G80\nG0', 'G0', 'G1 F100'])('cancels a cycle with %s', cancel => {
    const result = run(`G81 R2 Z-4 F100\n${cancel} X10`);
    expect(result.state.cycle).toBeNull();
    expect(result.segments.at(-1)?.to).toEqual(v(10, 0, 2));
  });
  it('G80 clears sticky cycle values and requires a new motion mode', () => {
    expect(runProgram('G81 R2 Z-4 F100\nG80\nX10').alarms[0]?.code).toBe('missingMotion');
    expect(runProgram('G81 R2 Z-4 F100\nG80\nG81 X10').alarms[0]?.code).toBe('cycleParameters');
  });
  it.each(['G55', 'G91', 'G43 H1'])('requires G80 before frame change %s in an active cycle', change => {
    expect(runProgram(`G81 R2 Z-4 F100\n${change}`).alarms[0]?.code).toBe('cycleFrameChange');
    expect(runProgram(`G81 R2 Z-4 F100\nG80 ${change}`).alarms).toEqual([]);
  });
  it.each([
    'G81 Z-4 F100', 'G81 R2 F100', 'G81 R2 Z2 F100', 'G81 R2 Z3 F100',
    'G83 R2 Z-5 F100', 'G83 R2 Z-5 Q0 F100', 'G83 R2 Z-5 Q-1 F100',
  ])('alarms for invalid cycle %s', source => {
    expect(runProgram(source).alarms[0]?.code).toBe('cycleParameters');
  });
  it('requires feed for a cycle', () => {
    expect(runProgram('G81 R2 Z-5').alarms[0]?.code).toBe('missingFeed');
  });
});

describe('alarms, atomic blocks and resource bounds', () => {
  it.each([
    ['G999', 'unsupportedCode'], ['G18', 'unsupportedCode'], ['G20', 'unsupportedCode'],
    ['G41', 'unsupportedCode'], ['G82', 'unsupportedCode'], ['G84', 'unsupportedCode'],
    ['G28', 'unsupportedCode'], ['M0', 'unsupportedCode'], ['M1', 'unsupportedCode'],
    ['G1.5', 'unsupportedCode'], ['M99', 'unsupportedCode'],
    ['G0 G1 X1', 'modalConflict'], ['G90 G91', 'modalConflict'],
    ['G54 G55', 'modalConflict'], ['M3 M5', 'modalConflict'], ['M8 M9', 'modalConflict'],
    ['G43 G49 H1', 'modalConflict'], ['G0 G0', 'modalConflict'],
    ['X1', 'missingMotion'], ['G1 X1', 'missingFeed'], ['G1 X1 F0', 'missingFeed'],
    ['G0 X1 F-1', 'invalidValue'], ['S-1', 'invalidValue'], ['T1.5', 'invalidValue'],
    ['N-1', 'invalidValue'], ['O1.5', 'invalidValue'], ['H0 G43', 'invalidValue'],
    ['H1.5 G43', 'invalidValue'], ['G43 H2', 'missingOffset'], ['G43', 'missingOffset'],
    ['G49 H1', 'unexpectedWord'], ['H1', 'unexpectedWord'],
    ['M6', 'invalidValue'], ['T0 M6', 'invalidValue'],
    ['G0 X1000001', 'invalidValue'], ['G0 X1 I2', 'unexpectedWord'],
    ['G0 J2', 'unexpectedWord'], ['G1 R2 F100', 'unexpectedWord'],
    ['G81 R2 Z-4 Q1 F100', 'unexpectedWord'],
  ])('rejects %s as %s', (source, code) => {
    expect(runProgram(source).alarms[0]).toMatchObject({ code, line: 1 });
  });
  it('rolls back the entire failing block and stops later execution', () => {
    const result = runProgram('G0 X10\nG55 G1 X20 F0 M3\nG0 X99');
    expect(result.alarms[0]).toMatchObject({ code: 'missingFeed', line: 2 });
    expect(result.state).toMatchObject({ position: v(10), workSystem: 54, motion: 0, spindle: 'off' });
    expect(result.segments).toHaveLength(1);
  });
  it('never runs syntactically malformed programs, even before the error', () => {
    const result = runProgram('G0 X10\nG1 X?');
    expect(result.segments).toHaveLength(0);
    expect(result.state.position).toEqual(v());
  });
  it('guards very small pecks without emitting partial cycle motion', () => {
    const result = runProgram('G0 X1\nG83 X20 R2 Z-10 Q0.00001 F100');
    expect(result.alarms[0]).toMatchObject({ code: 'limit', line: 2 });
    expect(result.segments).toHaveLength(1);
    expect(result.state.position).toEqual(v(1));
  });
  it('bounds the total motion expansion across repeated cycles', () => {
    const result = runProgram('G99 G83 R1 Z-9 Q1 F100\n' + 'X1\n'.repeat(1000));
    expect(result.alarms[0]?.code).toBe('limit');
    expect(result.segments.length).toBeLessThanOrEqual(20000);
  });
  it('rejects computed coordinates outside the supported range', () => {
    expect(runProgram('G0 X1000000\nG91 X1').alarms[0]?.code).toBe('invalidValue');
  });
  it.each<InterpreterOptions>([
    { initialPosition: v(NaN) }, { workOffsets: { 54: v(Infinity) } },
    { toolLengths: { 1: -1 } }, { toolLengths: { 1.5: 10 } },
    { peckClearance: 0 }, { peckClearance: NaN },
  ])('rejects invalid interpreter configuration %j', options => {
    expect(runProgram('G0 X1', options).alarms[0]).toMatchObject({ code: 'configuration', line: 0 });
  });
  it('returns independent fresh state on every run', () => {
    run('G91 G0 X5 F10 M3');
    expect(run('G0 X1').state).toMatchObject({ distance: 'absolute', feed: 0, spindle: 'off', position: v(1) });
  });
});
