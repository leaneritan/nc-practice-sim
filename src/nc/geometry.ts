import type { Vec3 } from './types';

const TAU = Math.PI * 2;
export interface Arc { center: Vec3; radius: number; sweep: number }
function sweepAngle(from: Vec3, to: Vec3, center: Vec3, clockwise: boolean): number {
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  const end = Math.atan2(to.y - center.y, to.x - center.x);
  const angle = ((clockwise ? start - end : end - start) + TAU) % TAU;
  return angle < 1e-12 ? TAU : angle;
}

/** I/J are centre displacements from the start, even in absolute distance mode. */
export function arcFromCenter(from: Vec3, to: Vec3, i: number, j: number, clockwise: boolean): Arc | null {
  const center = { x: from.x + i, y: from.y + j, z: from.z };
  const radius = Math.hypot(i, j);
  const endRadius = Math.hypot(to.x - center.x, to.y - center.y);
  if (radius < 1e-9 || Math.abs(endRadius - radius) > Math.max(1e-6, radius * 1e-5)) return null;
  return { center, radius, sweep: sweepAngle(from, to, center, clockwise) };
}

/** Positive R selects the short arc; negative R selects the long arc. */
export function arcFromRadius(from: Vec3, to: Vec3, signedRadius: number, clockwise: boolean): Arc | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  const radius = Math.abs(signedRadius);
  if (radius < 1e-9 || chord < 1e-9 || chord > 2 * radius + 1e-8) return null;
  const height = Math.sqrt(Math.max(0, radius * radius - chord * chord / 4));
  for (const side of [1, -1]) {
    const center = {
      x: (from.x + to.x) / 2 - side * dy / chord * height,
      y: (from.y + to.y) / 2 + side * dx / chord * height,
      z: from.z,
    };
    const sweep = sweepAngle(from, to, center, clockwise);
    if (signedRadius >= 0 ? sweep <= Math.PI + 1e-10 : sweep >= Math.PI - 1e-10) {
      return { center, radius, sweep };
    }
  }
  return null;
}
