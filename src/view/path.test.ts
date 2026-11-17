// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runProgram } from '../nc';
import { boundsFor, fitTransform, pathGeometry, project, sampleSegment, stock, vise } from './path';

function motion(source: string) {
  const result = runProgram(source);
  expect(result.alarms).toEqual([]);
  return result.segments.at(-1)!;
}

describe('orthographic path geometry', () => {
  it('projects XY and XZ with Z up and no axis swapping', () => {
    expect(project({ x: 2, y: 3, z: -4 }, 'XY')).toEqual({ u: 2, v: 3 });
    expect(project({ x: 2, y: 3, z: -4 }, 'XZ')).toEqual({ u: 2, v: -4 });
  });
  it('retains rapid and straight feed endpoints and kinds', () => {
    const segments = runProgram('G0 X10. Z5.\nG1 Y20. F100').segments;
    expect(pathGeometry(segments).map(p => p.kind)).toEqual(['rapid', 'linear']);
    expect(sampleSegment(segments[1]!)).toEqual([segments[1]!.from, segments[1]!.to]);
  });
  it.each([2, 3])('samples G%i full circles with exact extrema, not a straight chord', code => {
    const arc = motion(`G${code} I10. F100`);
    const points = sampleSegment(arc);
    const bounds = boundsFor(points.map(p => project(p, 'XY')));
    expect(points.length).toBeGreaterThan(100);
    expect(bounds.minU).toBeCloseTo(0);
    expect(bounds.maxU).toBeCloseTo(20);
    expect(bounds.minV).toBeCloseTo(-10);
    expect(bounds.maxV).toBeCloseTo(10);
    expect(points[0]).toEqual(points.at(-1));
    expect(Math.sign(points[1]!.y)).toBe(code === 2 ? 1 : -1);
  });
  it('follows a major signed-R arc including its furthest extent', () => {
    const arc = motion('G3 X10. R-10. F100');
    const geometry = sampleSegment(arc, 4);
    const bounds = boundsFor(geometry.map(p => project(p, 'XY')));
    expect(bounds.minV).toBeCloseTo(-Math.sqrt(75) - 10);
    expect(bounds.minU).toBeCloseTo(-5);
    expect(bounds.maxU).toBeCloseTo(15);
  });
  it('interpolates helical Z along the arc and keeps exact endpoints', () => {
    const arc = motion('G3 X10. Y10. Z-10. I0. J10. F100');
    const points = sampleSegment(arc, 4);
    expect(points[0]).toEqual(arc.from);
    expect(points.at(-1)).toEqual(arc.to);
    expect(points[2]?.z).toBeCloseTo(-5);
    expect(points[2]?.x).toBeCloseTo(Math.sqrt(50));
    expect(points[2]?.y).toBeCloseTo(10 - Math.sqrt(50));
  });
  it('bounds total arc sampling work for large programs', () => {
    const segment = motion('G3 I10. F100');
    const paths = pathGeometry(Array.from({ length: 20000 }, () => segment));
    expect(paths.reduce((count, path) => count + path.points.length, 0)).toBeLessThanOrEqual(180000);
  });
  it('lays out stock below Z0 with jaws contacting opposite Y faces', () => {
    expect(stock.max.x - stock.min.x).toBe(100);
    expect(stock.max.y - stock.min.y).toBe(60);
    expect(stock.max.z - stock.min.z).toBe(20);
    expect(stock.max.z).toBe(0);
    expect(vise[0]?.max.y).toBe(stock.min.y);
    expect(vise[1]?.min.y).toBe(stock.max.y);
  });
  it('fits every point and preserves equal scales with upward-positive screen axes', () => {
    const bounds = { minU: -10, maxU: 110, minV: -35, maxV: 80 };
    const { toPixel, scale } = fitTransform(bounds, 500, 300);
    expect(toPixel({ u: -10, v: -35 }).u).toBeGreaterThanOrEqual(34);
    expect(toPixel({ u: 110, v: 80 }).u).toBeLessThanOrEqual(466);
    expect(toPixel({ u: 0, v: 10 }).v).toBeLessThan(toPixel({ u: 0, v: 0 }).v);
    expect(toPixel({ u: 10, v: 0 }).u - toPixel({ u: 0, v: 0 }).u).toBeCloseTo(10 * scale);
    expect(toPixel({ u: 0, v: 0 }).v - toPixel({ u: 0, v: 10 }).v).toBeCloseTo(10 * scale);
  });
  it('handles empty and million-millimetre bounds without invalid transforms', () => {
    expect(boundsFor([])).toEqual({ minU: 0, maxU: 0, minV: 0, maxV: 0 });
    for (const bounds of [boundsFor([]), boundsFor([{ u: 1e6, v: -1e6 }])]) {
      const transform = fitTransform(bounds, 300, 300);
      expect(Number.isFinite(transform.scale)).toBe(true);
      expect(transform.scale).toBeGreaterThan(0);
    }
  });
});
