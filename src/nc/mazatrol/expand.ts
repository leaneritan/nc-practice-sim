import type { CuttingTool } from "../stock";
import { pointDepth } from "./model";
import type {
  CuttingUnit,
  Edge,
  MazatrolProgram,
  Shape,
  ToolRow,
  XY,
} from "./model";
export type IssueCode =
  | "structure"
  | "value"
  | "limit"
  | "tool"
  | "diameter"
  | "contour"
  | "clearance"
  | "sequence";
export interface Expansion {
  source: string;
  lineUnits: Record<number, string>;
  shapes: { unit: string; points: XY[] }[];
  issues: { unit: string; code: IssueCode }[];
}
class Invalid extends Error {
  constructor(readonly code: IssueCode) {
    super(code);
  }
}
function fail(code: IssueCode): never {
  throw new Invalid(code);
}
const positive = (n: number) => {
  if (!Number.isFinite(n) || n <= 0 || n > 10000) fail("value");
  return n;
};
const count = (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 500) fail("limit");
  return n;
};
const near = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-5;
export function pointsFor(shape: Shape): XY[] {
  const { x, y } = shape;
  if (![x, y].every(Number.isFinite)) fail("value");
  switch (shape.kind) {
    case "PT":
      return [{ x, y }];
    case "LIN":
      return Array.from({ length: count(shape.count) }, (_, i) => ({
        x: x + i * shape.dx,
        y: y + i * shape.dy,
      }));
    case "SQR":
      positive(shape.width);
      positive(shape.height);
      return [
        { x, y },
        { x: x + shape.width, y },
        { x: x + shape.width, y: y + shape.height },
        { x, y: y + shape.height },
      ];
    case "GRD": {
      const n = count(shape.nx) * count(shape.ny);
      if (n > 500) fail("limit");
      return Array.from({ length: n }, (_, i) => ({
        x: x + (i % shape.nx) * shape.dx,
        y: y + Math.floor(i / shape.nx) * shape.dy,
      }));
    }
    case "CIR":
      positive(shape.radius);
      return Array.from({ length: count(shape.count) }, (_, i) => {
        const a = ((shape.angle + (360 * i) / shape.count) * Math.PI) / 180;
        return {
          x: x + shape.radius * Math.cos(a),
          y: y + shape.radius * Math.sin(a),
        };
      });
    default:
      return fail("structure");
  }
}
function arcPoints(from: XY, edge: Extract<Edge, { kind: "ARC" }>): XY[] {
  const r = Math.hypot(from.x - edge.cx, from.y - edge.cy);
  if (
    r < 1e-6 ||
    Math.abs(Math.hypot(edge.x - edge.cx, edge.y - edge.cy) - r) > 1e-5
  )
    fail("contour");
  const start = Math.atan2(from.y - edge.cy, from.x - edge.cx),
    end = Math.atan2(edge.y - edge.cy, edge.x - edge.cx),
    sign = edge.clockwise ? -1 : 1;
  const sweep = near(from, edge)
    ? Math.PI * 2
    : (((sign * (end - start)) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Array.from({ length: 37 }, (_, i) => ({
    x: edge.cx + r * Math.cos(start + (sign * sweep * i) / 36),
    y: edge.cy + r * Math.sin(start + (sign * sweep * i) / 36),
  }));
}
/** LINE OUT offsets a closed convex contour. Linear corners use miters; arcs must join tangentially. */
export function outsideContour(
  start: XY,
  edges: Edge[],
  radius: number,
): { start: XY; edges: Edge[] } {
  positive(radius);
  if (!edges.length || edges.length > 200 || !near(edges.at(-1)!, start))
    fail("contour");
  const sampled: XY[] = [start];
  let previous = start;
  for (const edge of edges) {
    if (edge.kind === "ARC")
      sampled.push(...arcPoints(previous, edge).slice(1));
    else if (edge.kind === "LINE" && !near(previous, edge)) sampled.push(edge);
    else fail("contour");
    previous = edge;
  }
  let area = 0,
    turn = 0;
  for (let i = 0; i < sampled.length - 1; i++)
    area +=
      sampled[i]!.x * sampled[i + 1]!.y - sampled[i + 1]!.x * sampled[i]!.y;
  if (Math.abs(area) < 1e-6) fail("contour");
  const orientation = area > 0 ? 1 : -1;
  const ring = sampled.slice(0, -1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!,
      b = ring[(i + 1) % ring.length]!,
      c = ring[(i + 2) % ring.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross * orientation < -1e-6) fail("contour");
    turn += Math.atan2(
      cross,
      (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y),
    );
  }
  if (Math.abs(Math.abs(turn) - Math.PI * 2) > 0.01) fail("contour");
  previous = start;
  const shifted = edges.map((edge) => {
    const from = previous;
    previous = edge;
    if (edge.kind === "LINE") {
      const dx = edge.x - from.x,
        dy = edge.y - from.y,
        len = Math.hypot(dx, dy);
      const ox = ((orientation * dy) / len) * radius,
        oy = ((-orientation * dx) / len) * radius;
      return {
        from: { x: from.x + ox, y: from.y + oy },
        edge: { ...edge, x: edge.x + ox, y: edge.y + oy } as Edge,
      };
    }
    const r = Math.hypot(from.x - edge.cx, from.y - edge.cy),
      newR = r + (edge.clockwise ? -1 : 1) * orientation * radius;
    if (newR <= 0) fail("diameter");
    const move = (p: XY) => ({
      x: edge.cx + ((p.x - edge.cx) * newR) / r,
      y: edge.cy + ((p.y - edge.cy) * newR) / r,
    });
    return { from: move(from), edge: { ...edge, ...move(edge) } as Edge };
  });
  for (let i = 0; i < shifted.length; i++) {
    const a = shifted[i]!,
      b = shifted[(i + 1) % shifted.length]!;
    if (near(a.edge, b.from)) continue;
    if (a.edge.kind !== "LINE" || b.edge.kind !== "LINE") fail("contour");
    const u = { x: a.edge.x - a.from.x, y: a.edge.y - a.from.y },
      v = { x: b.edge.x - b.from.x, y: b.edge.y - b.from.y };
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) < 1e-9) fail("contour");
    const t = ((b.from.x - a.from.x) * v.y - (b.from.y - a.from.y) * v.x) / det;
    const join = { x: a.from.x + t * u.x, y: a.from.y + t * u.y };
    if (Math.hypot(join.x - a.edge.x, join.y - a.edge.y) > radius * 10)
      fail("contour");
    a.edge = { ...a.edge, ...join };
    b.from = join;
  }
  return { start: shifted[0]!.from, edges: shifted.map((s) => s.edge) };
}
export function expandMazatrol(
  program: MazatrolProgram,
  available: CuttingTool[],
): Expansion {
  const result: Expansion = {
    source: "",
    lineUnits: {},
    shapes: [],
    issues: [],
  };
  const lines: string[] = [];
  let unitId = "";
  try {
    if (
      program.version !== 1 ||
      !Array.isArray(program.units) ||
      program.units.length < 3 ||
      program.units.length > 100
    )
      fail("structure");
    const units = program.units,
      common = units[0],
      wpc = units[1];
    if (
      common?.kind !== "COMMON" ||
      wpc?.kind !== "WPC" ||
      units.at(-1)?.kind !== "END" ||
      new Set(units.map((u) => u.id)).size !== units.length
    )
      fail("structure");
    if (!["A5052", "S45C", "SUS304", "SS400"].includes(common.material))
      fail("value");
    positive(common.initialZ);
    if (![wpc.x, wpc.y, wpc.z, wpc.theta].every(Number.isFinite)) fail("value");
    // Bound nested data before expansion; extensions remain opaque for future control versions.
    let nodes = 0;
    const validate = (value: unknown): void => {
      if (++nodes > 20000) fail("limit");
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) || Math.abs(value) > 10000)
      )
        fail("value");
      if (value && typeof value === "object")
        for (const [k, v] of Object.entries(value))
          if (k !== "extensions") validate(v);
    };
    validate(units);
    // WPC is a part-placement transform within G54, not a replacement machine offset.
    const angle = (wpc.theta * Math.PI) / 180;
    const transform = (p: XY): XY => ({
      x: wpc.x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: wpc.y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
    });
    const n = (v: number) => {
      if (!Number.isFinite(v)) fail("value");
      return (Math.abs(v) < 0.0000001 ? 0 : v).toFixed(4);
    };
    const xy = (p: XY) => {
      const q = transform(p);
      return `X${n(q.x)} Y${n(q.y)}`;
    };
    const z = (v: number) => `Z${n(v + wpc.z)}`;
    const emit = (line: string) => {
      if (lines.length >= 9000) fail("limit");
      lines.push(line);
      result.lineUnits[lines.length] = unitId;
    };
    const retract = () => emit(`G0 ${z(common.initialZ)}`);
    unitId = common.id;
    emit("G21 G17 G90 G94 G40 G80");
    emit("M05 M09");
    emit("G91 G28 Z0.");
    emit("G90 G49 G54");
    for (const unit of units.slice(2, -1)) {
      unitId = unit.id;
      if (!unit.id || unit.id.length > 80 || !("tools" in unit))
        fail("structure");
      const u = unit as CuttingUnit;
      positive(u.depth);
      if (
        u.kind === "POCKET" &&
        u.entry !== undefined &&
        !["ramp", "plunge"].includes(u.entry)
      )
        fail("value");
      if (common.initialZ <= u.top + 1) fail("clearance");
      let points: XY[] = [];
      if ("shapes" in u) {
        positive(u.diameter);
        if (u.kind === "TAPPING") positive(u.pitch);
        if (!u.shapes.length || u.shapes.length > 100) fail("limit");
        points = u.shapes.flatMap(pointsFor);
        if (points.length > 500) fail("limit");
        for (const p of points)
          result.shapes.push({
            unit: unitId,
            points: Array.from({ length: 37 }, (_, i) =>
              transform({
                x: p.x + (u.diameter / 2) * Math.cos((i * Math.PI) / 18),
                y: p.y + (u.diameter / 2) * Math.sin((i * Math.PI) / 18),
              }),
            ),
          });
      } else if (u.kind === "LINE OUT") {
        let from = u.start;
        const raw = [from];
        for (const e of u.edges) {
          raw.push(...(e.kind === "ARC" ? arcPoints(from, e).slice(1) : [e]));
          from = e;
        }
        result.shapes.push({ unit: unitId, points: raw.map(transform) });
      } else {
        positive(u.width);
        positive(u.height);
        result.shapes.push({
          unit: unitId,
          points: [
            { x: u.x, y: u.y },
            { x: u.x + u.width, y: u.y },
            { x: u.x + u.width, y: u.y + u.height },
            { x: u.x, y: u.y + u.height },
            { x: u.x, y: u.y },
          ].map(transform),
        });
      }
      if (!u.tools.length || u.tools.length > 10) fail("tool");
      const finalKind =
        u.kind === "TAPPING"
          ? "tap"
          : u.kind === "REAMING"
            ? "reamer"
            : u.kind === "DRILLING"
              ? "drill"
              : null;
      if (finalKind && u.tools.at(-1)!.kind !== finalKind) fail("sequence");
      for (const row of u.tools) {
        positive(row.diameter);
        positive(row.depthPass);
        positive(row.speed);
        positive(row.feed);
        const mounted = available.find((t) => t.pocket === row.pocket);
        if (
          !mounted ||
          mounted.kind !== row.kind ||
          Math.abs(mounted.actual - row.diameter) > 0.01
        )
          fail("tool");
        validateSequence(u, row);
        const rpm = Math.min(
          12000,
          Math.round((row.speed * 1000) / (Math.PI * row.diameter)),
        );
        if (rpm < 1) fail("value");
        if (
          u.kind === "TAPPING" &&
          row.kind === "tap" &&
          Math.abs(row.feed - rpm * u.pitch) > 0.01
        )
          fail("sequence");
        emit("G80 M05 M09");
        // Retract to machine home before M06; the shared interpreter enforces the ATC interlock.
        emit("G91 G28 Z0.");
        emit("G90 G49");
        emit(`T${row.pocket} M06`);
        emit(`G0 G43 H${row.pocket} ${z(common.initialZ)}`);
        emit(`S${rpm} M03 M08`);
        const feed = `F${n(row.feed)}`;
        if ("shapes" in u && u.kind !== "RGH CBOR") {
          const depth = positive(pointDepth(u, row));
          if (
            row.kind === "centerDrill" &&
            (row.diameter < u.diameter + 0.5 || depth * 2 > row.diameter + 1e-6)
          )
            fail("diameter");
          for (const [index, p] of points.entries()) {
            if (row.kind === "reamer") {
              emit(`G0 ${xy(p)}`);
              emit(`G0 ${z(u.top + 2)}`);
              emit(`G1 ${z(u.top - depth)} ${feed}`);
              emit(`G1 ${z(u.top + 2)} ${feed}`);
              retract();
            } else {
              const code =
                row.kind === "tap"
                  ? 84
                  : row.kind === "drill" && row.depthPass < depth
                    ? 83
                    : 81;
              // One modal cycle declaration per tool; XY-only blocks repeat it until G80.
              if (index === 0)
                emit(
                  `G98 G${code} ${xy(p)} ${z(u.top - depth)} R${n(u.top + 2 + wpc.z)} ${code === 83 ? `Q${n(row.depthPass)} ` : ""}${feed}`,
                );
              else emit(xy(p));
            }
          }
          if (row.kind !== "reamer") emit("G80");
        } else {
          const passes = Math.ceil(u.depth / row.depthPass);
          if (passes > 100) fail("limit");
          for (let pass = 1; pass <= passes; pass++) {
            const bottom = u.top - Math.min(u.depth, pass * row.depthPass);
            if (u.kind === "LINE OUT") {
              const path = outsideContour(u.start, u.edges, row.diameter / 2);
              emit(`G0 ${xy(path.start)}`);
              emit(`G1 ${z(bottom)} ${feed}`);
              let from = path.start;
              for (const edge of path.edges) {
                if (edge.kind === "LINE") emit(`G1 ${xy(edge)} ${feed}`);
                else {
                  const c = transform({ x: edge.cx, y: edge.cy }),
                    a = transform(from);
                  emit(
                    `G${edge.clockwise ? 2 : 3} ${xy(edge)} I${n(c.x - a.x)} J${n(c.y - a.y)} ${feed}`,
                  );
                }
                from = edge;
              }
              retract();
            } else if (u.kind === "RGH CBOR") {
              if (row.diameter > u.diameter) fail("diameter");
              const max = (u.diameter - row.diameter) / 2,
                rings = Math.max(1, Math.ceil(max / (row.diameter * 0.4)));
              if (rings > 500) fail("limit");
              for (const p of points) {
                // Overlapping concentric rings clear a flat-bottom recess, rather than just its wall.
                emit(`G0 ${xy(p)}`);
                emit(`G1 ${z(bottom)} ${feed}`);
                for (let i = 1; i <= rings && max > 0; i++) {
                  const r = (max * i) / rings,
                    from = { x: p.x + r, y: p.y };
                  emit(`G1 ${xy(from)} ${feed}`);
                  const c = transform(p),
                    a = transform(from);
                  emit(
                    `G3 ${xy(from)} I${n(c.x - a.x)} J${n(c.y - a.y)} ${feed}`,
                  );
                }
                retract();
              }
            } else if (u.kind === "FACE MILL" || u.kind === "POCKET") {
              const r = row.diameter / 2,
                pocket = u.kind === "POCKET";
              if (pocket && row.diameter >= Math.min(u.width, u.height))
                fail("diameter");
              // Facing overtravels the edges; pocket centres stay a cutter radius inside them.
              const x0 = u.x + (pocket ? r : -r - 1),
                x1 = u.x + u.width + (pocket ? -r : r + 1),
                y0 = u.y + (pocket ? r : 0),
                y1 = u.y + u.height - (pocket ? r : 0);
              const rows = Math.max(
                1,
                Math.ceil((y1 - y0) / (row.diameter * 0.45)),
              );
              if (rows > 500) fail("limit");
              emit(`G0 ${xy({ x: x0, y: y0 })}`);
              if (pocket && u.entry !== "plunge") {
                // Approach the previous floor, then zig-zag down at no more than 3°.
                const previousFloor =
                  u.top - Math.min(u.depth, (pass - 1) * row.depthPass);
                emit(`G1 ${z(previousFloor)} F${n(row.feed * 0.3)}`);
                const rampLegs = Math.max(
                  1,
                  Math.ceil(
                    (previousFloor - bottom) /
                      ((x1 - x0) * Math.tan(Math.PI / 60)),
                  ),
                );
                if (rampLegs > 500) fail("limit");
                for (let leg = 1; leg <= rampLegs; leg++) {
                  emit(
                    `G1 ${xy({ x: leg % 2 ? x1 : x0, y: y0 })} ${z(previousFloor + ((bottom - previousFloor) * leg) / rampLegs)} ${feed}`,
                  );
                }
              } else emit(`G1 ${z(bottom)} F${n(row.feed * 0.3)}`);
              for (let i = 0; i <= rows; i++) {
                const y = y0 + ((y1 - y0) * i) / rows;
                emit(`G1 ${xy({ x: i % 2 ? x1 : x0, y })} ${feed}`);
                emit(`G1 ${xy({ x: i % 2 ? x0 : x1, y })} ${feed}`);
              }
              if (pocket)
                for (const p of [
                  { x: x0, y: y1 },
                  { x: x0, y: y0 },
                  { x: x1, y: y0 },
                  { x: x1, y: y1 },
                  { x: x0, y: y1 },
                ])
                  emit(`G1 ${xy(p)} ${feed}`);
              retract();
            } else fail("structure");
          }
        }
      }
    }
    unitId = units.at(-1)!.id;
    emit("G80 M05 M09");
    emit("G91 G28 Z0.");
    emit("G90 M30");
    result.source = lines.join("\n");
  } catch (error) {
    result.issues.push({
      unit: unitId,
      code: error instanceof Invalid ? error.code : "structure",
    });
    result.source = "";
    result.lineUnits = {};
  }
  return result;
}
function validateSequence(unit: CuttingUnit, row: ToolRow) {
  const allowed =
    unit.kind === "TAPPING"
      ? ["centerDrill", "drill", "tap"]
      : unit.kind === "DRILLING"
        ? ["centerDrill", "drill"]
        : unit.kind === "REAMING"
          ? ["centerDrill", "drill", "reamer"]
          : unit.kind === "FACE MILL"
            ? ["faceMill", "endMill"]
            : ["endMill"];
  if (!allowed.includes(row.kind)) fail("sequence");
  // A drilling unit describes the finished hole diameter, not merely the tool path.
  if (
    unit.kind === "DRILLING" &&
    row.kind === "drill" &&
    Math.abs(unit.diameter - row.diameter) > 0.01
  )
    fail("diameter");
  if (
    (unit.kind === "TAPPING" || unit.kind === "REAMING") &&
    row.kind === "drill" &&
    row.diameter >= unit.diameter
  )
    fail("diameter");
  if (
    "diameter" in unit &&
    ["tap", "reamer"].includes(row.kind) &&
    Math.abs(unit.diameter - row.diameter) > 0.01
  )
    fail("diameter");
}
