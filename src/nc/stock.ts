import type { MotionSegment, Vec3 } from './types';

export type ToolKind = 'endMill' | 'faceMill' | 'centerDrill' | 'drill' | 'tap' | 'reamer' | 'chamfer' | 'ballMill';
export interface CuttingTool { pocket: number; kind: ToolKind; actual: number; length: number }
export interface Box { min: Vec3; max: Vec3 }
export const stockBox: Box = { min: { x: 0, y: 0, z: -20 }, max: { x: 100, y: 60, z: 0 } };
export const viseBoxes: Box[] = [
  { min: { x: -10, y: -10, z: -30 }, max: { x: 110, y: 0, z: -5 } },
  { min: { x: -10, y: 60, z: -30 }, max: { x: 110, y: 70, z: -5 } },
  { min: { x: -15, y: -15, z: -35 }, max: { x: 115, y: 75, z: -30 } },
];
export interface Heightmap { width: number; height: number; cell: number; heights: Float32Array; revision: number }
/** One millimetre grid, including the stock boundary. Z is the highest remaining surface. */
export function createStock(): Heightmap {
  return { width: 101, height: 61, cell: 1, heights: new Float32Array(101 * 61), revision: 0 };
}
export function toolSurface(tool: CuttingTool, radiusAtPoint: number): number {
  const radius = tool.actual / 2;
  if (radiusAtPoint > radius + 1e-7) return Infinity;
  if (tool.kind === 'ballMill') return radius - Math.sqrt(Math.max(0, radius * radius - radiusAtPoint * radiusAtPoint));
  // A conventional 118° drill point; center drills/chamfer cutters use a 90° included angle.
  if (tool.kind === 'drill') return radiusAtPoint / Math.tan(59 * Math.PI / 180);
  if (tool.kind === 'centerDrill' || tool.kind === 'chamfer') return radiusAtPoint;
  return 0;
}
export function pointAt(segment: MotionSegment, fraction: number): Vec3 {
  if (fraction === 0) return { ...segment.from };
  if (fraction === 1) return { ...segment.to };
  const z = segment.from.z + fraction * (segment.to.z - segment.from.z);
  if ('center' in segment) {
    const start = Math.atan2(segment.from.y - segment.center.y, segment.from.x - segment.center.x);
    const angle = start + (segment.kind === 'arcCW' ? -1 : 1) * segment.sweep * fraction;
    return { x: segment.center.x + segment.radius * Math.cos(angle), y: segment.center.y + segment.radius * Math.sin(angle), z };
  }
  return { x: segment.from.x + fraction * (segment.to.x - segment.from.x), y: segment.from.y + fraction * (segment.to.y - segment.from.y), z };
}
export function pathLength(segment: MotionSegment): number {
  return 'sweep' in segment ? Math.hypot(segment.radius * segment.sweep, segment.to.z - segment.from.z) :
    Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y, segment.to.z - segment.from.z);
}
/** Fixed physical fixture: actual tool length, not the programmed H, determines collision/removal. */
export function physicalTip(machine: Vec3, origin: Vec3, tool?: CuttingTool): Vec3 {
  return { x: machine.x - origin.x, y: machine.y - origin.y, z: machine.z - origin.z - (tool?.length ?? 0) };
}
export function visitFootprint(map: Heightmap, tool: CuttingTool, tip: Vec3, visit: (index: number, surface: number) => void) {
  const radius = tool.actual / 2;
  const x0 = Math.max(0, Math.ceil((tip.x - radius) / map.cell));
  const x1 = Math.min(map.width - 1, Math.floor((tip.x + radius) / map.cell));
  const y0 = Math.max(0, Math.ceil((tip.y - radius) / map.cell));
  const y1 = Math.min(map.height - 1, Math.floor((tip.y + radius) / map.cell));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const surface = tip.z + toolSurface(tool, Math.hypot(x * map.cell - tip.x, y * map.cell - tip.y));
    if (Number.isFinite(surface)) visit(y * map.width + x, surface);
  }
}
export function cutAt(map: Heightmap, tool: CuttingTool, tip: Vec3): boolean {
  let changed = false;
  visitFootprint(map, tool, tip, (index, surface) => {
    const next = Math.max(stockBox.min.z, surface);
    if (next < map.heights[index]! - 1e-6) { map.heights[index] = next; changed = true; }
  });
  return changed;
}
/** Incremental immutable stock update, used for the partially traversed live motion. */
export function removeMaterial(map: Heightmap, segment: MotionSegment, tool: CuttingTool | undefined, origin: Vec3, from = 0, to = 1): Heightmap {
  if (!tool || segment.kind === 'rapid' || segment.spindle === 'off' || segment.speed <= 0 || to <= from) return map;
  const next = { ...map, heights: map.heights.slice() };
  // Keep the sampling grid anchored to the whole segment, independent of UI tick size.
  const steps = Math.max(1, Math.ceil(pathLength(segment) / .5));
  let changed = false;
  for (let i = Math.ceil(from * steps - 1e-8); i <= Math.floor(to * steps + 1e-8); i++) {
    changed = cutAt(next, tool, physicalTip(pointAt(segment, i / steps), origin, tool)) || changed;
  }
  changed = cutAt(next, tool, physicalTip(pointAt(segment, to), origin, tool)) || changed;
  return changed ? { ...next, revision: map.revision + 1 } : map;
}
export function removedVolume(map: Heightmap): number {
  // Trapezoidal boundary weights avoid counting an extra row/column of material.
  let volume = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    volume -= map.heights[y * map.width + x]! * map.cell ** 2 * (x === 0 || x === map.width - 1 ? .5 : 1) * (y === 0 || y === map.height - 1 ? .5 : 1);
  }
  return volume;
}
