import type { Heightmap } from './stock';
import type { SafetySetup } from './safety';
/** All distances are millimetres; feed is mm/min and spindle speed is rpm. */
export interface Vec3 { x: number; y: number; z: number }
export type WorkSystem = 54 | 55 | 56 | 57 | 58 | 59;
export type MotionMode = 0 | 1 | 2 | 3 | 81 | 82 | 83 | 84 | null;
export type AlarmCode =
  | 'syntax' | 'comment' | 'unsupportedWord' | 'unsupportedCode' | 'duplicateWord'
  | 'modalConflict' | 'invalidValue' | 'missingFeed' | 'missingMotion'
  | 'missingOffset' | 'arcDefinition' | 'arcGeometry' | 'cycleParameters'
  | 'spindleStopped' | 'rapidStock' | 'viseCollision' | 'belowStock' | 'lengthRequired'
  | 'travelLimit' | 'toolMissing' | 'pocketDiameter' | 'toolChangeUnsafe'
  | 'cycleFrameChange' | 'unexpectedWord' | 'limit' | 'configuration' | 'tappingSpindle';
export interface Alarm {
  code: AlarmCode;
  /** Physical source line, not the optional N word. Line 0 denotes configuration. */
  line: number;
  detail: string;
}
export interface Word {
  letter: string;
  value: number;
  /** Original numeric spelling; preserve the decimal point for control-style input. */
  raw: string;
}
export interface DecimalWarning {
  line: number;
  word: string;
  interpreted: number;
  strictValue: number;
}
export interface ParseOptions { strictDecimals?: boolean }
export interface Block { line: number; words: Word[] }
export interface ParseResult { blocks: Block[]; alarms: Alarm[]; warnings: DecimalWarning[] }
export interface DrillCycle {
  kind: 81 | 82 | 83 | 84;
  /** Machine-space planes, captured when the cycle is first called. */
  initialZ: number;
  r: number;
  depth: number;
  q?: number;
  dwellMs?: number;
}
export interface ModalState {
  position: Vec3;
  motion: MotionMode;
  distance: 'absolute' | 'incremental';
  plane: 17;
  units: 'mm';
  feedMode: 94;
  workSystem: WorkSystem;
  lengthOffset: number | null;
  diameterOffset: number;
  feed: number;
  speed: number;
  selectedTool: number | null;
  tool: number | null;
  spindle: 'off' | 'cw' | 'ccw';
  coolant: boolean;
  retract: 98 | 99;
  cycle: DrillCycle | null;
  ended: boolean;
  paused: { code: 0 | 1; line: number } | null;
}
interface SegmentBase {
  /** Frozen machine-to-work translation for this move, including active H. */
  workShift: Vec3;
  coolant: boolean;
  cycle: DrillCycle['kind'] | null;
  line: number;
  /** Machine reference-point coordinates, including WCS and active tool length. */
  from: Vec3;
  to: Vec3;
  feed: number | null;
  workSystem: WorkSystem;
  lengthOffset: number | null;
  tool: number | null;
  diameterOffset: number;
  spindle: 'off' | 'cw' | 'ccw';
  speed: number;
}
export type MotionSegment =
  | (SegmentBase & { kind: 'rapid' | 'linear' })
  | (SegmentBase & {
      kind: 'arcCW' | 'arcCCW';
      center: Vec3;
      radius: number;
      /** Positive swept angle in radians, up to 2π. Z may interpolate helically. */
      sweep: number;
    });
export interface InterpreterOptions {
  safety?: SafetySetup;
  initialStock?: Heightmap;
  initialPosition?: Vec3;
  /** Used by MDI/preview to continue from an existing modal state. */
  initialModalState?: ModalState;
  /** Machine reference point for G28; default (0, 0, 0). */
  referencePosition?: Vec3;
  strictDecimals?: boolean;
  optionalStop?: boolean;
  workOffsets?: Partial<Record<WorkSystem, Vec3>>;
  toolLengths?: Record<number, number>;
  /** G83 rapid re-entry stays this far above the preceding peck bottom. */
  peckClearance?: number;
}
export type ProgramEvent = {
  line: number;
  position: Vec3;
  /** Number of completed segments before this event. */
  afterSegment: number;
} & (
  | { kind: 'toolChange'; fromTool: number | null; tool: number; durationMs: number }
  | { kind: 'dwell'; durationMs: number }
  | { kind: 'spindle'; direction: 'cw' | 'ccw' }
  | { kind: 'stop'; code: 0 | 1; paused: boolean }
);
export interface ExecutionCursor {
  blocks: Block[];
  nextBlock: number;
  options: InterpreterOptions;
}
export interface RunResult {
  stock?: Heightmap;
  segments: MotionSegment[];
  state: ModalState;
  alarms: Alarm[];
  warnings: DecimalWarning[];
  events: ProgramEvent[];
  continuation: ExecutionCursor | null;
}
