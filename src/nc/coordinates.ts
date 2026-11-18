import type { InterpreterOptions, ModalState, MotionSegment, Vec3 } from './types';

export const zeroVector = (): Vec3 => ({ x: 0, y: 0, z: 0 });
export function activeWorkShift(state: ModalState, options: InterpreterOptions): Vec3 {
  const offset = options.workOffsets?.[state.workSystem] ?? zeroVector();
  const length = state.lengthOffset === null ? 0 : (options.toolLengths ?? { 1: 0 })[state.lengthOffset] ?? 0;
  return { x: offset.x, y: offset.y, z: offset.z + length };
}
export function machineToWork(point: Vec3, shift: Vec3): Vec3 {
  return { x: point.x - shift.x, y: point.y - shift.y, z: point.z - shift.z };
}
/** Translate endpoints AND arc centers with the move's saved frame, never live tool data. */
export function segmentInWorkCoordinates(segment: MotionSegment): MotionSegment {
  return {
    ...segment, from: machineToWork(segment.from, segment.workShift), to: machineToWork(segment.to, segment.workShift),
    ...('center' in segment ? { center: machineToWork(segment.center, segment.workShift) } : {}),
  };
}
