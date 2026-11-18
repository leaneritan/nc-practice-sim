import { arcFromCenter, arcFromRadius } from './geometry';
import { parseProgram } from './parser';
import type {
  AlarmCode, Block, DrillCycle, InterpreterOptions, ModalState,
  MotionMode, MotionSegment, RunResult, Vec3, WorkSystem, ProgramEvent,
} from './types';

export const MAX_SEGMENTS = 20_000;
const MAX_VALUE = 1_000_000;
const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const axes = ['x', 'y', 'z'] as const;
const groups: Record<number, string> = {
  0: 'motion', 1: 'motion', 2: 'motion', 3: 'motion', 80: 'motion', 81: 'motion', 82: 'motion', 83: 'motion', 84: 'motion', 28: 'reference',
  17: 'plane', 21: 'units', 40: 'cutter', 43: 'length', 49: 'length',
  54: 'work', 55: 'work', 56: 'work', 57: 'work', 58: 'work', 59: 'work',
  90: 'distance', 91: 'distance', 94: 'feed', 98: 'retract', 99: 'retract',
};
const mGroups: Record<number, string> = {
  3: 'spindle', 4: 'spindle', 5: 'spindle', 6: 'tool', 8: 'coolant', 9: 'coolant', 0: 'stop', 1: 'stop', 2: 'stop', 30: 'stop',
};
class NcError extends Error {
  constructor(readonly code: AlarmCode, readonly detail: string) { super(code); }
}
function fail(code: AlarmCode, detail: string): never { throw new NcError(code, detail); }
function finite(value: number): boolean { return Number.isFinite(value) && Math.abs(value) <= MAX_VALUE; }
function vectorValid(value: Vec3): boolean { return axes.every(axis => finite(value[axis])); }

export function initialState(position: Vec3 = zero()): ModalState {
  return {
    position: { ...position }, motion: null, distance: 'absolute', plane: 17, units: 'mm', feedMode: 94,
    workSystem: 54, lengthOffset: null, diameterOffset: 0, feed: 0, speed: 0, selectedTool: null, tool: null,
    spindle: 'off', coolant: false, retract: 98, cycle: null, ended: false, paused: null,
  };
}

interface Configuration {
  workOffsets: Record<WorkSystem, Vec3>;
  toolLengths: Record<number, number>;
  peckClearance: number;
  referencePosition: Vec3;
  optionalStop: boolean;
}
function configure(options: InterpreterOptions): Configuration {
  const workOffsets = { 54: zero(), 55: zero(), 56: zero(), 57: zero(), 58: zero(), 59: zero(), ...options.workOffsets };
  const toolLengths = { ...(options.toolLengths ?? { 1: 0 }) };
  const peckClearance = options.peckClearance ?? 0.5;
  if (!vectorValid(options.initialPosition ?? zero()) || !vectorValid(options.referencePosition ?? zero()) ||
      Object.entries(workOffsets).some(([key, value]) => ![54, 55, 56, 57, 58, 59].includes(Number(key)) || !vectorValid(value)) ||
      Object.entries(toolLengths).some(([key, value]) => !Number.isInteger(Number(key)) || Number(key) < 1 || !finite(value) || value < 0) ||
      !finite(peckClearance) || peckClearance <= 0) fail('configuration', 'offsets');
  return { workOffsets, toolLengths, peckClearance, referencePosition: { ...(options.referencePosition ?? zero()) }, optionalStop: options.optionalStop ?? false };
}

function translation(state: ModalState, config: Configuration): Vec3 {
  const work = config.workOffsets[state.workSystem];
  return { ...work, z: work.z + (state.lengthOffset === null ? 0 : config.toolLengths[state.lengthOffset]!) };
}

/** Work coordinates describe the programmed tool tip; position stores the machine reference point. */
export function workPosition(state: ModalState, options: InterpreterOptions = {}): Vec3 {
  const shift = translation(state, configure(options));
  return { x: state.position.x - shift.x, y: state.position.y - shift.y, z: state.position.z - shift.z };
}

function executeBlock(block: Block, previous: ModalState, config: Configuration, budget: number) {
  // A failed block is atomic: discard its temporary state and any expanded pecks.
  const state: ModalState = { ...previous, position: { ...previous.position }, cycle: previous.cycle ? { ...previous.cycle } : null };
  const segments: MotionSegment[] = [];
  const events: ProgramEvent[] = [];
  const values = new Map<string, number>();
  const gcodes: number[] = [];
  const mcodes: number[] = [];
  const seenGroups = new Set<string>();
  for (const word of block.words) {
    const { letter, value } = word;
    if (!finite(value)) fail('invalidValue', letter);
    if (letter === 'G' || letter === 'M') {
      const group = (letter === 'G' ? groups : mGroups)[value];
      if (!group) fail('unsupportedCode', `${letter}${value}`);
      const key = letter + group;
      if (seenGroups.has(key)) fail('modalConflict', `${letter}${value}`);
      seenGroups.add(key);
      (letter === 'G' ? gcodes : mcodes).push(value);
    } else {
      values.set(letter, value);
    }
  }
  const has = (letter: string) => values.has(letter);
  const get = (letter: string) => values.get(letter)!;
  const hasAxis = axes.some(axis => has(axis.toUpperCase()));
  for (const letter of ['N', 'O', 'T', 'H', 'D', 'P']) {
    if (has(letter) && (!Number.isInteger(get(letter)) || get(letter) < (letter === 'H' ? 1 : 0))) fail('invalidValue', letter);
  }
  for (const letter of ['F', 'S']) {
    if (has(letter) && get(letter) < 0) fail('invalidValue', letter);
  }
  const explicitMotion = gcodes.find(code => groups[code] === 'motion');
  if (explicitMotion !== undefined) {
    state.motion = explicitMotion === 80 ? null : explicitMotion as MotionMode;
    if (![81, 82, 83, 84].includes(explicitMotion)) state.cycle = null;
  }
  for (const code of gcodes) {
    if (code === 90 || code === 91) state.distance = code === 90 ? 'absolute' : 'incremental';
    if (code >= 54 && code <= 59) state.workSystem = code as WorkSystem;
    if (code === 98 || code === 99) state.retract = code;
    if (code === 49) state.lengthOffset = null;
  }
  if (gcodes.includes(43) || has('H')) {
    if (gcodes.includes(49) || (!gcodes.includes(43) && state.lengthOffset === null)) fail('unexpectedWord', 'H');
    const h = values.get('H') ?? state.lengthOffset;
    if (h === null || config.toolLengths[h] === undefined) fail('missingOffset', `H${h ?? '?'}`);
    state.lengthOffset = h;
  }
  if (state.cycle && (state.workSystem !== previous.workSystem || state.distance !== previous.distance || state.lengthOffset !== previous.lengthOffset)) {
    fail('cycleFrameChange', 'G80');
  }
  if (has('D')) state.diameterOffset = get('D');
  if (has('F')) state.feed = get('F');
  if (has('S')) state.speed = get('S');
  if (has('T')) state.selectedTool = get('T');
  for (const code of mcodes) {
    if (code === 3 || code === 4 || code === 5) state.spindle = code === 5 ? 'off' : code === 3 ? 'cw' : 'ccw';
    if (code === 6) {
      if (state.selectedTool === null || state.selectedTool < 1) fail('invalidValue', 'T');
      state.tool = state.selectedTool;
    }
    if (code === 8 || code === 9) state.coolant = code === 8;
    if (code === 2 || code === 30) state.ended = true;
  }
  const shift = translation(state, config);
  const target = { ...state.position };
  for (const axis of axes) {
    const letter = axis.toUpperCase();
    if (has(letter)) target[axis] = state.distance === 'absolute' ? get(letter) + shift[axis] : state.position[axis] + get(letter);
  }
  const requireFeed = () => { if (state.feed <= 0) fail('missingFeed', 'F'); };
  function emit(kind: 'rapid' | 'linear', to: Vec3) {
    if (!vectorValid(to)) fail('invalidValue', 'XYZ');
    if (axes.every(axis => Math.abs(to[axis] - state.position[axis]) < 1e-10)) return;
    if (segments.length >= budget) fail('limit', 'segments');
    segments.push({ kind, workShift: { ...shift }, coolant: state.coolant, cycle: state.cycle?.kind ?? null, from: { ...state.position }, to: { ...to }, line: block.line,
      feed: kind === 'rapid' ? null : state.feed, workSystem: state.workSystem,
      lengthOffset: state.lengthOffset, tool: state.tool, diameterOffset: state.diameterOffset, spindle: state.spindle, speed: state.speed });
    state.position = { ...to };
  }
  const isArc = state.motion === 2 || state.motion === 3;
  const isCycle = state.motion !== null && [81, 82, 83, 84].includes(state.motion);
  const isReference = gcodes.includes(28);
  if ((has('I') || has('J')) && !isArc) fail('unexpectedWord', has('I') ? 'I' : 'J');
  if (has('R') && !isArc && !isCycle) fail('unexpectedWord', 'R');
  if (has('Q') && state.motion !== 83) fail('unexpectedWord', 'Q');
  if (has('P') && state.motion !== 82 && state.motion !== 84) fail('unexpectedWord', 'P');
  const cycleCall = isCycle && (explicitMotion !== undefined || hasAxis || has('R') || has('Q') || has('P'));
  if (isReference) {
    // G28 uses the current distance mode only for the intermediate point.
    // The second leg returns selected axes to the MACHINE reference, without offsets.
    if ((explicitMotion !== undefined && explicitMotion !== 80) || state.cycle) fail('modalConflict', 'G28');
    for (const letter of ['I', 'J', 'R', 'Q', 'P']) if (has(letter)) fail('unexpectedWord', letter);
    emit('rapid', target);
    const reference = { ...state.position };
    for (const axis of axes) if (!hasAxis || has(axis.toUpperCase())) reference[axis] = config.referencePosition[axis];
    emit('rapid', reference);
  } else if (cycleCall) {
    requireFeed();
    const old = state.cycle;
    const initialZ = old?.initialZ ?? state.position.z;
    // G91: R is relative to the initial plane, Z is relative to R, not to the tool.
    const r = has('R') ? (state.distance === 'absolute' ? get('R') + shift.z : initialZ + get('R')) : old?.r;
    let depth = old?.depth;
    if (has('Z') && r !== undefined) depth = state.distance === 'absolute' ? get('Z') + shift.z : r + get('Z');
    else if (old && r !== undefined && state.distance === 'incremental') depth = r + old.depth - old.r;
    const q = values.get('Q') ?? old?.q;
    // Dwell belongs to the cycle. Do not inherit a dwell from a different cycle type.
    const dwellMs = values.get('P') ?? (old?.kind === state.motion ? old.dwellMs : undefined) ?? (state.motion === 84 ? 0 : undefined);
    if (state.motion === 82 && dwellMs === undefined) fail('cycleParameters', 'P');
    if (state.motion === 84 && (state.spindle !== 'cw' || state.speed <= 0)) fail('tappingSpindle', 'M03/S');
    if (r === undefined || depth === undefined || !finite(r) || !finite(depth) || depth >= r ||
        (state.motion === 83 && (q === undefined || q <= 0))) fail('cycleParameters', 'R/Z/Q');
    const cycle: DrillCycle = { kind: state.motion as DrillCycle['kind'], initialZ, r, depth, ...(q === undefined ? {} : { q }), ...(dwellMs === undefined ? {} : { dwellMs }) };
    state.cycle = cycle;
    if (state.position.z < r) emit('rapid', { ...state.position, z: r });
    emit('rapid', { x: target.x, y: target.y, z: state.position.z });
    emit('rapid', { ...state.position, z: r });
    if (cycle.kind !== 83) {
      emit('linear', { ...state.position, z: depth });
      if (cycle.kind === 82 || (cycle.kind === 84 && dwellMs! > 0)) {
        events.push({ kind: 'dwell', durationMs: dwellMs!, line: block.line, position: { ...state.position }, afterSegment: segments.length });
      }
      if (cycle.kind === 84) {
        // Right-hand tapping: feed in CW, reverse and FEED out to R, then restore CW.
        // F/S is the thread pitch in G94. There is no spindle synchronization hardware here.
        state.spindle = 'ccw';
        events.push({ kind: 'spindle', direction: 'ccw', line: block.line, position: { ...state.position }, afterSegment: segments.length });
        emit('linear', { ...state.position, z: r });
        state.spindle = 'cw';
        events.push({ kind: 'spindle', direction: 'cw', line: block.line, position: { ...state.position }, afterSegment: segments.length });
      }
    } else {
      const pecks = Math.ceil((r - depth) / q!);
      if (!Number.isFinite(pecks) || pecks > budget / 2) fail('limit', 'pecks');
      for (let peck = 1; peck <= pecks; peck++) {
        const bottom = Math.max(depth, r - peck * q!);
        emit('linear', { ...state.position, z: bottom });
        if (peck < pecks) {
          emit('rapid', { ...state.position, z: r });
          // Never rapid into uncut material; return just above the previous bottom.
          emit('rapid', { ...state.position, z: Math.min(r, bottom + config.peckClearance) });
        }
      }
    }
    emit('rapid', { ...state.position, z: state.retract === 98 ? Math.max(initialZ, r) : r });
  } else if (isArc && (hasAxis || has('I') || has('J') || has('R'))) {
    requireFeed();
    if (has('R') === (has('I') || has('J'))) fail('arcDefinition', 'I/J/R');
    if (!vectorValid(target)) fail('invalidValue', 'XYZ');
    const clockwise = state.motion === 2;
    const arc = has('R') ? arcFromRadius(state.position, target, get('R'), clockwise)
      : arcFromCenter(state.position, target, values.get('I') ?? 0, values.get('J') ?? 0, clockwise);
    if (!arc) fail('arcGeometry', 'I/J/R');
    if (segments.length >= budget) fail('limit', 'segments');
    segments.push({ workShift: { ...shift }, coolant: state.coolant, cycle: null, kind: clockwise ? 'arcCW' : 'arcCCW', from: { ...state.position }, to: { ...target },
      line: block.line, feed: state.feed, workSystem: state.workSystem, lengthOffset: state.lengthOffset,
      tool: state.tool, diameterOffset: state.diameterOffset, spindle: state.spindle, speed: state.speed, ...arc });
    state.position = { ...target };
  } else if (hasAxis) {
    if (state.motion === null) fail('missingMotion', 'G00/G01');
    if (state.motion === 1) requireFeed();
    emit(state.motion === 0 ? 'rapid' : 'linear', target);
  }
  // M30 ends execution after any motion in its block. Keep final modal values for inspection.
  if (state.ended) { state.spindle = 'off'; state.coolant = false; state.cycle = null; }
  const stopCode = mcodes.find(code => code === 0 || code === 1);
  if (stopCode === 0 || stopCode === 1) {
    const paused = stopCode === 0 || config.optionalStop;
    if (paused) state.paused = { code: stopCode, line: block.line };
    events.push({ kind: 'stop', code: stopCode, paused, line: block.line, position: { ...state.position }, afterSegment: segments.length });
  }
  return { state, segments, events };
}

/** Execute a cursor until an alarm, program stop or end. No timer or wall-clock delay. */
function execute(result: RunResult, config: Configuration): RunResult {
  const cursor = result.continuation!;
  for (let index = cursor.nextBlock; index < cursor.blocks.length; index++) {
    const block = cursor.blocks[index]!;
    try {
      const next = executeBlock(block, result.state, config, MAX_SEGMENTS - result.segments.length);
      const offset = result.segments.length;
      result.state = next.state;
      result.events.push(...next.events.map(event => ({ ...event, afterSegment: event.afterSegment + offset })));
      result.segments.push(...next.segments);
      cursor.nextBlock = index + 1;
      if (result.state.ended) { result.continuation = null; return result; }
      if (result.state.paused) return result;
    } catch (error) {
      if (!(error instanceof NcError)) throw error;
      result.alarms.push({ code: error.code, detail: error.detail, line: block.line });
      result.continuation = null;
      return result;
    }
  }
  result.continuation = null;
  return result;
}

/** Parse first; a syntax error prevents all execution. Options are snapshotted for Continue. */
export function runProgram(source: string, options: InterpreterOptions = {}): RunResult {
  const result: RunResult = { state: options.initialModalState ? structuredClone(options.initialModalState) : initialState(options.initialPosition), segments: [], alarms: [], warnings: [], events: [], continuation: null };
  let config: Configuration;
  try { config = configure(options); }
  catch (error) {
    if (!(error instanceof NcError)) throw error;
    return { ...result, state: initialState(), alarms: [{ code: error.code, detail: error.detail, line: 0 }] };
  }
  const parsed = parseProgram(source, options);
  result.warnings = parsed.warnings;
  result.alarms = parsed.alarms;
  if (parsed.alarms.length) return result;
  result.continuation = { blocks: parsed.blocks, nextBlock: 0, options: structuredClone(options) };
  return execute(result, config);
}

/** Continue the same immutable program/options snapshot, without replaying completed blocks. */
export function resumeProgram(previous: RunResult): RunResult {
  if (!previous.state.paused || !previous.continuation || previous.alarms.length) return previous;
  const result = structuredClone(previous);
  result.state.paused = null;
  return execute(result, configure(result.continuation!.options));
}

/** Plan one original NC block atomically for the timed control panel. */
export function planBlock(block: Block, state: ModalState, options: InterpreterOptions, budget = MAX_SEGMENTS) {
  try {
    return { ...executeBlock(block, state, configure(options), budget), alarms: [] as import('./types').Alarm[] };
  } catch (error) {
    if (!(error instanceof NcError)) throw error;
    return { state, segments: [], events: [], alarms: [{ code: error.code, detail: error.detail, line: block.line }] };
  }
}
