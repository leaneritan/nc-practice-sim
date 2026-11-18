// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseProgram } from './parser';
import { resumeProgram, runProgram } from './interpreter';
import type { InterpreterOptions, RunResult } from './types';
import { en } from '../i18n/en';

function run(source: string, options: InterpreterOptions = {}) {
  const result = runProgram(source, options);
  expect(result.alarms).toEqual([]);
  return result;
}
const point = (x = 0, y = 0, z = 0) => ({ x, y, z });

describe('decimal spelling, warnings and strict input', () => {
  it('retains numeric spelling and accepts D and P words without rescaling them', () => {
    const parsed = parseProgram('n20 g82 x010 y10. z-02000 r+3000 p500 d02 f100 s800 h1 t1 q500', { strictDecimals: true });
    expect(parsed.alarms).toEqual([]);
    expect(parsed.blocks[0]?.words).toContainEqual({ letter: 'X', raw: '010', value: .01 });
    expect(parsed.blocks[0]?.words).toContainEqual({ letter: 'Y', raw: '10.', value: 10 });
    for (const [letter, value] of [['P', 500], ['D', 2], ['F', 100], ['S', 800], ['H', 1], ['T', 1], ['N', 20]]) {
      expect(parsed.blocks[0]?.words.find(word => word.letter === letter)?.value).toBe(value);
    }
    expect(parsed.warnings.map(w => w.word)).toEqual(['X010', 'Z-02000', 'R+3000', 'Q500']);
  });
  it('warns in normal mode without changing motion and reports source lines', () => {
    const result = run('%\n(comment X10)\nN900 G0 X10 Y-20 Z0');
    expect(result.state.position).toEqual(point(10, -20, 0));
    expect(result.warnings).toEqual([
      { line: 3, word: 'X10', interpreted: 10, strictValue: .01 },
      { line: 3, word: 'Y-20', interpreted: -20, strictValue: -.02 },
      { line: 3, word: 'Z0', interpreted: 0, strictValue: 0 },
    ]);
  });
  it('distinguishes X10 from X10. and supports signed/leading-zero forms', () => {
    const result = run('G0 X10 Y10. Z-0005', { strictDecimals: true });
    expect(result.state.position).toEqual(point(.01, 10, -.005));
    expect(result.warnings[0]).toMatchObject({ interpreted: .01 });
    expect(run('G0 X.5 Y+1. Z-0.25', { strictDecimals: true }).warnings).toEqual([]);
  });
  it('scales incremental distances before motion, but never scales configured offsets', () => {
    const options = { strictDecimals: true, workOffsets: { 55: point(100, 200, 300) }, toolLengths: { 1: 50 } };
    const result = run('G55 G43 H1 G0 X10000 Y20000 Z5000\nG91 X-1000 Z2000', options);
    expect(result.state.position).toEqual(point(109, 220, 357));
  });
  it('scales I/J and signed R in arc definitions', () => {
    const result = run('G3 X10000 Y10000 I0 J10000 F100\nG2 X20000 Y20000 R10000', { strictDecimals: true });
    expect(result.segments[0]).toMatchObject({ radius: 10, to: point(10, 10), center: point(0, 10) });
    expect(result.segments[1]).toMatchObject({ radius: 10, to: point(20, 20) });
  });
  it('scales R/Z/Q in cycles while keeping dwell P in milliseconds', () => {
    const result = run('G99 G83 R2000 Z-5000 Q3000 F100\nG80\nG82 R2000 Z-3000 P1000', { strictDecimals: true });
    expect(result.segments.filter(s => s.kind === 'linear').map(s => s.to.z)).toEqual([-1, -4, -5, -3]);
    expect(result.events[0]).toMatchObject({ kind: 'dwell', durationMs: 1000, position: point(0, 0, -3) });
  });
  it('does not warn about integer words in comments, registers or non-distance values', () => {
    expect(parseProgram('(X10) G90 T1 M6 H1 D1 S100 F100 P500 N20 O10 ; Y20').warnings).toEqual([]);
  });
  it('retains warnings on an execution alarm without treating warnings as alarms', () => {
    const result = runProgram('G1 X10');
    expect(result.alarms[0]?.code).toBe('missingFeed');
    expect(result.warnings[0]?.word).toBe('X10');
  });
  it('rejects duplicate D/P and non-finite values', () => {
    expect(parseProgram('D1 D2').alarms[0]?.code).toBe('duplicateWord');
    expect(parseProgram('P100 P200').alarms[0]?.code).toBe('duplicateWord');
    expect(parseProgram(`X${'9'.repeat(400)}`, { strictDecimals: true }).alarms[0]?.code).toBe('invalidValue');
  });
});

describe('G28 intermediate point and reference return', () => {
  it('makes two rapid legs in absolute mode and returns only selected axes', () => {
    const result = run('G0 X5. Y6. Z7.\nG28 X10. Z20.', { referencePosition: point(100, 200, 300) });
    expect(result.segments.slice(1).map(s => [s.kind, s.to])).toEqual([
      ['rapid', point(10, 6, 20)], ['rapid', point(100, 6, 300)],
    ]);
    expect(result.segments.slice(1).every(s => s.line === 2)).toBe(true);
  });
  it('uses incremental intermediate points; G91 G28 Z0. skips the first leg', () => {
    const options = { initialPosition: point(5, 6, 7), referencePosition: point(100, 200, 300) };
    expect(run('G91 G28 Z0.', options).segments.map(s => s.to)).toEqual([point(5, 6, 300)]);
    expect(run('G91 G28 X2. Z3.', options).segments.map(s => s.to)).toEqual([point(7, 6, 10), point(100, 6, 300)]);
  });
  it('applies WCS/length to the intermediate point, never to the machine reference', () => {
    const result = run('G55 G43 H1 G28 X1. Z2.', {
      initialPosition: point(9, 9, 9), referencePosition: point(0, 0, 100),
      workOffsets: { 55: point(10, 20, 30) }, toolLengths: { 1: 50 },
    });
    expect(result.segments.map(s => s.to)).toEqual([point(11, 9, 82), point(0, 9, 100)]);
    expect(result.state.lengthOffset).toBe(1);
  });
  it('returns all axes if none are named, and is non-modal', () => {
    const result = run('G1 X5. F100\nG28\nX10.');
    expect(result.segments.map(s => s.kind)).toEqual(['linear', 'rapid', 'linear']);
    expect(result.segments[1]?.to).toEqual(point());
    expect(result.state.motion).toBe(1);
  });
  it('can cancel an active cycle and return home in the same block', () => {
    expect(run('G81 R2. Z-2. F100\nG80 G91 G28 Z0.').state.cycle).toBeNull();
  });
  it.each(['G0 G28 X1.', 'G81 R2. Z-2. F100\nG28', 'G2 F100\nG28 I1.'])('rejects ambiguous G28 block %s', source => {
    expect(runProgram(source).alarms).toHaveLength(1);
  });
  it('applies strict units to the intermediate point', () => {
    expect(run('G28 X1000', { strictDecimals: true }).segments.map(s => s.to.x)).toEqual([1, 0]);
  });
  it('validates the configured machine reference', () => {
    expect(runProgram('G28', { referencePosition: point(Infinity) }).alarms[0]?.code).toBe('configuration');
  });
});

describe('G82 dwell cycles and P', () => {
  it('dwells at the hole bottom before rapid retract and retains P across holes', () => {
    const result = run('G0 Z10.\nG98 G82 X5. R2. Z-5. P750 F100\nX15.');
    expect(result.events.map(e => [e.kind, e.position])).toEqual([['dwell', point(5, 0, -5)], ['dwell', point(15, 0, -5)]]);
    for (const event of result.events) {
      expect(event).toMatchObject({ durationMs: 750 });
      expect(result.segments[event.afterSegment - 1]?.kind).toBe('linear');
      expect(result.segments[event.afterSegment]?.kind).toBe('rapid');
    }
    expect(result.state.position.z).toBe(10);
  });
  it('updates P and accepts zero dwell without changing geometry', () => {
    const result = run('G99 G82 R2. Z-5. P0 F100\nX10. P100');
    expect(result.events.map(e => e.kind === 'dwell' && e.durationMs)).toEqual([0, 100]);
    expect(result.state.position).toEqual(point(10, 0, 2));
  });
  it('supports incremental cycle depths and nonzero offsets', () => {
    const result = run('G43 H1 G0 Z10.\nG91 G99 G82 X5. R-8. Z-7. P500 F100\nX5.', { workOffsets: { 54: point(0, 0, 20) }, toolLengths: { 1: 30 } });
    expect(result.events.map(e => e.position)).toEqual([point(5, 0, 45), point(10, 0, 45)]);
    expect(result.state.position.z).toBe(52);
  });
  it.each([
    ['G82 R2. Z-3. F100', 'cycleParameters'], ['G82 R2. Z-3. P-1 F100', 'invalidValue'],
    ['G82 R2. Z-3. P1.5 F100', 'invalidValue'], ['G0 X1. P500', 'unexpectedWord'],
    ['G81 R2. Z-3. P500 F100', 'unexpectedWord'],
  ])('alarms for %s', (source, code) => {
    expect(runProgram(source).alarms[0]?.code).toBe(code);
  });
  it('requires fresh P after G80, rather than reusing another cycle dwell', () => {
    expect(runProgram('G82 R2. Z-3. P100 F100\nG80\nG82 R2. Z-3.').alarms[0]?.code).toBe('cycleParameters');
  });
});

describe('G84 right-hand tapping', () => {
  it('feeds down CW and back to R CCW, then restores CW and returns G98 rapid', () => {
    const result = run('G0 Z10.\nS400 M3\nG98 G84 X5. R2. Z-8. P250 F500');
    const cutting = result.segments.filter(s => s.kind === 'linear');
    expect(cutting.map(s => [s.to.z, s.spindle, s.feed, s.speed])).toEqual([[-8, 'cw', 500, 400], [2, 'ccw', 500, 400]]);
    expect(result.events.map(e => e.kind)).toEqual(['dwell', 'spindle', 'spindle']);
    expect(result.events[1]).toMatchObject({ direction: 'ccw', position: point(5, 0, -8) });
    expect(result.events[2]).toMatchObject({ direction: 'cw', position: point(5, 0, 2) });
    expect(result.state).toMatchObject({ spindle: 'cw', position: point(5, 0, 10) });
  });
  it('G99 ends at R and repeated holes keep the pitch with no rapid pullout', () => {
    const result = run('M3 S400\nG99 G84 R2. Z-8. F500\nX10.');
    expect(result.events.filter(e => e.kind === 'dwell')).toEqual([]);
    const feed = result.segments.filter(s => s.kind === 'linear');
    expect(feed.map(s => [s.to.x, s.to.z, s.spindle])).toEqual([[0, -8, 'cw'], [0, 2, 'ccw'], [10, -8, 'cw'], [10, 2, 'ccw']]);
    expect(feed.every(s => s.feed! / s.speed === 1.25)).toBe(true);
  });
  it('supports incremental depth, compensation and sticky dwell', () => {
    const result = run('G43 H1 G0 Z10.\nM3 S400\nG91 G99 G84 X5. R-8. Z-10. P50 F500\nX5.', { toolLengths: { 1: 50 } });
    expect(result.events.filter(e => e.kind === 'dwell').map(e => e.position)).toEqual([point(5, 0, 42), point(10, 0, 42)]);
    expect(result.state.position.z).toBe(52);
  });
  it.each(['', 'M3', 'M4 S400', 'M5 S400', 'M3 S0'])('requires a running clockwise spindle: %s', prefix => {
    const result = runProgram(`${prefix}\nG84 R2. Z-8. F500`);
    expect(result.alarms[0]?.code).toBe('tappingSpindle');
    expect(result.segments).toEqual([]);
    expect(result.events).toEqual([]);
  });
  it('requires a cutting feed and validates P', () => {
    expect(runProgram('M3 S400 G84 R2. Z-8.').alarms[0]?.code).toBe('missingFeed');
    expect(runProgram('M3 S400 G84 R2. Z-8. F500 P-1').alarms[0]?.code).toBe('invalidValue');
  });
});

describe('M00 / M01 pause and continuation', () => {
  it('M00 finishes its block and pauses before later blocks, preserving state', () => {
    const paused = run('G91 G1 X2. F100 M00\nX3.\nM30\nX99.');
    expect(paused.state).toMatchObject({ paused: { code: 0, line: 1 }, position: point(2), distance: 'incremental', feed: 100, ended: false });
    expect(paused.segments).toHaveLength(1);
    const complete = resumeProgram(paused);
    expect(complete.state).toMatchObject({ paused: null, ended: true, position: point(5) });
    expect(complete.segments).toHaveLength(2);
    expect(complete.continuation).toBeNull();
    expect(paused.state.position).toEqual(point(2));
    expect(paused.segments).toHaveLength(1);
  });
  it('M01 is skipped by default but pauses with optional stop enabled', () => {
    const source = 'G0 X1.\nM1\nX2.';
    const skipped = run(source);
    expect(skipped.state.position.x).toBe(2);
    expect(skipped.events[0]).toMatchObject({ kind: 'stop', code: 1, paused: false });
    const paused = run(source, { optionalStop: true });
    expect(paused.state.position.x).toBe(1);
    expect(paused.events[0]).toMatchObject({ paused: true, afterSegment: 1 });
    expect(resumeProgram(paused).state.position.x).toBe(2);
  });
  it('handles repeated stops without replaying and preserves event offsets', () => {
    let result = run('G0 X1.\nM0\nX2.\nM0\nX3.');
    result = resumeProgram(result);
    expect(result.state.position.x).toBe(2);
    expect(result.events.map(e => e.afterSegment)).toEqual([1, 2]);
    result = resumeProgram(result);
    expect(result.state.position.x).toBe(3);
    expect(result.segments.map(s => s.to.x)).toEqual([1, 2, 3]);
  });
  it('can resume after a stop at EOF without manufacturing a motion', () => {
    expect(resumeProgram(run('M0')).continuation).toBeNull();
    expect(resumeProgram(run('M0')).state.paused).toBeNull();
  });
  it('retains the run options and modal state across a pause', () => {
    const options = { strictDecimals: true, optionalStop: true, workOffsets: { 55: point(100) } };
    const paused = run('G55 G0 X1000 D3\nM0\nX2000\nM1', options);
    options.strictDecimals = false; options.optionalStop = false; options.workOffsets[55].x = 0;
    const resumed = resumeProgram(paused);
    expect(resumed.state).toMatchObject({ position: point(102), diameterOffset: 3, paused: { code: 1 } });
  });
  it('only reports semantic errors beyond M00 after Continue', () => {
    const paused = run('G0 X1.\nM0\nG999');
    const resumed = resumeProgram(paused);
    expect(resumed.alarms[0]).toMatchObject({ line: 3, code: 'unsupportedCode' });
    expect(resumed.segments).toHaveLength(1);
    expect(resumeProgram(resumed)).toBe(resumed);
  });
  it('validates syntax before any execution, including past a stop', () => {
    expect(runProgram('G0 X1.\nM0\nX?').segments).toEqual([]);
  });
  it.each(['M0 M1', 'M0 M30', 'M1 M2'])('rejects conflicting stop commands %s', source => {
    expect(runProgram(source).alarms[0]?.code).toBe('modalConflict');
  });
  it('ignores Continue when not paused', () => {
    const result = run('G0 X1.'); expect(resumeProgram(result)).toBe(result);
  });
});

describe('D register and Phase 2 samples', () => {
  it('tracks D without applying unimplemented cutter-radius compensation', () => {
    const result = run('D3\nG0 X10.\nD0\nX20.');
    expect(result.segments.map(s => [s.to.x, s.diameterOffset])).toEqual([[10, 3], [20, 0]]);
    expect(runProgram('G41 D3').alarms[0]?.code).toBe('unsupportedCode');
  });
  it.each(['D-1', 'D1.5', 'P-1'])('validates integer non-negative registers/dwell %s', source => {
    expect(runProgram(source).alarms[0]?.code).toBe('invalidValue');
  });
  it.each(Object.entries(en.samples))('runs sample %s in normal and strict modes without decimal warnings', (_, sample) => {
    const results: RunResult[] = [];
    for (const strictDecimals of [false, true]) {
      let result = run(sample.program, { toolLengths: { 1: 0, 2: 0, 3: 0 }, strictDecimals, optionalStop: true, initialPosition: point(0, 0, 80), referencePosition: point(0, 0, 80) });
      while (result.state.paused) result = resumeProgram(result);
      expect(result.alarms).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.state.ended).toBe(true);
      expect(result.state.position.z).toBe(80);
      results.push(result);
    }
    expect(results[0]?.segments).toEqual(results[1]?.segments);
  });
});
