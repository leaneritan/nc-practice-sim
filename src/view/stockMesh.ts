import type { Heightmap } from '../nc/stock';
/** Closed triangle mesh: heightfield top, four walls down to Z-20, and bottom. */
export function stockVertices(map: Heightmap): number[] {
  const vertices: number[] = [];
  type Point = [number, number, number];
  const point = (x: number, y: number): Point => [x * map.cell, y * map.cell, map.heights[y * map.width + x]!];
  const bottom = (p: Point): Point => [p[0], p[1], -20];
  const quad = (a: Point, b: Point, c: Point, d: Point) => vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let y = 0; y < map.height - 1; y++) for (let x = 0; x < map.width - 1; x++) quad(point(x,y), point(x+1,y), point(x+1,y+1), point(x,y+1));
  for (let x = 0; x < map.width - 1; x++) for (const y of [0, map.height - 1]) {
    const a = point(x,y), b = point(x+1,y); quad(a,b,bottom(b),bottom(a));
  }
  for (let y = 0; y < map.height - 1; y++) for (const x of [0, map.width - 1]) {
    const a = point(x,y), b = point(x,y+1); quad(a,b,bottom(b),bottom(a));
  }
  quad(bottom(point(0,0)),bottom(point(0,map.height-1)),bottom(point(map.width-1,map.height-1)),bottom(point(map.width-1,0)));
  return vertices;
}
