// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultOffsets, defaultTools, simulationOptions } from '../../setup';
import { restorePrograms } from '../../programs';
import { activeWorkShift, machineToWork, segmentInWorkCoordinates } from '../coordinates';
import { runProgram, workPosition } from '../interpreter';
import { createMachine, cycleStart, feedHold, setControls, setMode, tickMachine } from '../machine';
import { physicalTip, removedVolume } from '../stock';
import type { WorkFrame } from '../types';
import { expandMazatrol, withMazatrolWpc } from './expand';
import { autoTools, blankMazatrol, newUnit, sampleMazatrol } from './model';

const tools = defaultTools();
const frame: WorkFrame = { x: -600, y: -300, z: -390, theta: 90 };
const settings = () => simulationOptions(defaultOffsets(), tools);
function hole(wpc = frame) {
  const p = blankMazatrol(), unit = newUnit('DRILLING', 'hole');
  if (!('shapes' in unit)) throw Error();
  unit.diameter = 6.8; unit.depth = 5;
  unit.shapes = [{ kind: 'PT', x: 20, y: 10 }];
  unit.tools = autoTools(unit, 'A5052', tools);
  p.units[1] = { id: 'wpc', kind: 'WPC', ...wpc };
  p.units.splice(2, 0, unit);
  return expandMazatrol(p, tools);
}

describe('machine-coordinate Mazatrol WPC', () => {
  it('new and sample origins equal the default G54 values without sharing references', () => {
    for (const p of [blankMazatrol(), sampleMazatrol(tools)]) {
      expect(p.version).toBe(2);
      expect(p.units[1]).toMatchObject({ ...defaultOffsets()[54], theta: 0 });
    }
    const a = blankMazatrol(), b = blankMazatrol();
    if (a.units[1]?.kind === 'WPC') a.units[1].x = 0;
    expect(b.units[1]).toMatchObject({ x: -500 });
  });
  it('uses WPC directly, preserves G54, and keeps the default sample at the same physical location', () => {
    const e = expandMazatrol(sampleMazatrol(tools), tools);
    const baseline = runProgram(e.source, settings());
    const base = settings(); base.workOffsets![54] = { x: -900, y: -450, z: -100 };
    const before = structuredClone(base), options = withMazatrolWpc(base, e.wpc);
    const result = runProgram(e.source, options);
    expect(base).toEqual(before);
    expect(result.alarms).toEqual([]);
    expect(result.segments.map(s => [s.from, s.to])).toEqual(baseline.segments.map(s => [s.from, s.to]));
    expect(result.stock!.heights).toEqual(baseline.stock!.heights);
    expect(result.stock!.heights[30 * 101 + 50]).toBe(-5);
    expect(result.stock!.drilledHoles).toHaveLength(4);
  });
  it('transforms XY about Z once, adds WPC Z and H, and projects paths/shapes into local work coordinates', () => {
    const e = hole(), options = withMazatrolWpc(settings(), e.wpc), result = runProgram(e.source, options);
    expect(e.issues).toEqual([]); expect(result.alarms).toEqual([]);
    expect(e.source).toContain('(G10 L2 P1 X-600.0000 Y-300.0000 Z-390.0000)');
    expect(e.source).toContain('X-10.0000 Y20.0000');
    expect(e.shapes[0]!.points[0]).toEqual({ x: 23.4, y: 10 });
    const bottom = result.segments.find(s => s.tool === 2 && s.to.z === -235)!;
    expect(bottom.to).toEqual({ x: -610, y: -280, z: -235 }); // -390 - 5 + H2(160)
    const local = segmentInWorkCoordinates(bottom).to;
    expect(local.x).toBeCloseTo(20); expect(local.y).toBeCloseTo(10); expect(local.z).toBe(-5);
    const state = { ...result.state, position: bottom.to, lengthOffset: 2 };
    expect(workPosition(state, options)).toEqual(local);
    expect(machineToWork(bottom.to, activeWorkShift(state, options), frame.theta)).toEqual(local);
    expect(physicalTip(bottom.to, options.safety!.stockOrigin, tools[1], options.safety!.stockRotation)).toEqual(local);
    expect(result.stock!.heights[10 * 101 + 20]).toBe(-5);
    expect(result.stock!.drilledHoles![0]!.x).toBeCloseTo(20);
    expect(result.stock!.drilledHoles![0]!.y).toBeCloseTo(10);
  });
  it('equivalent EIA with the documented G54 setup produces identical machine motions', () => {
    const e = hole(), bound = withMazatrolWpc(settings(), e.wpc);
    const maz = runProgram(e.source, bound);
    const eia = runProgram(e.source, { ...bound, wpc: undefined, workOffsets: { 54: { x: frame.x, y: frame.y, z: frame.z } } });
    expect(eia.alarms).toEqual([]);
    expect(eia.segments.map(s => [s.from, s.to])).toEqual(maz.segments.map(s => [s.from, s.to]));
    expect(eia.stock!.heights).toEqual(maz.stock!.heights);
  });
  it.each([0, 37, -90, 180])('applies theta %s to machine coordinates while keeping local hole geometry', theta => {
    const e = hole({ ...frame, theta });
    const result = runProgram(e.source, withMazatrolWpc(settings(), e.wpc));
    expect(result.alarms).toEqual([]);
    const bottom = result.segments.find(s => s.tool === 2 && s.to.z === -235)!;
    const angle = theta * Math.PI / 180;
    expect(bottom.to.x).toBeCloseTo(frame.x + 20 * Math.cos(angle) - 10 * Math.sin(angle), 3);
    expect(bottom.to.y).toBeCloseTo(frame.y + 20 * Math.sin(angle) + 10 * Math.cos(angle), 3);
    const local = segmentInWorkCoordinates(bottom).to;
    expect(local.x).toBeCloseTo(20, 3); expect(local.y).toBeCloseTo(10, 3);
    expect(result.stock!.heights[10 * 101 + 20]).toBeCloseTo(-5, 3);
  });
  it('rotated facing, tapping and pocket stock removal stays aligned and checks pilot holes', () => {
    const p = sampleMazatrol(tools); p.units[1] = { id: 'wpc', kind: 'WPC', ...frame };
    const e = expandMazatrol(p, tools), result = runProgram(e.source, withMazatrolWpc(settings(), e.wpc));
    expect(result.alarms).toEqual([]);
    expect(result.stock!.heights[30 * 101 + 50]).toBeCloseTo(-5);
    expect(result.stock!.heights[15 * 101 + 15]).toBeCloseTo(-15.44, 4);
    expect(result.stock!.drilledHoles).toHaveLength(4);
    const tap = p.units.find(u => u.kind === 'TAPPING')!;
    if (!('tools' in tap)) throw Error();
    tap.tools[1]!.depth = tap.depth;
    const bad = expandMazatrol(p, tools);
    expect(runProgram(bad.source, withMazatrolWpc(settings(), bad.wpc)).alarms[0]?.code).toBe('pilotDepth');
  });
  it('live single block, hold/resume and removal retain a frozen WPC despite later settings edits', () => {
    const e = hole(), options = withMazatrolWpc(settings(), e.wpc);
    const instant = runProgram(e.source, options);
    let machine = cycleStart(setControls(setMode(createMachine(), 'MEMORY'), { singleBlock: true }), e.source, options);
    machine = tickMachine(machine, 500);
    expect(machine.status).toBe('singleBlock');
    machine = cycleStart(setControls(machine, { singleBlock: false }), '', options);
    machine = tickMachine(machine, 3000);
    const held = feedHold(machine);
    expect(tickMachine(held, 5000)).toBe(held);
    options.wpc!.x = -100; options.safety!.stockOrigin.x = -100; options.workOffsets![54]!.z = -10;
    machine = cycleStart(held, '', options);
    for (let i = 0; i < 100 && machine.status === 'running'; i++) machine = tickMachine(machine, 10000);
    expect(machine.status).toBe('complete'); expect(machine.alarms).toEqual([]);
    expect(machine.state.position).toEqual(instant.state.position);
    expect(machine.session!.options.wpc).toEqual(frame);
    expect(removedVolume(machine.stock)).toBeCloseTo(removedVolume(instant.stock!), 2);
    expect(machine.stock.drilledHoles).toEqual(instant.stock!.drilledHoles);
  });
  it('checks the rotated physical vise and machine travel', () => {
    const options = withMazatrolWpc(settings(), frame);
    const header = 'T1 M06\nG43 H1 G0 Z15.\nS1000 M03\n';
    expect(runProgram(header + 'G0 X5. Y20.\nG1 Z-10. F100', options).alarms[0]?.code).toBe('viseCollision');
    const e = hole({ ...frame, x: -1015 });
    expect(runProgram(e.source, withMazatrolWpc(settings(), e.wpc)).alarms[0]?.code).toBe('travelLimit');
  });
  it.each([
    { ...frame, x: NaN }, { ...frame, theta: Infinity },
  ])('rejects invalid WPC configuration without executing motion', wpc => {
    expect(runProgram('G0 X1.', { ...settings(), wpc }).alarms[0]?.code).toBe('configuration');
  });
});

describe('legacy WPC migration', () => {
  it('adds the current G54 once while preserving rotation, shape/tool rows, extensions and EIA', () => {
    const legacy = { ...sampleMazatrol(tools), version: 1, extensions: { control: 'legacy' } };
    legacy.units[1] = { id: 'wpc', kind: 'WPC', x: 20, y: -5, z: -1, theta: 30, extensions: { note: 'retain' } };
    const saved = { activeId: 'm', documents: [{ id: 'm', name: 'Part', kind: 'mazatrol', data: legacy }, { id: 'e', name: 'Code', kind: 'eia', source: 'M30' }] };
    const before = structuredClone(saved);
    const migrated = restorePrograms(saved, { x: -650, y: -310, z: -380 });
    expect(saved).toEqual(before);
    expect(migrated.documents[0]).toMatchObject({ data: { version: 2, extensions: { control: 'legacy' } } });
    const document = migrated.documents[0]!;
    if (document.kind !== 'mazatrol') throw Error();
    expect(document.data.units[1]).toEqual({ ...legacy.units[1], x: -630, y: -315, z: -381 });
    expect(document.data.units.slice(2)).toEqual(legacy.units.slice(2));
    expect(migrated.documents[1]).toEqual(saved.documents[1]);
    expect(restorePrograms(migrated, defaultOffsets()[54])).toEqual(migrated);
    expect(migrated.activeId).toBe('m');
  });
  it('does not accept corrupted or unsupported saved WPC data', () => {
    for (const data of [{ ...blankMazatrol(), version: 3 }, { version: 1, units: [null] }, ...['bad', null].map(x => ({ ...blankMazatrol(), version: 1, units: [blankMazatrol().units[0], { ...blankMazatrol().units[1], x }, blankMazatrol().units[2]] }))]) {
      expect(restorePrograms({ documents: [{ id: 'm', name: 'bad', kind: 'mazatrol', data }] }).documents).toEqual([]);
    }
  });
});
