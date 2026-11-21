// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { activeWorkShift, machineToWork, segmentInWorkCoordinates } from './coordinates';
import { runProgram } from './interpreter';
import type { InterpreterOptions, WorkSystem } from './types';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

describe('saved WORK frames for path rendering', () => {
  it('projects rotated WPC arc endpoints and centers using the saved frame', () => {
    const options = { wpc: { x: -600, y: -300, z: -390, theta: 90 }, toolLengths: { 1: 120 } };
    const result = runProgram('G43 H1 G0 X-30. Y60. Z5.\nG3 X-40. Y50. Z-2. I0. J-10. F100', options);
    expect(result.alarms).toEqual([]);
    const segment = result.segments[1]!;
    options.wpc.x = -100; options.wpc.theta = 45; options.toolLengths[1] = 200;
    const work = segmentInWorkCoordinates(segment);
    expect(work.from.x).toBeCloseTo(60); expect(work.from.y).toBeCloseTo(30);
    expect(work.to.x).toBeCloseTo(50); expect(work.to.y).toBeCloseTo(40); expect(work.to.z).toBe(-2);
    if (!('center' in work)) throw Error();
    expect(work.center.x).toBeCloseTo(50); expect(work.center.y).toBeCloseTo(30);
    expect(work.radius).toBe(10); expect(work.sweep).toBeCloseTo(Math.PI / 2);
    expect(work.kind).toBe('arcCCW');
  });
  it.each([54, 55, 56, 57, 58, 59] as WorkSystem[])('removes G%i and H from endpoints without changing machine positions', system => {
    const options = { workOffsets: { [system]: v(100, -50, 20) }, toolLengths: { 2: 40 } };
    const result = runProgram(`G${system} G43 H2 G0 X10. Y15. Z-2.`, options);
    expect(result.alarms).toEqual([]);
    expect(result.state.position).toEqual(v(110, -35, 58));
    const segment = result.segments[0]!;
    expect(segment.workShift).toEqual(v(100, -50, 60));
    expect(segmentInWorkCoordinates(segment).to).toEqual(v(10, 15, -2));
    expect(machineToWork(result.state.position, activeWorkShift(result.state, options))).toEqual(v(10, 15, -2));
    expect(segment.to).toEqual(v(110, -35, 58));
  });
  it('translates arc centers together with endpoints and preserves radius, sweep, direction and helix Z', () => {
    const result = runProgram('G55 G43 H1 G0 X0. Y0. Z5.\nG3 X10. Y10. Z-5. I0. J10. F100', {
      workOffsets: { 55: v(100, 200, 30) }, toolLengths: { 1: 50 },
    });
    const original = result.segments[1]!;
    const work = segmentInWorkCoordinates(original);
    expect(work).toMatchObject({ from: v(0, 0, 5), to: v(10, 10, -5), center: v(0, 10, 5), radius: 10, kind: 'arcCCW' });
    expect(original).toMatchObject({ from: v(100, 200, 85), center: v(100, 210, 85), to: v(110, 210, 75) });
    expect('sweep' in work && work.sweep).toBeCloseTo(Math.PI / 2);
  });
  it('keeps identical programmed cuts aligned across G54/G55 and H1/H2 changes', () => {
    const options = { workOffsets: { 54: v(100, 200, 30), 55: v(-20, 40, 70) }, toolLengths: { 1: 50, 2: 25 } };
    const result = runProgram('G54 G43 H1 G0 X0. Y0. Z10.\nG1 Z-2. F100\nG3 X10. Y10. I0. J10.\nG55 G43 H2 G0 X0. Y0. Z10.\nG1 Z-2.\nG3 X10. Y10. I0. J10.', options);
    expect(result.alarms).toEqual([]);
    const work = result.segments.map(segmentInWorkCoordinates);
    expect(work[1]?.to).toEqual(work[4]?.to);
    expect(work[2]).toMatchObject({ from: work[5]!.from, to: work[5]!.to, center: v(0, 10, -2) });
    expect(result.segments[1]?.to).not.toEqual(result.segments[4]?.to);
  });
  it('does not reproject old segments when editable offset or length tables change', () => {
    const options = { workOffsets: { 54: v(100, 200, 30) }, toolLengths: { 1: 50 } };
    const result = runProgram('G43 H1 G0 X5. Y6. Z7.', options);
    options.workOffsets[54].x = 1000; options.toolLengths[1] = 500;
    expect(segmentInWorkCoordinates(result.segments[0]!).to).toEqual(v(5, 6, 7));
    expect(result.segments[0]?.workShift).toEqual(v(100, 200, 80));
  });
  it('G49 and frame-only changes rebase the marker but never rewrite preceding geometry', () => {
    const options = { workOffsets: { 54: v(100, 0, 20), 55: v(200, 0, 30) }, toolLengths: { 1: 50 } };
    const result = runProgram('G43 H1 G0 X10. Z5.\nG49\nG55', options);
    expect(result.segments).toHaveLength(1);
    expect(segmentInWorkCoordinates(result.segments[0]!).to).toEqual(v(10, 0, 5));
    expect(result.state.position).toEqual(v(110, 0, 75));
    expect(machineToWork(result.state.position, activeWorkShift(result.state, options))).toEqual(v(-90, 0, 45));
  });
  it.each([81, 82, 83, 84])('projects all G%i feed/retract segments with their compensation', code => {
    const options: InterpreterOptions = { workOffsets: { 56: v(20, 30, 40) }, toolLengths: { 2: 50 } };
    const result = runProgram(`G56 G43 H2 G0 X0. Y0. Z10.\nM3 S400\nG99 G${code} X5. Y6. R2. Z-8. ${code === 82 ? 'P100' : code === 83 ? 'Q3.' : ''} F500`, options);
    expect(result.alarms).toEqual([]);
    const work = result.segments.map(segmentInWorkCoordinates);
    expect(work.at(-1)?.to).toEqual(v(5, 6, 2));
    expect(work.some(s => s.kind === 'linear' && s.to.z === -8)).toBe(true);
    expect(result.state.position).toEqual(v(25, 36, 92));
  });
  it('renders G91 displacement and G28 reference return in the active work frame', () => {
    const options = { workOffsets: { 54: v(100, 200, 30) }, toolLengths: { 1: 50 }, referencePosition: v(0, 0, 500) };
    const result = runProgram('G43 H1 G0 X1. Y2. Z3.\nG91 X4. Z5.\nG28 Z0.', options);
    expect(result.segments.map(segmentInWorkCoordinates).map(s => s.to)).toEqual([v(1, 2, 3), v(5, 2, 8), v(5, 2, 420)]);
  });
  it('has a zero translation for unconfigured work offsets and cancelled H', () => {
    const result = runProgram('G0 X1.');
    expect(activeWorkShift(result.state, {})).toEqual(v());
  });
});
