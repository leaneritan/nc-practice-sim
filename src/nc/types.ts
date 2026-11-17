/** All distances are millimetres; feed is mm/min and spindle speed is rpm. */
export interface Vec3 { x: number; y: number; z: number }
export type WorkSystem = 54 | 55 | 56 | 57 | 58 | 59;
export type MotionMode = 0 | 1 | 2 | 3 | 81 | 83 | null;
export type AlarmCode =
  | 'syntax' | 'comment' | 'unsupportedWord' | 'unsupportedCode' | 'duplicateWord'
  | 'modalConflict' | 'invalidValue' | 'missingFeed' | 'missingMotion'
  | 'missingOffset' | 'arcDefinition' | 'arcGeometry' | 'cycleParameters'
  | 'cycleFrameChange' | 'unexpectedWord' | 'limit' | 'configuration';
export interface Alarm {
  code: AlarmCode;
  /** Physical source line, not the optional N word. Line 0 denotes configuration. */
  line: number;
  detail: string;
}
export interface Word { letter: string; value: number }
export interface Block { line: number; words: Word[] }
export interface ParseResult { blocks: Block[]; alarms: Alarm[] }
export interface DrillCycle {
  kind: 81 | 83;
  /** Machine-space planes, captured when the cycle is first called. */
  initialZ: number;
  r: number;
  depth: number;
  q?: number;
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
  feed: number;
  speed: number;
  selectedTool: number | null;
  tool: number | null;
  spindle: 'off' | 'cw' | 'ccw';
  coolant: boolean;
  retract: 98 | 99;
  cycle: DrillCycle | null;
  ended: boolean;
}
interface SegmentBase {
  line: number;
  /** Machine reference-point coordinates, including WCS and active tool length. */
  from: Vec3;
  to: Vec3;
  feed: number | null;
  workSystem: WorkSystem;
  lengthOffset: number | null;
  tool: number | null;
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
  initialPosition?: Vec3;
  workOffsets?: Partial<Record<WorkSystem, Vec3>>;
  toolLengths?: Record<number, number>;
  /** G83 rapid re-entry stays this far above the preceding peck bottom. */
  peckClearance?: number;
}
export interface RunResult {
  segments: MotionSegment[];
  state: ModalState;
  alarms: Alarm[];
}
