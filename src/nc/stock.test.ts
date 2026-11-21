// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createStock, cutAt, physicalTip, pointAt, removeMaterial, removedVolume, toolSurface } from './stock';
import { runProgram } from './interpreter';
import { stockVertices } from '../view/stockMesh';
const flat = { pocket: 1, kind: 'endMill' as const, actual: 6, length: 120 };
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

describe('heightmap cutter geometry', () => {
  it.each(['G2', 'G3'])('cuts the exact circular wall, including tangent grid nodes, for %s', code => {
    const s = runProgram(`M3 S1000 ${code} X23. Y20. I-3. J0. F100`, { initialPosition: v(23,20,-3) }).segments[0]!;
    const tool = { ...flat, length: 0 }, before = createStock();
    const map = removeMaterial(before, s, tool, v());
    for (const [x,y] of [[20,14],[20,26],[14,20],[26,20]]) expect(map.heights[y! * 101 + x!]).toBe(-3);
    expect(map.heights[20 * 101 + 27]).toBe(0);
    const partial = removeMaterial(before, s, tool, v(), 0, .25);
    expect(partial.heights[20 * 101 + 14]).toBe(0);
    expect(removedVolume(before)).toBe(0);
    const completed = removeMaterial(partial, s, tool, v(), .25, 1);
    expect(completed.heights).toEqual(map.heights);
  });
  it('starts as a 100 × 60 × 20 block with zero removed volume', () => {
    const map = createStock(); expect(map.heights).toHaveLength(6161); expect(removedVolume(map)).toBe(0);
    const vertices = stockVertices(map); expect(vertices.length % 9).toBe(0);
    expect(Math.min(...vertices.filter((_, i) => i % 3 === 2))).toBe(-20);
  });
  it.each(['endMill', 'faceMill', 'tap', 'reamer'] as const)('uses a flat envelope for %s', kind => {
    expect(toolSurface({ ...flat, kind }, 2)).toBe(0); expect(toolSurface({ ...flat, kind }, 4)).toBe(Infinity);
  });
  it('uses ball and 118-degree drill profiles with a deeper center', () => {
    expect(toolSurface({ ...flat, kind: 'ballMill' }, 0)).toBe(0);
    expect(toolSurface({ ...flat, kind: 'ballMill' }, 3)).toBe(3);
    expect(toolSurface({ ...flat, kind: 'drill' }, 3)).toBeCloseTo(3 / Math.tan(59 * Math.PI / 180));
    expect(toolSurface({ ...flat, kind: 'centerDrill' }, 2)).toBe(2);
    expect(toolSurface({ ...flat, kind: 'chamfer' }, 2)).toBe(2);
  });
  it('cuts a local footprint, never adds material, and clamps to stock bottom', () => {
    const map = createStock(); expect(cutAt(map, flat, v(20,20,-5))).toBe(true);
    expect(map.heights[20 * 101 + 20]).toBe(-5); expect(map.heights[20 * 101 + 24]).toBe(0);
    expect(cutAt(map, flat, v(20,20,-2))).toBe(false); cutAt(map, flat, v(20,20,-30));
    expect(map.heights[20 * 101 + 20]).toBe(-20); expect(removedVolume(map)).toBeGreaterThan(0);
  });
  it('distinguishes ball and drill holes from flat holes', () => {
    for (const kind of ['ballMill', 'drill'] as const) {
      const map = createStock(); cutAt(map, { ...flat, kind }, v(20,20,-5));
      expect(map.heights[20 * 101 + 20]).toBe(-5); expect(map.heights[20 * 101 + 22]).toBeGreaterThan(-5);
    }
  });
  it('removes only the traversed part, immutably, and ignores rapids/stopped spindle', () => {
    const segment = runProgram('M3 S1000 G1 X80. F100', { initialPosition: v(20,20,-2) }).segments[0]!;
    const before = createStock(); const after = removeMaterial(before, segment, { ...flat, length: 0 }, v(), 0, .5);
    expect(after.heights[20 * 101 + 40]).toBe(-2); expect(after.heights[20 * 101 + 70]).toBe(0);
    expect(removedVolume(before)).toBe(0); expect(after.revision).toBe(1);
    expect(removeMaterial(after, { ...segment, kind: 'rapid' }, flat, v())).toBe(after);
    expect(removeMaterial(after, { ...segment, spindle: 'off' }, flat, v())).toBe(after);
    expect(removeMaterial(after, segment, undefined, v())).toBe(after);
  });
  it('samples CW/CCW helices and physical length independently of H', () => {
    const ccw = runProgram('G3 X10. Y10. Z-4. I0. J10. F100').segments[0]!;
    expect(pointAt(ccw,.5).z).toBe(-2); expect(pointAt(ccw,0)).toEqual(ccw.from); expect(pointAt(ccw,1)).toEqual(ccw.to);
    const cw = runProgram('G2 X10. Y-10. I0. J-10. F100').segments[0]!;
    expect(pointAt(cw,.5).y).toBeLessThan(0);
    expect(physicalTip(v(-480,-230,-282),v(-500,-250,-400),flat)).toEqual(v(20,20,-2));
    expect(physicalTip(v(1,2,3),v())).toEqual(v(1,2,3));
  });
});
