// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultOffsets, defaultTools, machineHome, restoreSetup, simulationOptions } from '../setup';
import { runProgram, resumeProgram } from './interpreter';
import { inspectMotions, validSafety } from './safety';
import { removedVolume } from './stock';
import { createMachine, cycleStart, tickMachine, feedHold, resetMachine, setMode, manualMove } from './machine';
import { en } from '../i18n/en';
const options = () => simulationOptions(defaultOffsets(), defaultTools());
const prefix = 'T1 M6\nG54 G0 G43 H1 Z15.\nX20. Y20.\nM3 S1000\n';
const run = (source: string) => runProgram(source, options());
function finish(source: string) {
  let result = run(source);
  for (let i = 0; i < 10 && result.state.paused; i++) result = resumeProgram(result);
  return result;
}

describe('realistic setup', () => {
  it('has top home, negative travel and varied 100–180 mm lengths', () => {
    expect(machineHome).toEqual({ x: 0, y: 0, z: 0 }); expect(createMachine().state.position).toEqual(machineHome); expect(defaultOffsets()[54]).toEqual({ x: -500, y: -250, z: -400 });
    expect(new Set(defaultTools().map(t => t.kind)).size).toBe(8);
    expect(defaultTools().every(t => t.length >= 100 && t.length <= 180)).toBe(true);
    expect(restoreSetup(null).tools).toEqual(defaultTools());
    const result = run(prefix + 'G0 X10. Y15. Z5.');
    expect(result.alarms).toEqual([]); expect(result.state.position).toEqual({ x: -490, y: -235, z: -275 });
  });
  it.each(Object.entries(en.samples))('runs the %s sample with safety in normal and strict modes', (_, sample) => {
    for (const strictDecimals of [true, false]) {
      let result = runProgram(sample.program, { ...options(), strictDecimals, optionalStop: true });
      for (let i = 0; i < 10 && result.state.paused; i++) result = resumeProgram(result);
      expect(result.alarms).toEqual([]); expect(result.state.ended).toBe(true);
      expect(result.state.position.z).toBe(0); expect(removedVolume(result.stock!)).toBeGreaterThan(0);
    }
  });
  it('preserves valid older saved setup and repairs invalid rows', () => {
    const restored = restoreSetup({ workOffsets: {54:{x:0,y:0,z:0}}, tools: [null] });
    expect(restored.workOffsets[54]).toEqual({x:0,y:0,z:0}); expect(restored.tools[0]?.length).toBe(120);
  });
});

describe('safety alarms', () => {
  it.each([
    ['spindleStopped', prefix + 'M5\nG1 Z-2. F100'],
    ['spindleStopped', prefix + 'S0\nG1 Z-2. F100'],
    ['missingFeed', prefix + 'G1 Z-2.'],
    ['rapidStock', prefix + 'G0 Z-2.'],
    ['belowStock', prefix + 'G1 Z-21. F100'],
    ['lengthRequired', prefix + 'G49\nG1 Z-2. F100'],
    ['viseCollision', prefix + 'G0 Y-5.\nG1 Z-10. F100'],
    ['travelLimit', 'G91 G0 X1.'],
    ['travelLimit', 'G91 G0 Z-461.'],
    ['toolMissing', 'T21 M6'],
    ['toolMissing', 'G54 G0 X20. Y20. Z15.\nG1 Z-2. F100'],
    ['toolChangeUnsafe', prefix + 'T2 M6'],
    ['toolChangeUnsafe', 'M3 S1000\nT1 M6'],
    ['toolChangeUnsafe', 'T1 M6 G0 X-1.'],
  ])('reports %s and rejects the entire unsafe source block', (code, source) => {
    const result = run(source); expect(result.alarms[0]?.code).toBe(code);
    expect(result.alarms[0]?.line).toBeGreaterThan(0); expect(result.continuation).toBeNull();
    expect(result.segments.every(s => s.line < result.alarms[0]!.line)).toBe(true);
  });
  it('detects stock crossings along a rapid even when both endpoints are outside', () => {
    const result = run('T1 M6\nG54 G0 G43 H1 Z15.\nX-20. Y30.\nZ-2.\nX120.');
    expect(result.alarms[0]?.code).toBe('rapidStock');
  });
  it('checks arc extrema, not only endpoints, against travel', () => {
    const result = runProgram('G2 X-1. Y-120. I0. J-10. F100', { ...options(), workOffsets: {}, initialPosition: {x:-1,y:-100,z:-100} });
    expect(result.alarms[0]?.code).toBe('travelLimit');
  });
  it('uses physical tool length for a wrong H register and fixed G54 stock for G55 moves', () => {
    const wrong = run(prefix.replace('H1', 'H4') + 'G1 Z-2. F100');
    expect(wrong.alarms.length).toBeGreaterThan(0);
    const opts = options(); opts.workOffsets![55] = { x: -510, y: -250, z: -400 };
    const result = runProgram(prefix + 'G55 G0 X30. Y20. Z-2.', opts);
    expect(result.alarms[0]?.code).toBe('rapidStock');
  });
  it('compares actual diameter against an explicit pocket width', () => {
    const opts = options(); opts.safety!.pocketWidth = 4;
    expect(runProgram(prefix + 'G1 Z-2. F100', opts).alarms[0]?.code).toBe('pocketDiameter');
    opts.safety!.pocketWidth = 6;
    expect(runProgram(prefix + 'G1 Z-2. F100', opts).alarms).toEqual([]);
  });
  it('allows safe G83 re-entry and retracts into already removed stock', () => {
    const result = finish(prefix + 'G99 G83 R3. Z-10. Q2. F100\nG80\nG0 Z-8.');
    expect(result.alarms).toEqual([]); expect(removedVolume(result.stock!)).toBeGreaterThan(0);
  });
  it('rolls stock back when a later move in the same cycle block is unsafe', () => {
    const result = run(prefix + 'G83 R3. Z-25. Q2. F100');
    expect(result.alarms[0]?.code).toBe('belowStock'); expect(removedVolume(result.stock!)).toBe(0);
  });
  it('conservatively detects a sub-grid tool crossing solid stock', () => {
    const opts = options(); opts.safety!.tools[0]!.actual = .2;
    const result = runProgram(prefix.replace('X20. Y20.', 'X20.5 Y20.5') + 'G0 Z-2.', opts);
    expect(result.alarms[0]?.code).toBe('rapidStock');
  });
  it('validates configuration instead of crashing', () => {
    for (const change of [ {pocketWidth:-1}, {tools:[{...defaultTools()[0]!,actual:0}]}, {tools:[defaultTools()[0]!,defaultTools()[0]!]} ]) {
      const opts = options(); Object.assign(opts.safety!, change);
      expect(validSafety(opts.safety!)).toBe(false); expect(runProgram('',opts).alarms[0]?.code).toBe('configuration');
    }
    const segment = runProgram('G0 X-1.').segments[0]!;
    expect(inspectMotions([{...segment,tool:99}], options().safety!).alarms[0]?.code).toBe('toolMissing');
  });
});

describe('live stock and tool magazine', () => {
  const start = (source: string) => cycleStart(setMode(createMachine(machineHome), 'MEMORY'), source, options());
  it('preselection does not mount a tool; M06 takes 2 seconds and honors feed hold', () => {
    let machine = tickMachine(start('T2\nM6'), 500);
    expect(machine.state.selectedTool).toBe(2); expect(machine.state.tool).toBeNull();
    machine = feedHold(machine); expect(tickMachine(machine,5000)).toBe(machine);
    machine = cycleStart(machine,'',options()); machine = tickMachine(machine,1500);
    expect(machine.state.tool).toBe(2); expect(machine.events).toContainEqual(expect.objectContaining({kind:'toolChange',fromTool:null,tool:2}));
  });
  it('cuts only traversed material, holds it, and preserves it across RESET/MDI', () => {
    let machine = start(prefix + 'G1 Z-2. F600\nX80. F60');
    machine = tickMachine(machine,15000);
    expect(machine.status).toBe('running'); expect(removedVolume(machine.stock)).toBeGreaterThan(0);
    expect(machine.stock.heights[20*101+80]).toBe(0);
    const held = feedHold(machine); expect(tickMachine(held,10000).stock).toBe(held.stock);
    const reset = resetMachine(held); expect(reset.stock).toBe(held.stock);
    const mdi = setMode(reset,'MDI'); expect(mdi.stock).toBe(held.stock);
  });
  it('blocks manual travel and stock collision without moving', () => {
    const manual = setMode(createMachine(machineHome),'HANDLE');
    const blocked = manualMove(manual,'z',1,1,options()); expect(blocked.alarms[0]?.code).toBe('travelLimit'); expect(blocked.state.position).toEqual(machineHome);
    let atStock = tickMachine(start(prefix),10000); atStock = setMode(atStock,'JOG');
    for (let i=0;i<40 && atStock.status !== 'alarm';i++) atStock=manualMove(atStock,'z',-1,100,options());
    expect(atStock.alarms[0]?.code).toBe('rapidStock'); expect(atStock.state.position.z).toBeGreaterThanOrEqual(-280);
  });
  it('cancels an incomplete tool change on RESET without installing the tool', () => {
    const machine = resetMachine(tickMachine(start('T1 M6'),500)); expect(machine.state.tool).toBeNull(); expect(machine.events).toHaveLength(0);
  });
  it('matches instant stock after a complete timed run', () => {
    const source = prefix + 'G1 Z-2. F600\nX40. F600\nG0 Z15.\nM30';
    const instant = run(source); let timed = start(source);
    for(let i=0;i<50 && timed.status==='running';i++) timed=tickMachine(timed,1000);
    expect(timed.alarms).toEqual([]); expect(timed.status).toBe('complete');
    expect(removedVolume(timed.stock)).toBeCloseTo(removedVolume(instant.stock!),0);
  });
});
