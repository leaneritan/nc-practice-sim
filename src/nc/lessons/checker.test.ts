// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { lessons } from '../../lessons/catalog';
import { eiaFor, solutionProgram, starterProgram } from '../../lessons/programs';
import { runLesson } from '../../lessons/run';
import { checkLesson } from './checker';
import { tracks } from '../../lessons/types';
import { autoTools } from '../mazatrol/model';
import type { CuttingUnit } from '../mazatrol/model';
import { defaultTools } from '../../setup';

describe.each(lessons)('$id lesson', lesson => {
  it.each(tracks)('%s correct solution passes the independent target and feature checks', track => {
    const program = solutionProgram(lesson);
    const run = runLesson(lesson, track === 'mazatrol' ? { kind: track, data: program } : { kind: track, source: eiaFor(program) });
    expect(run.result.alarms).toEqual([]);
    expect(run.check.issues).toEqual([]);
    expect(run.check.passed).toBe(true); expect(run.check.score).toBe(100);
  });
  it.each(tracks)('%s starter is unfinished and identifies a depth/shape mistake', track => {
    const run = runLesson(lesson, starterProgram(lesson, track));
    expect(run.result.alarms).toEqual([]);
    expect(run.check.passed).toBe(false);
    expect(run.check.issues.some(i => i.code === 'undercut')).toBe(true);
    expect(run.check.cells.length).toBeGreaterThan(0);
  });
});

describe('specific machining mistakes', () => {
  function changed(index: number, edit: (cuts: CuttingUnit[]) => void) {
    const lesson = lessons[index]!, program = solutionProgram(lesson);
    const cuts = program.units.filter((u): u is CuttingUnit => 'tools' in u); edit(cuts);
    return runLesson(lesson, { kind: 'mazatrol', data: program });
  }
  const issue = (run: ReturnType<typeof runLesson>, code: string) => {
    expect(run.check.passed).toBe(false);
    const found = run.check.issues.find(i => i.code === code); expect(found).toBeDefined(); return found!;
  };
  it('face: reports excess depth and its stock location', () => {
    const run = changed(0, cuts => { cuts[0]!.depth = 1.3; });
    expect(issue(run, 'overcut')).toMatchObject({ expected: -1, actual: expect.closeTo(-1.3, 4), at: { x: 0, y: 0, z: expect.closeTo(-1.3, 4) } });
  });
  it('drill: identifies the missing first hole without blaming the other three', () => {
    const run = changed(1, cuts => { const u = cuts[0]!; if ('shapes' in u) u.shapes.shift(); });
    expect(issue(run, 'missingHole').at).toEqual({ x: 20, y: 15, z: -8 });
    expect(run.check.issues.filter(i => i.code === 'missingHole')).toHaveLength(1);
    expect(run.check.issues.some(i => i.code === 'holePosition')).toBe(false);
  });
  it('drill: reports the expected and actual continuous position', () => {
    const run = changed(1, cuts => { const u = cuts[0]!; if ('shapes' in u) u.shapes[1]!.x += .3; });
    expect(issue(run, 'holePosition')).toMatchObject({ at: { x: 80, y: 15, z: -8 }, actualAt: { x: expect.closeTo(80.3, 4), y: 15, z: -8 } });
  });
  it('drill: detects a shallow drill and an extra hole', () => {
    const run = changed(1, cuts => {
      const u = cuts[0]!; if ('shapes' in u) { u.shapes.push({ kind: 'PT', x: 50, y: 30 }); u.depth = 7; u.tools = autoTools(u, 'A5052', defaultTools()); }
    });
    expect(issue(run, 'holeDepth')).toMatchObject({ expected: -8, actual: -7 });
    expect(issue(run, 'extraHole').at).toEqual({ x: 50, y: 30, z: -7 });
  });
  it('tap: catches a pilot no deeper than the thread with the alarm location', () => {
    const run = changed(2, cuts => { cuts[0]!.tools.find(t => t.kind === 'drill')!.depth = 10; });
    expect(issue(run, 'alarm')).toMatchObject({ alarm: 'pilotDepth', at: { x: 20, y: 15, z: -10 } });
    expect(run.check.score).toBeLessThanOrEqual(50);
  });
  it('tap: checks depth and pitch even when the tool is correct', () => {
    const shallow = changed(2, cuts => { cuts[0]!.tools.find(t => t.kind === 'tap')!.depth = 8; });
    expect(issue(shallow, 'tapDepth')).toMatchObject({ expected: -10, actual: -8 });
    const pitch = changed(2, cuts => { const u = cuts[0]!; if ('pitch' in u) u.pitch = 1; u.tools.find(t => t.kind === 'tap')!.feed *= .8; });
    expect(issue(pitch, 'tapPitch')).toMatchObject({ expected: 1.25, actual: expect.closeTo(1, 3) });
  });
  it('tap: final pilot records cannot hide drilling after tapping', () => {
    const lesson = lessons[2]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    run.result.segments.sort((a, b) => Number(b.cycle === 84) - Number(a.cycle === 84));
    const check = checkLesson(lesson.target, run.result, run.options);
    expect(check.issues.filter(i => i.code === 'pilotBeforeTap')).toHaveLength(4);
    expect(check.cells).toHaveLength(0);
  });
  it('tap: requires the full specified pilot allowance before tapping, not just the final depth', () => {
    const lesson = lessons[2]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    run.result.segments = run.result.segments.map(s => s.tool === 2 && s.kind === 'linear' && s.to.z < s.from.z ? { ...s, to: { ...s.to, z: -251 } } : s); // tip Z−11 with H160
    expect(checkLesson(lesson.target, run.result, run.options).issues.some(i => i.code === 'pilotBeforeTap')).toBe(true);
  });
  it('tap: a flat-bottom hole does not prove a tapping cycle occurred', () => {
    const lesson = lessons[2]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    run.result.segments = run.result.segments.filter(s => s.cycle !== 84);
    expect(checkLesson(lesson.target, run.result, run.options).issues.filter(i => i.code === 'missingTap')).toHaveLength(4);
  });
  it('pocket: flags missing width and too much depth', () => {
    const narrow = changed(3, cuts => { const u = cuts[0]!; if ('width' in u) u.width = 38; });
    expect(issue(narrow, 'undercut').at!.x).toBeGreaterThan(65);
    const deep = changed(3, cuts => { cuts[0]!.depth = 6; });
    expect(issue(deep, 'overcut')).toMatchObject({ expected: -5, actual: -6 });
  });
  it('outside contour: a narrower island cuts into the target outline', () => {
    const run = changed(4, cuts => { const u = cuts[0]!; if ('edges' in u) for (const e of u.edges) if (e.x === 80) e.x = 78; });
    expect(issue(run, 'overcut').at!.x).toBeGreaterThanOrEqual(78);
    expect(issue(run, 'undercut').at!.x).toBeGreaterThan(80);
  });
  it('counterbore grid: detects undersized recesses and the right depth', () => {
    const run = changed(5, cuts => { const u = cuts.find(c => c.kind === 'RGH CBOR')!; if ('diameter' in u) u.diameter = 10; });
    expect(issue(run, 'undercut')).toMatchObject({ expected: -3, at: { x: 20, y: 9, z: 0 } });
  });
  it('combined: detects an omitted pocket even if all holes and facing are correct', () => {
    const lesson = lessons[6]!, program = solutionProgram(lesson); program.units = program.units.filter(u => u.kind !== 'POCKET');
    const run = runLesson(lesson, { kind: 'mazatrol', data: program });
    expect(issue(run, 'undercut')).toMatchObject({ expected: -5, actual: -1 });
    expect(run.check.issues.every(i => i.code === 'undercut')).toBe(true);
  });
  it('does not mutate the result and rejects missing/non-finite stock', () => {
    const lesson = lessons[1]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    const before = structuredClone(run.result); checkLesson(lesson.target, run.result, run.options);
    expect(run.result).toEqual(before);
    run.result.stock!.heights[0] = NaN;
    expect(checkLesson(lesson.target, run.result, run.options).issues[0]?.code).toBe('invalidStock');
    run.result.stock = undefined;
    expect(checkLesson(lesson.target, run.result, run.options).score).toBe(0);
  });
  it('rejects invalid units, syntax and paused runs', () => {
    const lesson = lessons[0]!, program = solutionProgram(lesson); program.units.pop();
    expect(runLesson(lesson, { kind: 'mazatrol', data: program }).check.issues[0]).toMatchObject({ code: 'alarm', alarm: 'unitParameters' });
    expect(runLesson(lesson, { kind: 'eia', source: 'X???' }).check.passed).toBe(false);
    const paused = runLesson(lesson, { kind: 'eia', source: 'M00\nM30' });
    expect(paused.check.issues.some(i => i.code === 'incomplete')).toBe(true);
  });
});

describe('checker boundaries', () => {
  it('uses an inclusive ±0.1 mm Z tolerance and locates an out-of-tolerance cell', () => {
    const lesson = lessons[0]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    run.result.stock!.heights[30 * 101 + 50] = -0.9;
    expect(checkLesson(lesson.target, run.result, run.options).passed).toBe(true);
    run.result.stock!.heights[30 * 101 + 50] = -0.899;
    expect(checkLesson(lesson.target, run.result, run.options).issues).toContainEqual(expect.objectContaining({ code: 'undercut', at: expect.objectContaining({ x: 50, y: 30 }), expected: -1 }));
    run.result.stock!.heights[30 * 101 + 50] = -1.101;
    expect(checkLesson(lesson.target, run.result, run.options).issues[0]?.code).toBe('overcut');
  });
  it('cannot pass an alarm or an unfinished program even if the geometry matches', () => {
    const lesson = lessons[0]!, run = runLesson(lesson, { kind: 'mazatrol', data: solutionProgram(lesson) });
    run.result.alarms = [{ code: 'travelLimit', line: 5, detail: 'X' }];
    expect(checkLesson(lesson.target, run.result, run.options).issues[0]?.code).toBe('alarm');
    run.result.alarms = []; run.result.state.ended = false;
    expect(checkLesson(lesson.target, run.result, run.options).issues[0]?.code).toBe('incomplete');
  });
});
