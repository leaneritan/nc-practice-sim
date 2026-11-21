import { createStock } from '../stock';
import type { LessonTarget, RectangleGoal } from '../../lessons/types';

function distanceToBox(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
}
function inPocket(x: number, y: number, r: RectangleGoal) {
  return distanceToBox(x, y, r.x + r.radius, r.y + r.radius, r.x + r.width - r.radius, r.y + r.height - r.radius) <= r.radius + 1e-7;
}
function inContour(x: number, y: number, r: RectangleGoal) {
  const x0 = r.x - r.radius, x1 = r.x + r.width + r.radius, y0 = r.y - r.radius, y1 = r.y + r.height + r.radius;
  return Math.min(distanceToBox(x, y, x0, y0, x1, y0), distanceToBox(x, y, x1, y0, x1, y1),
    distanceToBox(x, y, x0, y1, x1, y1), distanceToBox(x, y, x0, y0, x0, y1)) <= r.radius + 1e-7;
}
/** Analytic design surface: never derived by running the solution through the interpreter. */
export function targetHeight(target: LessonTarget, x: number, y: number): number {
  let z = target.face;
  if (target.pocket && inPocket(x, y, target.pocket)) z = Math.min(z, target.pocket.bottom);
  if (target.contour && inContour(x, y, target.contour)) z = Math.min(z, target.contour.bottom);
  for (const h of target.holes) {
    const radius = Math.hypot(x - h.x, y - h.y);
    if (radius <= h.spotDiameter / 2 + 1e-7) z = Math.min(z, h.top - h.spotDiameter / 2 + radius); // 90° spot
    if (radius <= h.diameter / 2 + 1e-7) z = Math.min(z, h.bottom + radius / Math.tan(59 * Math.PI / 180)); // 118° point
    if (h.tap && radius <= h.tap.diameter / 2 + 1e-7) z = Math.min(z, h.tap.bottom);
    if (h.counterbore && radius <= h.counterbore.diameter / 2 + 1e-7) z = Math.min(z, h.counterbore.bottom);
  }
  return z;
}
export function targetStock(target: LessonTarget) {
  const stock = createStock();
  for (let y = 0; y < stock.height; y++) for (let x = 0; x < stock.width; x++) stock.heights[y * stock.width + x] = targetHeight(target, x * stock.cell, y * stock.cell);
  return stock;
}
