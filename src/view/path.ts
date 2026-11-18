import type { MotionSegment, Vec3 } from '../nc';

export type ViewPlane = 'XY' | 'XZ';
export interface Point2 { u: number; v: number }
export interface Outline { min: Vec3; max: Vec3 }
export { stockBox as stock, viseBoxes as vise } from '../nc/stock';
export function project(point: Vec3, plane: ViewPlane): Point2 {
  return { u: point.x, v: plane === 'XY' ? point.y : point.z };
}

/** Sample the actual circular path, including exact quadrant extrema, not its chord. */
export function sampleSegment(segment: MotionSegment, maxSteps = 180): Vec3[] {
  if (!('center' in segment)) return [segment.from, segment.to];
  const start = Math.atan2(segment.from.y - segment.center.y, segment.from.x - segment.center.x);
  const direction = segment.kind === 'arcCW' ? -1 : 1;
  const steps = Math.max(2, Math.min(maxSteps, Math.ceil(segment.sweep / (Math.PI / 90))));
  const fractions = new Set(Array.from({ length: steps + 1 }, (_, index) => index / steps));
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const angle = quadrant * Math.PI / 2;
    const distance = ((direction * (angle - start)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    if (distance > 0 && distance < segment.sweep) fractions.add(distance / segment.sweep);
  }
  return [...fractions].sort((a, b) => a - b).map(fraction => {
    if (fraction === 0) return segment.from;
    if (fraction === 1) return segment.to;
    const angle = start + direction * fraction * segment.sweep;
    return {
      x: segment.center.x + Math.cos(angle) * segment.radius,
      y: segment.center.y + Math.sin(angle) * segment.radius,
      z: segment.from.z + fraction * (segment.to.z - segment.from.z),
    };
  });
}
export function pathGeometry(segments: MotionSegment[]) {
  // Bound rendering work for large valid programs independently of canvas pixel size.
  const budgetPerArc = Math.max(4, Math.floor(60_000 / Math.max(1, segments.length)));
  return segments.map(segment => ({ kind: segment.kind, points: sampleSegment(segment, budgetPerArc) }));
}
export interface Bounds { minU: number; maxU: number; minV: number; maxV: number }
export function boundsFor(points: Point2[]): Bounds {
  const bounds = { minU: 0, maxU: 0, minV: 0, maxV: 0 };
  for (const point of points) {
    bounds.minU = Math.min(bounds.minU, point.u);
    bounds.maxU = Math.max(bounds.maxU, point.u);
    bounds.minV = Math.min(bounds.minV, point.v);
    bounds.maxV = Math.max(bounds.maxV, point.v);
  }
  return bounds;
}
/** Equal scale on both axes keeps circles circular; screen Y grows downwards. */
export function fitTransform(bounds: Bounds, width: number, height: number, padding = 34) {
  const spanU = Math.max(1, bounds.maxU - bounds.minU);
  const spanV = Math.max(1, bounds.maxV - bounds.minV);
  const scale = Math.min((width - 2 * padding) / spanU, (height - 2 * padding) / spanV);
  const midU = (bounds.minU + bounds.maxU) / 2;
  const midV = (bounds.minV + bounds.maxV) / 2;
  return { scale, toPixel: (point: Point2) => ({ u: width / 2 + (point.u - midU) * scale, v: height / 2 - (point.v - midV) * scale }) };
}
