import type { InterpreterOptions, ModalState, MotionSegment, Vec3 } from './types';

export const zeroVector = (): Vec3 => ({ x: 0, y: 0, z: 0 });
export const defaultWorkOrigin = (): Vec3 => ({ x: -500, y: -250, z: -400 });
export function activeWorkShift(state: ModalState, options: InterpreterOptions): Vec3 {
  const offset = options.wpc ?? options.workOffsets?.[state.workSystem] ?? zeroVector();
  const length = state.lengthOffset === null ? 0 : (options.toolLengths ?? { 1: 0 })[state.lengthOffset] ?? 0;
  return { x: offset.x, y: offset.y, z: offset.z + length };
}
export function machineToWork(point: Vec3, shift: Vec3, rotation = 0): Vec3 {
  const x = point.x - shift.x, y = point.y - shift.y, angle = rotation * Math.PI / 180;
  return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle), z: point.z - shift.z };
}
/** Transform endpoints AND arc centers with the move's saved frame, never live setup data. */
export function segmentInWorkCoordinates(segment: MotionSegment): MotionSegment {
  return {
    ...segment, from: machineToWork(segment.from, segment.workShift, segment.workRotation), to: machineToWork(segment.to, segment.workShift, segment.workRotation),
    ...('center' in segment ? { center: machineToWork(segment.center, segment.workShift, segment.workRotation) } : {}),
  };
}
