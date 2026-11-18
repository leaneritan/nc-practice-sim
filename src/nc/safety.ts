import type { Alarm, MotionSegment, Vec3 } from './types';
import { createStock, cutAt, pathLength, physicalTip, pointAt, stockBox, visitFootprint, viseBoxes } from './stock';
import type { Box, CuttingTool, Heightmap } from './stock';

export interface SafetySetup {
  tools: CuttingTool[];
  /** Fixed stock placement, in machine coordinates; independent of the active G54–G59. */
  stockOrigin: Vec3;
  travel: Box;
  /** Explicit intended pocket width, since EIA paths do not encode feature boundaries. 0 disables this check. */
  pocketWidth: number;
}
export const verticalTravel: Box = { min: { x: -1020, y: -510, z: -460 }, max: { x: 0, y: 0, z: 0 } };
const axes = ['x', 'y', 'z'] as const;
export function validSafety(setup: SafetySetup): boolean {
  return axes.every(a => Number.isFinite(setup.stockOrigin[a]) && Math.abs(setup.stockOrigin[a]) <= 1e6 &&
    Number.isFinite(setup.travel.min[a]) && Number.isFinite(setup.travel.max[a]) && setup.travel.min[a] < setup.travel.max[a]) &&
    Number.isFinite(setup.pocketWidth) && setup.pocketWidth >= 0 && setup.pocketWidth <= 1000 &&
    setup.tools.length <= 20 && new Set(setup.tools.map(t => t.pocket)).size === setup.tools.length &&
    setup.tools.every(t => Number.isInteger(t.pocket) && t.pocket >= 1 && t.pocket <= 20 &&
      ['endMill','faceMill','centerDrill','drill','tap','reamer','chamfer','ballMill'].includes(t.kind) &&
      Number.isFinite(t.actual) && t.actual > 0 && t.actual <= 1000 && Number.isFinite(t.length) && t.length > 0 && t.length <= 10000);
}
export function outsideTravel(point: Vec3, box: Box): boolean {
  return axes.some(a => point[a] < box.min[a] - 1e-7 || point[a] > box.max[a] + 1e-7);
}
function overlaps(tip: Vec3, radius: number, box: Box): boolean {
  return Math.hypot(Math.max(box.min.x - tip.x, 0, tip.x - box.max.x), Math.max(box.min.y - tip.y, 0, tip.y - box.max.y)) < radius - 1e-7;
}
/** Check the entire swept move (including arc extrema) before committing a source block.
 * The stock copy evolves between pecks, so rapid re-entry into a cleared hole is allowed.
 */
export function inspectMotions(segments: MotionSegment[], setup: SafetySetup, stock = createStock()): { stock: Heightmap; alarms: Alarm[] } {
  const next = { ...stock, heights: stock.heights.slice() };
  let changed = false;
  let budget = 2_000_000;
  for (const segment of segments) {
    const alarm = (code: Alarm['code'], detail: string) => ({ stock, alarms: [{ code, detail, line: segment.line }] });
    if (outsideTravel(segment.from, setup.travel) || outsideTravel(segment.to, setup.travel)) return alarm('travelLimit', 'XYZ');
    if ('center' in segment) {
      const start = Math.atan2(segment.from.y - segment.center.y, segment.from.x - segment.center.x);
      const direction = segment.kind === 'arcCW' ? -1 : 1;
      for (let q = 0; q < 4; q++) {
        const delta = ((direction * (q * Math.PI / 2 - start)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        if (delta < segment.sweep && outsideTravel(pointAt(segment, delta / segment.sweep), setup.travel)) return alarm('travelLimit', 'XY arc');
      }
    }
    const tool = setup.tools.find(t => t.pocket === segment.tool);
    if (segment.tool !== null && !tool) return alarm('toolMissing', `T${segment.tool}`);
    const steps = Math.max(1, Math.ceil(pathLength(segment) / .5));
    if (steps > budget) return alarm('limit', 'simulation');
    budget -= steps;
    for (let i = 0; i <= steps; i++) {
      const tip = physicalTip(pointAt(segment, i / steps), setup.stockOrigin, tool);
      const inStock = overlaps(tip, tool ? tool.actual / 2 : .001, stockBox);
      if (inStock && tip.z < 0 - 1e-6) {
        if (!tool) return alarm('toolMissing', 'T / M06');
        if (segment.kind !== 'rapid' && segment.lengthOffset === null) return alarm('lengthRequired', 'G43 H');
        if (tip.z < stockBox.min.z - 1e-6) return alarm('belowStock', 'Z');
      }
      if (tool && viseBoxes.some(box => overlaps(tip, tool.actual / 2, box) && tip.z < box.max.z - 1e-6 && tip.z + tool.length > box.min.z + 1e-6)) return alarm('viseCollision', `T${tool.pocket}`);
      if (!tool || !inStock || tip.z >= 0) continue;
      let contact = false; let samples = 0;
      visitFootprint(next, tool, tip, (index, surface) => { samples++; if (surface < next.heights[index]! - 1e-4) contact = true; });
      // Sub-grid cutters may cover no node. Conservatively treat the nearest cell as uncut.
      if (!samples) {
        const x = Math.max(0, Math.min(next.width - 1, Math.round(tip.x / next.cell)));
        const y = Math.max(0, Math.min(next.height - 1, Math.round(tip.y / next.cell)));
        contact = tip.z < next.heights[y * next.width + x]! - 1e-4;
      }
      if (!contact) continue;
      if (segment.kind === 'rapid') return alarm('rapidStock', `T${tool.pocket}`);
      if (segment.spindle === 'off' || segment.speed <= 0) return alarm('spindleStopped', 'M03/M04 S');
      if (setup.pocketWidth > 0 && tool.actual > setup.pocketWidth) return alarm('pocketDiameter', `${tool.actual} > ${setup.pocketWidth}`);
      changed = cutAt(next, tool, tip) || changed;
    }
  }
  return { stock: changed ? { ...next, revision: stock.revision + 1 } : stock, alarms: [] };
}
