// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createMachine, cycleStart, tickMachine, feedHold, resetMachine, setMode, setControls, setCoolant, locked,
  manualMove, currentSegment, visibleSegments, distanceRemaining, motionRate, segmentLength, pointOnSegment } from './machine';
import type { Machine, MachineMode } from './machine';
import { activeWorkShift, machineToWork, segmentInWorkCoordinates } from './coordinates';
import { planBlock, runProgram } from './interpreter';
import { parseProgram } from './parser';
import type { InterpreterOptions } from './types';
const v = (x = 0, y = 0, z = 80) => ({ x, y, z });
const start = (source: string, options: InterpreterOptions = {}, mode: MachineMode = 'MEMORY') => cycleStart(setMode(createMachine(v()), mode), source, options);
function finish(machine: Machine): Machine {
  for (let index = 0; index < 100 && machine.status === 'running'; index++) machine = tickMachine(machine, 10000);
  return machine;
}

describe('timed MEMORY execution', () => {
  it('executes incrementally, retains the caller state and reports distance remaining', () => {
    const before = start('G1 X60. F60');
    const next = tickMachine(before, 1000);
    expect(next.state.position.x).toBeCloseTo(1);
    expect(before.state.position).toEqual(v());
    expect(next.segments).toHaveLength(0);
    expect(visibleSegments(next)[0]?.to.x).toBeCloseTo(1);
    expect(distanceRemaining(next).x).toBeCloseTo(59);
    expect(next.line).toBe(1);
    expect(next.status).toBe('running');
    expect(finish(next).state.position).toEqual(v(60));
  });
  it('FEED HOLD freezes exactly mid-move and CYCLE START resumes without repeating it', () => {
    let machine = tickMachine(start('G1 X10. F60\nM30'), 2000);
    machine = feedHold(machine);
    expect(machine.status).toBe('held');
    expect(tickMachine(machine, 50000)).toBe(machine);
    machine = cycleStart(machine, 'G0 X999.', {});
    machine = tickMachine(machine, 1000);
    expect(machine.state.position.x).toBeCloseTo(3);
    machine = finish(machine);
    expect(machine.state.position.x).toBe(10);
    expect(machine.segments).toHaveLength(1);
    expect(machine.status).toBe('complete');
  });
  it('feed overrides change remaining movement rate and 0% pauses feed without ending the block', () => {
    let machine = tickMachine(start('G1 X10. F60'), 1000);
    machine = tickMachine(setControls(machine, { feed: 50 }), 1000);
    expect(machine.state.position.x).toBeCloseTo(1.5);
    machine = tickMachine(setControls(machine, { feed: 0 }), 1000);
    expect(machine.state.position.x).toBeCloseTo(1.5);
    expect(machine.status).toBe('running');
    machine = tickMachine(setControls(machine, { feed: 150 }), 1000);
    expect(machine.state.position.x).toBeCloseTo(3);
  });
  it.each([25, 50, 100] as const)('uses rapid override %i independently of feed', rapid => {
    const machine = tickMachine(setControls(start('G0 X1000.'), { rapid, feed: 0 }), 1000);
    expect(machine.state.position.x).toBeCloseTo(rapid);
  });
  it('DRY RUN uses 1000 mm/min base cutting feed, scaled by the feed override', () => {
    const machine = tickMachine(setControls(start('G1 X100. F60'), { dryRun: true, feed: 50 }), 6000);
    expect(machine.state.position.x).toBeCloseTo(50);
  });
  it('tracks S/F/T, spindle and coolant from source blocks', () => {
    const machine = tickMachine(start('O123\nT2 M6 S400 M3 M8\nG1 X60. F120'), 1000);
    expect(machine.programNumber).toBe(123);
    expect(machine.state).toMatchObject({ speed: 400, feed: 120, tool: 2, spindle: 'cw', coolant: true });
  });
  it('allows manual COOLANT toggling until the next explicit M08/M09', () => {
    let machine = tickMachine(start('M8\nG1 X2. F60\nM9\nG1 X4.'), 1000);
    machine = setCoolant(machine);
    expect(machine.state.coolant).toBe(false);
    machine = tickMachine(machine, 100);
    expect(machine.state.coolant).toBe(false);
    machine = setCoolant(machine);
    expect(machine.state.coolant).toBe(true);
    machine = tickMachine(machine, 1000);
    expect(machine.state.coolant).toBe(false);
  });
  it('SINGLE BLOCK stops after one original block, including the whole peck cycle', () => {
    let machine = setControls(start('G99 G83 R2. Z-4. Q2. F600\nG0 X20.\nM30'), { singleBlock: true });
    machine = tickMachine(machine, 100000);
    expect(machine.status).toBe('singleBlock');
    expect(machine.state.position).toEqual(v(0, 0, 2));
    expect(machine.segments.filter(s => s.kind === 'linear').map(s => s.to.z)).toEqual([0, -2, -4]);
    machine = tickMachine(cycleStart(machine, '', {}), 10000);
    expect(machine.status).toBe('singleBlock');
    expect(machine.state.position.x).toBe(20);
    machine = tickMachine(cycleStart(machine, '', {}), 1000);
    expect(machine.status).toBe('complete');
  });
  it('can enable SINGLE BLOCK during motion and stop at its boundary', () => {
    let machine = tickMachine(start('G1 X2. F60\nX3.'), 500);
    machine = tickMachine(setControls(machine, { singleBlock: true }), 10000);
    expect(machine.status).toBe('singleBlock'); expect(machine.state.position.x).toBe(2);
  });
  it('times G82 dwell and freezes its remaining time during FEED HOLD', () => {
    let machine = tickMachine(start('G99 G82 R80. Z79. P1000 F60'), 1000);
    expect(machine.state.position.z).toBe(79);
    expect(machine.events).toHaveLength(0);
    machine = tickMachine(machine, 400);
    machine = feedHold(machine);
    expect(tickMachine(machine, 50000)).toBe(machine);
    machine = tickMachine(cycleStart(machine, '', {}), 500);
    expect(machine.state.position.z).toBe(79); expect(machine.events).toHaveLength(0);
    machine = tickMachine(machine, 110);
    expect(machine.events[0]).toMatchObject({ kind: 'dwell', durationMs: 1000 });
    expect(machine.state.position.z).toBe(80);
  });
  it('G84 couples feed to spindle override, keeps pitch, and reverses on withdrawal', () => {
    let machine = setControls(start('M3 S400\nG99 G84 R80. Z70. F400'), { spindle: 50, feed: 0, dryRun: true });
    machine = tickMachine(machine, 1500);
    expect(machine.state.position.z).toBeCloseTo(75);
    expect(machine.state.spindle).toBe('cw');
    expect(motionRate(currentSegment(machine)!, machine.controls)).toBe(200);
    machine = tickMachine(machine, 2000);
    expect(machine.state.spindle).toBe('ccw');
    expect(machine.state.position.z).toBeCloseTo(71.6666667);
    machine = finish(machine);
    expect(machine.state.spindle).toBe('cw');
    expect(machine.state.position.z).toBe(80);
  });
  it('interpolates helical arcs with their real path length, not the endpoint chord', () => {
    const machine = tickMachine(start('G3 X10. Y10. Z70. I0. J10. F600'), 500);
    const segment = currentSegment(machine)!;
    const length = Math.hypot(10 * Math.PI / 2, 10);
    expect(segmentLength(segment)).toBeCloseTo(length);
    const expected = pointOnSegment(segment, 5 / length);
    expect(machine.state.position.x).toBeCloseTo(expected.x);
    expect(machine.state.position.z).toBeCloseTo(expected.z);
    const partial = visibleSegments(machine)[0]!;
    expect('sweep' in partial && partial.sweep).toBeCloseTo(Math.PI / 2 * 5 / length);
  });
  it('executes both legs of G28 with a machine reference and saved WORK frame', () => {
    const options = { workOffsets: { 54: v(100, 0, 20) }, toolLengths: { 1: 40 }, referencePosition: v(0, 0, 500) };
    const machine = finish(start('G43 H1 G28 Z10.', options));
    expect(machine.segments.map(s => s.to.z)).toEqual([70, 500]);
    expect(machine.segments.map(segmentInWorkCoordinates).map(s => s.to.z)).toEqual([10, 440]);
  });
});

describe('stops, RESET and MDI', () => {
  it('M00 stops after its block and resumes at the next block', () => {
    let machine = finish(start('G0 X1. M0\nX2.\nM30'));
    expect(machine.status).toBe('programStop'); expect(machine.state.position.x).toBe(1);
    machine = finish(cycleStart(machine, 'G0 X999.', {}));
    expect(machine.state.position.x).toBe(2); expect(machine.segments).toHaveLength(2);
  });
  it('honors live OPTIONAL STOP even if changed after the block was planned', () => {
    let machine = tickMachine(start('G1 X1. F60 M1\nX2.'), 500);
    machine = tickMachine(setControls(machine, { optionalStop: true }), 5000);
    expect(machine.status).toBe('programStop'); expect(machine.state.position.x).toBe(1);
    expect(machine.events[0]).toMatchObject({ paused: true });
    expect(finish(start('G0 X1. M1\nX2.')).state.position.x).toBe(2);
  });
  it('can disable OPTIONAL STOP during a planned block', () => {
    let machine = tickMachine(setControls(start('G1 X1. F60 M1\nX2.'), { optionalStop: true }), 500);
    machine = finish(setControls(machine, { optionalStop: false }));
    expect(machine.status).toBe('complete'); expect(machine.state.paused).toBeNull();
  });
  it('RESET cancels the session and alarms, retaining physical position, work system and H', () => {
    let machine = tickMachine(start('G55 G43 H1 M3 S400 M8 G1 X10. F60', { toolLengths: { 1: 50 } }), 1000);
    const position = machine.state.position;
    machine = resetMachine(machine);
    expect(machine.status).toBe('idle'); expect(machine.session).toBeNull();
    expect(machine.state).toMatchObject({ position, workSystem: 55, lengthOffset: 1, spindle: 'off', coolant: false, cycle: null, motion: null });
    expect(machine.segments).toEqual([]); expect(machine.events).toEqual([]);
  });
  it('rejects malformed input before motion and stops on an unsupported block', () => {
    const syntax = start('G0 X1.\nX?');
    expect(syntax.status).toBe('alarm'); expect(syntax.segments).toEqual([]);
    const semantic = finish(start('G0 X1.\nG999\nG0 X99.'));
    expect(semantic.status).toBe('alarm'); expect(semantic.state.position.x).toBe(1);
    expect(semantic.alarms[0]?.line).toBe(2);
    expect(cycleStart(semantic, 'G0 X9.', {})).toBe(semantic);
    expect(resetMachine(semantic).alarms).toEqual([]);
  });
  it('MDI starts at the current physical/modal state and supports successive incremental commands', () => {
    let machine = setMode(createMachine(v()), 'MDI');
    machine = finish(cycleStart(machine, 'G91 G1 X5. F600 S400 M3', {}));
    machine = finish(cycleStart(machine, 'X2.', {}));
    expect(machine.state).toMatchObject({ position: v(7), distance: 'incremental', spindle: 'cw', speed: 400, feed: 600 });
    expect(machine.mode).toBe('MDI');
  });
  it('uses snapshotted offsets throughout a run and converts machine and work readouts separately', () => {
    const options = { workOffsets: { 55: v(100, 200, 20) }, toolLengths: { 2: 50 } };
    let machine = start('G55 G43 H2 G0 X10. Y15. Z-2.', options);
    options.workOffsets[55].x = 999; options.toolLengths[2] = 500;
    machine = finish(machine);
    expect(machine.state.position).toEqual(v(110, 215, 68));
    expect(machineToWork(machine.state.position, activeWorkShift(machine.state, machine.session!.options))).toEqual(v(10, 15, -2));
    expect(segmentInWorkCoordinates(machine.segments[0]!).to).toEqual(v(10, 15, -2));
  });
  it('honors strict decimal input in timed execution and MDI', () => {
    expect(finish(start('G0 X10', { strictDecimals: true }, 'MDI')).state.position.x).toBe(.01);
  });
  it('does not restart an already running cycle or allow execution in EDIT', () => {
    const machine = start('G0 X1.');
    expect(cycleStart(machine, '', {})).toBe(machine);
    const edit = createMachine(v()); expect(cycleStart(edit, 'G0 X1.', {})).toBe(edit);
  });
  it('prevents mode changes during a held cycle and accepts them after RESET', () => {
    const machine = feedHold(start('G0 X1.'));
    expect(locked(machine)).toBe(true); expect(setMode(machine, 'JOG')).toBe(machine);
    expect(setMode(resetMachine(machine), 'JOG').mode).toBe('JOG');
  });
  it('handles empty programs and invalid timer deltas without motion', () => {
    expect(finish(start('')).status).toBe('complete');
    const machine = start('G0 X1.');
    for (const delta of [0, -1, NaN, Infinity]) expect(tickMachine(machine, delta)).toBe(machine);
    expect(feedHold(createMachine(v())).status).toBe('idle');
  });
  it('clamps invalid override values', () => {
    const machine = setControls(createMachine(v()), { feed: 999, spindle: -1, rapid: 3 as 25 });
    expect(machine.controls).toMatchObject({ feed: 150, spindle: 50, rapid: 100 });
    expect(setControls(machine, { feed: NaN, spindle: Infinity }).controls).toEqual(machine.controls);
  });
  it('planBlock returns an atomic alarm on invalid configuration or execution', () => {
    const state = createMachine(v()).state;
    const block = parseProgram('G1 X1.').blocks[0]!;
    expect(planBlock(block, state, {}).alarms[0]?.code).toBe('missingFeed');
    expect(planBlock(block, state, { peckClearance: 0 }).alarms[0]?.code).toBe('configuration');
  });
});

describe('manual JOG / RAPID / HANDLE / ZERO RETURN', () => {
  it.each([1, 10, 100] as const)('HANDLE ×%i makes one physical pulse and subtracts work offsets for display', multiplier => {
    const options = { workOffsets: { 54: v(100, 0, 0) } };
    const machine = manualMove(setMode(createMachine(v()), 'HANDLE'), 'x', 1, multiplier, options);
    expect(machine.state.position.x).toBeCloseTo(.001 * multiplier);
    expect(segmentInWorkCoordinates(machine.segments[0]!).to.x).toBeCloseTo(-100 + .001 * multiplier);
  });
  it('JOG moves both directions at 300 mm/min and respects feed override', () => {
    let machine = setMode(createMachine(v()), 'JOG');
    machine = manualMove(machine, 'z', -1, 1, {});
    expect(machine.state.position.z).toBe(79.5);
    machine = manualMove(setControls(machine, { feed: 50 }), 'y', 1, 1, {});
    expect(machine.state.position.y).toBe(.25);
    expect(manualMove(setControls(machine, { feed: 0 }), 'y', 1, 1, {}).state.position.y).toBe(.25);
  });
  it('RAPID uses rapid override and ZERO RETURN moves only the selected machine axis', () => {
    let machine = manualMove(setControls(setMode(createMachine(v()), 'RAPID'), { rapid: 25 }), 'x', 1, 1, {});
    expect(machine.state.position.x).toBe(2.5);
    machine = setMode(machine, 'ZERO RETURN');
    machine = manualMove(machine, 'z', 1, 1, { referencePosition: v(10, 20, 100) });
    expect(machine.state.position).toEqual(v(2.5, 0, 100));
    machine = manualMove(machine, 'x', -1, 1, {});
    expect(machine.state.position.x).toBe(0);
    expect(manualMove(machine, 'x', 1, 1, {})).toBe(machine);
  });
  it('blocks manual moves in automatic modes and during active/failed cycles', () => {
    const edit = createMachine(v()); expect(manualMove(edit, 'x', 1, 1, {})).toBe(edit);
    const automatic = start('G0 X1.'); expect(manualMove(automatic, 'x', 1, 1, {})).toBe(automatic);
    const alarm = { ...setMode(edit, 'JOG'), status: 'alarm' as const };
    expect(manualMove(alarm, 'x', 1, 1, {})).toBe(alarm);
  });
  it('bounds manual numeric positions and total generated trace', () => {
    const machine = setMode(createMachine(v()), 'HANDLE');
    machine.state.position.x = 1e6;
    expect(manualMove(machine, 'x', 1, 100, {}).status).toBe('alarm');
  });
  it('supports arbitrary initial modal state for instant preview without mutating it', () => {
    const state = createMachine(v()).state;
    state.position.x = 10; state.distance = 'incremental'; state.motion = 1; state.feed = 100;
    const result = runProgram('X5.', { initialModalState: state });
    expect(result.state.position.x).toBe(15); expect(state.position.x).toBe(10);
  });
});
