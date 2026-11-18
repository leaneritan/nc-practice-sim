import { initialState, MAX_SEGMENTS, planBlock } from './interpreter';
import { parseProgram } from './parser';
import { activeWorkShift } from './coordinates';
import type { Alarm, Block, InterpreterOptions, ModalState, MotionSegment, ProgramEvent, Vec3 } from './types';

export type MachineMode = 'EDIT' | 'MEMORY' | 'MDI' | 'JOG' | 'HANDLE' | 'RAPID' | 'ZERO RETURN';
export type MachineStatus = 'idle' | 'running' | 'held' | 'singleBlock' | 'programStop' | 'complete' | 'alarm';
export interface Controls {
  feed: number; rapid: 25 | 50 | 100; spindle: number;
  singleBlock: boolean; dryRun: boolean; optionalStop: boolean;
}
type Operation = { kind: 'motion'; segment: MotionSegment } | { kind: 'event'; event: ProgramEvent };
interface Pending {
  state: ModalState; operations: Operation[]; index: number; fraction: number; dwellElapsed: number;
}
interface Session { blocks: Block[]; next: number; options: InterpreterOptions; pending: Pending | null }
export interface Machine {
  mode: MachineMode; status: MachineStatus; state: ModalState; controls: Controls;
  segments: MotionSegment[]; events: ProgramEvent[]; alarms: Alarm[];
  session: Session | null; line: number; programNumber: number | null;
  coolantOverride: boolean | null;
}
export function createMachine(): Machine {
  return { mode: 'EDIT', status: 'idle', state: initialState({ x: 0, y: 0, z: 80 }),
    controls: { feed: 100, rapid: 100, spindle: 100, singleBlock: false, dryRun: false, optionalStop: false },
    segments: [], events: [], alarms: [], session: null, line: 0, programNumber: null, coolantOverride: null };
}
export function locked(machine: Machine) {
  return ['running', 'held', 'singleBlock', 'programStop'].includes(machine.status);
}
export function resetMachine(machine: Machine): Machine {
  return { ...machine, status: 'idle', session: null, segments: [], events: [], alarms: [], line: 0,
    coolantOverride: null, state: { ...machine.state, motion: null, cycle: null, ended: false, paused: null, spindle: 'off', coolant: false } };
}
export function setMode(machine: Machine, mode: MachineMode): Machine {
  return locked(machine) ? machine : { ...resetMachine(machine), mode };
}
export function setControls(machine: Machine, controls: Partial<Controls>): Machine {
  const next = { ...machine.controls, ...controls };
  next.feed = Number.isFinite(next.feed) ? Math.max(0, Math.min(150, next.feed)) : machine.controls.feed;
  next.spindle = Number.isFinite(next.spindle) ? Math.max(50, Math.min(120, next.spindle)) : machine.controls.spindle;
  if (![25, 50, 100].includes(next.rapid)) next.rapid = machine.controls.rapid;
  return { ...machine, controls: next };
}
export function setCoolant(machine: Machine): Machine {
  return { ...machine, state: { ...machine.state, coolant: !machine.state.coolant }, coolantOverride: !machine.state.coolant };
}
export function feedHold(machine: Machine): Machine {
  return machine.status === 'running' ? { ...machine, status: 'held' } : machine;
}
export function cycleStart(machine: Machine, source: string, options: InterpreterOptions): Machine {
  if (!['MEMORY', 'MDI'].includes(machine.mode) || machine.status === 'running' || machine.status === 'alarm') return machine;
  if (machine.session && ['held', 'singleBlock', 'programStop'].includes(machine.status)) {
    return { ...machine, status: 'running', state: { ...machine.state, paused: null } };
  }
  const parsed = parseProgram(source, options);
  const programNumber = parsed.blocks.flatMap(block => block.words).find(word => word.letter === 'O')?.value ?? null;
  return { ...machine, status: parsed.alarms.length ? 'alarm' : 'running', segments: [], events: [], alarms: parsed.alarms,
    line: 0, programNumber, coolantOverride: null, state: { ...machine.state, ended: false, paused: null },
    session: parsed.alarms.length ? null : { blocks: parsed.blocks, next: 0, options: structuredClone(options), pending: null } };
}
export function segmentLength(segment: MotionSegment): number {
  if ('sweep' in segment) return Math.hypot(segment.radius * segment.sweep, segment.to.z - segment.from.z);
  return Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y, segment.to.z - segment.from.z);
}
export function pointOnSegment(segment: MotionSegment, fraction: number): Vec3 {
  if (fraction >= 1) return { ...segment.to };
  if ('center' in segment) {
    const start = Math.atan2(segment.from.y - segment.center.y, segment.from.x - segment.center.x);
    const angle = start + (segment.kind === 'arcCW' ? -1 : 1) * segment.sweep * fraction;
    return { x: segment.center.x + segment.radius * Math.cos(angle), y: segment.center.y + segment.radius * Math.sin(angle),
      z: segment.from.z + (segment.to.z - segment.from.z) * fraction };
  }
  return { x: segment.from.x + (segment.to.x - segment.from.x) * fraction,
    y: segment.from.y + (segment.to.y - segment.from.y) * fraction, z: segment.from.z + (segment.to.z - segment.from.z) * fraction };
}
export function motionRate(segment: MotionSegment, controls: Controls): number {
  if (segment.kind === 'rapid') return 6000 * controls.rapid / 100;
  // Preserve the F/S tapping pitch when the spindle override changes.
  if (segment.cycle === 84) return segment.feed! * controls.spindle / 100;
  return (controls.dryRun ? 1000 : segment.feed!) * controls.feed / 100;
}
function operations(segments: MotionSegment[], events: ProgramEvent[]): Operation[] {
  const result: Operation[] = [];
  for (let index = 0; index <= segments.length; index++) {
    for (const event of events) if (event.afterSegment === index) result.push({ kind: 'event', event });
    const segment = segments[index];
    if (segment) result.push({ kind: 'motion', segment });
  }
  return result;
}
/** Deterministic elapsed-time stepping: holds and overrides work inside a move or dwell. */
export function tickMachine(previous: Machine, milliseconds: number): Machine {
  if (previous.status !== 'running' || !previous.session || !Number.isFinite(milliseconds) || milliseconds <= 0) return previous;
  const machine: Machine = { ...previous, state: { ...previous.state, position: { ...previous.state.position } },
    session: { ...previous.session, pending: previous.session.pending ? { ...previous.session.pending } : null } };
  const session = machine.session!;
  let remaining = milliseconds;
  // Bound work per UI tick even for thousands of modal-only blocks.
  for (let guard = 0; guard < 10000; guard++) {
    if (!session.pending) {
      const block = session.blocks[session.next];
      if (!block) { machine.status = 'complete'; return machine; }
      machine.line = block.line;
      if (block.words.some(word => word.letter === 'M' && [8, 9].includes(word.value))) machine.coolantOverride = null;
      const planned = planBlock(block, machine.state, { ...session.options, optionalStop: machine.controls.optionalStop }, MAX_SEGMENTS - machine.segments.length);
      if (planned.alarms.length) { machine.alarms = planned.alarms; machine.status = 'alarm'; return machine; }
      session.pending = { state: planned.state, operations: operations(planned.segments, planned.events), index: 0, fraction: 0, dwellElapsed: 0 };
    }
    const pending = session.pending;
    const operation = pending.operations[pending.index];
    if (!operation) {
      machine.state = { ...pending.state, position: { ...pending.state.position }, paused: machine.state.paused,
        coolant: machine.coolantOverride ?? pending.state.coolant };
      session.pending = null; session.next++;
      if (machine.state.ended) { machine.status = 'complete'; return machine; }
      if (machine.state.paused) { machine.status = 'programStop'; return machine; }
      if (machine.controls.singleBlock) { machine.status = 'singleBlock'; return machine; }
      continue;
    }
    if (operation.kind === 'event') {
      const event = operation.event;
      if (event.kind === 'dwell') {
        const delta = Math.min(remaining, event.durationMs - pending.dwellElapsed);
        pending.dwellElapsed += delta; remaining -= delta;
        if (pending.dwellElapsed < event.durationMs) return machine;
      }
      if (event.kind === 'spindle') machine.state.spindle = event.direction;
      const paused = event.kind === 'stop' && (event.code === 0 || machine.controls.optionalStop);
      if (event.kind === 'stop') machine.state.paused = paused ? { code: event.code, line: event.line } : null;
      machine.events = [...machine.events, { ...event, afterSegment: machine.segments.length, ...(event.kind === 'stop' ? { paused } : {}) }];
      pending.index++; pending.dwellElapsed = 0;
      continue;
    }
    const segment = operation.segment;
    machine.state = { ...machine.state, motion: pending.state.motion, distance: pending.state.distance,
      workSystem: segment.workSystem, lengthOffset: segment.lengthOffset, diameterOffset: segment.diameterOffset,
      spindle: segment.spindle, speed: segment.speed, feed: pending.state.feed, tool: segment.tool,
      coolant: machine.coolantOverride ?? segment.coolant, selectedTool: pending.state.selectedTool };
    const rate = motionRate(segment, machine.controls);
    if (remaining <= 0 || rate <= 0) return machine;
    const length = segmentLength(segment);
    const duration = length / rate * 60000;
    const delta = Math.min(remaining, duration * (1 - pending.fraction));
    pending.fraction = duration <= 1e-9 ? 1 : Math.min(1, pending.fraction + delta / duration);
    remaining -= delta;
    machine.state.position = pointOnSegment(segment, pending.fraction);
    if (pending.fraction < 1 - 1e-10) return machine;
    machine.state.position = { ...segment.to };
    machine.segments = [...machine.segments, segment];
    pending.index++; pending.fraction = 0;
  }
  return machine;
}
export function currentSegment(machine: Machine): MotionSegment | null {
  const pending = machine.session?.pending;
  const operation = pending?.operations[pending.index];
  return operation?.kind === 'motion' ? operation.segment : null;
}
export function visibleSegments(machine: Machine): MotionSegment[] {
  const segment = currentSegment(machine);
  const fraction = machine.session?.pending?.fraction ?? 0;
  if (!segment || fraction <= 0) return machine.segments;
  return [...machine.segments, { ...segment, to: { ...machine.state.position }, ...('sweep' in segment ? { sweep: segment.sweep * fraction } : {}) }];
}
export function distanceRemaining(machine: Machine): Vec3 {
  const segment = currentSegment(machine);
  if (!segment) return { x: 0, y: 0, z: 0 };
  return { x: segment.to.x - machine.state.position.x, y: segment.to.y - machine.state.position.y, z: segment.to.z - machine.state.position.z };
}
/** Manual inputs are physical displacements; offsets only affect the displayed work position. */
export function manualMove(machine: Machine, axis: keyof Vec3, direction: -1 | 1, multiplier: 1 | 10 | 100,
  options: InterpreterOptions, milliseconds = 100): Machine {
  if (locked(machine) || machine.status === 'alarm' || !['JOG', 'RAPID', 'HANDLE', 'ZERO RETURN'].includes(machine.mode)) return machine;
  const from = { ...machine.state.position };
  const to = { ...from };
  if (machine.mode === 'ZERO RETURN') to[axis] = (options.referencePosition ?? { x: 0, y: 0, z: 80 })[axis];
  else {
    const distance = machine.mode === 'HANDLE' ? .001 * multiplier :
      (machine.mode === 'RAPID' ? 6000 * machine.controls.rapid / 100 : 300 * machine.controls.feed / 100) * milliseconds / 60000;
    to[axis] += direction * distance;
  }
  if (!Number.isFinite(to[axis]) || Math.abs(to[axis]) > 1e6 || machine.segments.length >= MAX_SEGMENTS) {
    return { ...machine, status: 'alarm', alarms: [{ code: 'limit', line: 0, detail: axis.toUpperCase() }] };
  }
  if (to[axis] === from[axis]) return machine;
  const segment: MotionSegment = { kind: 'rapid', from, to, workShift: activeWorkShift(machine.state, options), line: 0,
    feed: null, workSystem: machine.state.workSystem, lengthOffset: machine.state.lengthOffset,
    tool: machine.state.tool, diameterOffset: machine.state.diameterOffset, coolant: machine.state.coolant,
    cycle: null, spindle: machine.state.spindle, speed: machine.state.speed };
  return { ...machine, status: 'idle', session: null, state: { ...machine.state, position: to }, segments: [...machine.segments, segment] };
}
