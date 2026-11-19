// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  autoTools,
  blankMazatrol,
  newShape,
  newUnit,
  sampleMazatrol,
  shapeKinds,
  unitKinds,
} from "./model";
import type { CuttingUnit, Edge, MazatrolProgram, Material } from "./model";
import { expandMazatrol, outsideContour, pointsFor } from "./expand";
import { defaultOffsets, defaultTools, simulationOptions } from "../../setup";
import { runProgram } from "../interpreter";
import {
  createMachine,
  cycleStart,
  tickMachine,
  setMode,
  setControls,
  feedHold,
} from "../machine";
import { removedVolume } from "../stock";
import { restorePrograms, validMazatrol } from "../../programs";
const tools = defaultTools();
const options = () => simulationOptions(defaultOffsets(), tools);
const pack = (unit: CuttingUnit) => {
  const p = blankMazatrol();
  p.units.splice(2, 0, unit);
  return p;
};
const prepared = (kind: CuttingUnit["kind"]) => {
  const u = newUnit(kind, "cut");
  u.tools = autoTools(u, "A5052", tools);
  return u;
};

describe("point pattern expansion", () => {
  it("PT retains its coordinate", () =>
    expect(pointsFor({ kind: "PT", x: 2, y: 3 })).toEqual([{ x: 2, y: 3 }]));
  it("LIN includes its first point and applies signed spacing", () =>
    expect(
      pointsFor({ kind: "LIN", x: 10, y: 20, count: 3, dx: -2, dy: 4 }),
    ).toEqual([
      { x: 10, y: 20 },
      { x: 8, y: 24 },
      { x: 6, y: 28 },
    ]));
  it("SQR emits four corners without duplicate closure", () =>
    expect(
      pointsFor({ kind: "SQR", x: 0, y: 0, width: 40, height: 20 }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 },
    ]));
  it("GRD expands independent row/column counts", () => {
    const p = pointsFor({
      kind: "GRD",
      x: 1,
      y: 2,
      nx: 3,
      ny: 2,
      dx: 4,
      dy: 5,
    });
    expect(p).toHaveLength(6);
    expect(p[5]).toEqual({ x: 9, y: 7 });
  });
  it("CIR honors radius and angular origin", () => {
    const p = pointsFor({
      kind: "CIR",
      x: 10,
      y: 20,
      count: 4,
      radius: 5,
      angle: 90,
    });
    expect(p[0]?.x).toBeCloseTo(10);
    expect(p[0]?.y).toBeCloseTo(25);
    expect(p[3]?.x).toBeCloseTo(15);
  });
  it.each([0, -1, 1.5, 501, Infinity])(
    "rejects invalid pattern count %s",
    (count) =>
      expect(() =>
        pointsFor({ kind: "LIN", x: 0, y: 0, count, dx: 1, dy: 0 }),
      ).toThrow(),
  );
  it("bounds grids before allocation", () =>
    expect(() =>
      pointsFor({ kind: "GRD", x: 0, y: 0, nx: 100, ny: 100, dx: 1, dy: 1 }),
    ).toThrow());
  it.each(shapeKinds)("provides an editable default %s shape", (kind) =>
    expect(pointsFor(newShape(kind)).length).toBeGreaterThan(0),
  );
});

describe("automatic tool sequence", () => {
  it("M8 expands to center drill, 6.8 drill and M8 tap with pitch-correct feed", () => {
    const u = prepared("TAPPING");
    expect(u.tools.map((r) => [r.kind, r.diameter, r.pocket])).toEqual([
      ["centerDrill", 4, 6],
      ["drill", 6.8, 2],
      ["tap", 8, 3],
    ]);
    const r = u.tools[2]!;
    expect(r.feed).toBe(Math.round((r.speed * 1000) / (Math.PI * 8)) * 1.25);
  });
  it.each(["A5052", "S45C", "SUS304", "SS400"] as Material[])(
    "material %s has usable practice speeds",
    (material) => {
      const rows = autoTools(newUnit("TAPPING", "u"), material, tools);
      expect(rows.every((r) => r.speed > 0 && r.feed > 0)).toBe(true);
      if (material !== "A5052") expect(rows[0]!.speed).toBeLessThan(40);
    },
  );
  it("keeps unmatched tools explicit instead of changing TOOL DATA", () => {
    const before = structuredClone(tools),
      u = prepared("REAMING");
    expect(u.tools[1]?.pocket).toBe(0);
    expect(tools).toEqual(before);
  });
  it.each(unitKinds)("generates rows for %s", (kind) =>
    expect(
      autoTools(newUnit(kind, "u"), "A5052", tools).length,
    ).toBeGreaterThan(0),
  );
});

describe("equivalent EIA and shared simulation", () => {
  it("sample faces, taps four M8 holes and cuts a 40×20 pocket with all safety checks", () => {
    const p = sampleMazatrol(tools),
      before = structuredClone(p),
      e = expandMazatrol(p, tools);
    expect(e.issues).toEqual([]);
    expect(p).toEqual(before);
    const result = runProgram(e.source, options());
    expect(result.alarms).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.state.ended).toBe(true);
    expect(result.stock!.heights[30 * 101 + 50]).toBe(-5);
    expect(result.stock!.heights[15 * 101 + 15]).toBe(-11);
    expect(result.stock!.heights[10 * 101 + 50]).toBe(-1);
    expect(removedVolume(result.stock!)).toBeGreaterThan(6000);
    expect(result.events.filter((e) => e.kind === "toolChange")).toHaveLength(
      5,
    );
    expect(Object.keys(e.lineUnits)).toHaveLength(e.source.split("\n").length);
    expect(e.shapes).toHaveLength(6);
  });
  it("emits decimal distance words so strict mode does not rescale generated paths", () => {
    const e = expandMazatrol(sampleMazatrol(tools), tools);
    const a = runProgram(e.source, options()),
      b = runProgram(e.source, { ...options(), strictDecimals: true });
    expect(a.segments).toEqual(b.segments);
  });
  it("applies WPC translation, rotation and Z to point cycles and shape drawings", () => {
    const u = prepared("DRILLING");
    if (!("shapes" in u)) throw Error();
    u.diameter = 6.8;
    u.tools = autoTools(u, "A5052", tools);
    u.shapes = [{ kind: "PT", x: 10, y: 0 }];
    const p = pack(u);
    p.units[1] = { id: "wpc", kind: "WPC", x: 20, y: 20, z: -1, theta: 90 };
    const e = expandMazatrol(p, tools);
    expect(e.issues).toEqual([]);
    expect(e.source).toContain("X20.0000 Y30.0000");
    expect(e.source).toContain("Z-6.0000");
    expect(e.shapes[0]?.points[0]?.x).toBeCloseTo(20);
    expect(e.shapes[0]?.points[0]?.y).toBeCloseTo(33.4);
    expect(runProgram(e.source, options()).alarms).toEqual([]);
  });
  it("counterbores clear concentric circles in depth passes", () => {
    const u = prepared("RGH CBOR");
    if (!("diameter" in u)) throw Error();
    u.diameter = 12;
    u.depth = 3;
    const e = expandMazatrol(pack(u), tools);
    expect(e.issues).toEqual([]);
    expect(e.source).toContain("G3");
    const r = runProgram(e.source, options());
    expect(r.alarms).toEqual([]);
    expect(r.stock!.heights[20 * 101 + 20]).toBe(-3);
  });
  it("reaming feeds back out instead of a rapid withdrawal", () => {
    const u = prepared("REAMING");
    const configured = structuredClone(tools);
    configured[1]!.actual = 7.8;
    u.tools = autoTools(u, "A5052", configured);
    const e = expandMazatrol(pack(u), configured);
    expect(e.issues).toEqual([]);
    expect(e.source).toContain("T7 M06");
    const r = runProgram(
      e.source,
      simulationOptions(defaultOffsets(), configured),
    );
    expect(r.alarms).toEqual([]);
    expect(
      r.segments
        .filter((s) => s.tool === 7 && s.kind === "linear")
        .some((s) => s.to.z > s.from.z),
    ).toBe(true);
  });
  it("pocket tool centre stays inside the inset boundary on every pass", () => {
    const u = prepared("POCKET");
    u.depth = 2.5;
    u.tools[0]!.depthPass = 1;
    const e = expandMazatrol(pack(u), tools),
      r = runProgram(e.source, options());
    expect(r.alarms).toEqual([]);
    const feeds = r.segments.filter((s) => s.kind === "linear");
    expect(
      feeds.every(
        (s) =>
          s.to.x - s.workShift.x >= 33 &&
          s.to.x - s.workShift.x <= 67 &&
          s.to.y - s.workShift.y >= 23 &&
          s.to.y - s.workShift.y <= 37,
      ),
    ).toBe(true);
    expect(Math.min(...feeds.map((s) => s.to.z - s.workShift.z))).toBe(-2.5);
  });
  it("maps an interpreter safety alarm to the original unit", () => {
    const u = prepared("POCKET");
    u.depth = 25;
    const e = expandMazatrol(pack(u), tools),
      r = runProgram(e.source, options());
    expect(r.alarms[0]?.code).toBe("belowStock");
    expect(e.lineUnits[r.alarms[0]!.line]).toBe("cut");
  });
  it("timed execution, holds and single block use the same generated source", () => {
    const p = pack(prepared("POCKET")),
      e = expandMazatrol(p, tools);
    let m = cycleStart(
      setControls(setMode(createMachine(), "MEMORY"), { singleBlock: true }),
      e.source,
      { ...options(), sourceUnits: e.lineUnits },
    );
    m = tickMachine(m, 10000);
    expect(m.status).toBe("singleBlock");
    expect(m.line).toBe(1);
    expect(m.session?.options.sourceUnits?.[m.line]).toBe("common");
    m = cycleStart(setControls(m, { singleBlock: false }), "", options());
    m = tickMachine(m, 3000);
    const held = feedHold(m);
    expect(tickMachine(held, 5000)).toBe(held);
    m = cycleStart(held, "", options());
    for (let i = 0; i < 200 && m.status === "running"; i++)
      m = tickMachine(m, 10000);
    expect(m.alarms).toEqual([]);
    expect(m.status).toBe("complete");
    const instant = runProgram(e.source, options());
    expect(m.state.position).toEqual(instant.state.position);
    expect(removedVolume(m.stock)).toBeCloseTo(
      removedVolume(instant.stock!),
      0,
    );
  });
});

describe("LINE OUT tool-radius offset", () => {
  const rectangle: Edge[] = [
    { kind: "LINE", x: 30, y: 10 },
    { kind: "LINE", x: 30, y: 30 },
    { kind: "LINE", x: 10, y: 30 },
    { kind: "LINE", x: 10, y: 10 },
  ];
  it("offsets both CW and CCW rectangles outside the part", () => {
    const a = outsideContour({ x: 10, y: 10 }, rectangle, 3);
    expect(a.start.x).toBeCloseTo(7);
    expect(a.start.y).toBeCloseTo(7);
    expect(a.edges[1]!.x).toBeCloseTo(33);
    expect(a.edges[1]!.y).toBeCloseTo(33);
    const b = outsideContour(
      { x: 10, y: 10 },
      [
        { kind: "LINE", x: 10, y: 30 },
        { kind: "LINE", x: 30, y: 30 },
        { kind: "LINE", x: 30, y: 10 },
        { kind: "LINE", x: 10, y: 10 },
      ],
      3,
    );
    expect(b.start.x).toBeCloseTo(a.start.x);
    expect(b.start.y).toBeCloseTo(a.start.y);
  });
  it("preserves full-circle ARC geometry after WPC rotation", () => {
    const u = prepared("LINE OUT");
    if (u.kind !== "LINE OUT") throw Error();
    u.start = { x: 60, y: 30 };
    u.edges = [{ kind: "ARC", x: 60, y: 30, cx: 50, cy: 30, clockwise: false }];
    const program = pack(u);
    program.units[1] = {
      id: "wpc",
      kind: "WPC",
      x: 80,
      y: -20,
      z: 0,
      theta: 90,
    };
    const e = expandMazatrol(program, tools);
    expect(e.issues).toEqual([]);
    const r = runProgram(e.source, options());
    expect(r.alarms).toEqual([]);
    expect(r.segments.find((s) => s.kind === "arcCCW")).toMatchObject({
      radius: 13,
      center: { x: -450, y: -220 },
    });
  });
  it("supports tangent line/arc joins on a rounded convex outline", () => {
    const p = outsideContour(
      { x: 20, y: 10 },
      [
        { kind: "LINE", x: 80, y: 10 },
        { kind: "ARC", x: 90, y: 20, cx: 80, cy: 20, clockwise: false },
        { kind: "LINE", x: 90, y: 40 },
        { kind: "ARC", x: 80, y: 50, cx: 80, cy: 40, clockwise: false },
        { kind: "LINE", x: 20, y: 50 },
        { kind: "ARC", x: 10, y: 40, cx: 20, cy: 40, clockwise: false },
        { kind: "LINE", x: 10, y: 20 },
        { kind: "ARC", x: 20, y: 10, cx: 20, cy: 20, clockwise: false },
      ],
      3,
    );
    expect(p.start).toEqual({ x: 20, y: 7 });
    expect(p.edges[1]).toMatchObject({ x: 93, y: 20 });
  });
  it("rejects open, degenerate, concave and malformed contours", () => {
    for (const edges of [
      rectangle.slice(0, -1),
      [{ kind: "LINE", x: 10, y: 10 }],
      [
        { kind: "LINE", x: 30, y: 10 },
        { kind: "LINE", x: 20, y: 20 },
        { kind: "LINE", x: 30, y: 30 },
        { kind: "LINE", x: 10, y: 30 },
        { kind: "LINE", x: 10, y: 10 },
      ],
      [{ kind: "ARC", x: 10, y: 10, cx: 10, cy: 10, clockwise: false }],
    ] as Edge[][])
      expect(() => outsideContour({ x: 10, y: 10 }, edges, 3)).toThrow();
  });
});

describe("validation and storage", () => {
  it.each([
    "tool",
    "diameter",
    "clearance",
    "value",
    "limit",
    "sequence",
  ] as const)("rejects %s before emitting executable code", (code) => {
    const u = prepared("POCKET"),
      p = pack(u);
    if (code === "tool") u.tools[0]!.pocket = 0;
    if (code === "diameter" && u.kind === "POCKET") u.width = 5;
    if (code === "clearance") u.top = 15;
    if (code === "value") u.depth = NaN;
    if (code === "limit") u.depth = 500;
    if (code === "sequence")
      u.tools[0] = { ...u.tools[0]!, kind: "tap", pocket: 3, diameter: 8 };
    const e = expandMazatrol(p, tools);
    expect(e.issues[0]?.code).toBe(code);
    expect(e.source).toBe("");
  });
  it("rejects incorrect tapping pitch feed", () => {
    const u = prepared("TAPPING");
    u.tools[2]!.feed = 1;
    expect(expandMazatrol(pack(u), tools).issues[0]?.code).toBe("sequence");
  });
  it("rejects malformed, unsupported-version and reordered units without throwing", () => {
    for (const p of [
      null,
      {},
      { version: 2, units: [] },
      { ...blankMazatrol(), units: [] },
      {
        ...blankMazatrol(),
        units: [
          blankMazatrol().units[1],
          blankMazatrol().units[0],
          blankMazatrol().units[2],
        ],
      },
    ])
      expect(expandMazatrol(p as MazatrolProgram, tools).issues[0]?.code).toBe(
        "structure",
      );
  });
  it("restores both formats, filters corrupt documents, and retains extensions", () => {
    const p = sampleMazatrol(tools);
    p.extensions = { controlVersion: "practice" };
    expect(validMazatrol(p)).toBe(true);
    const saved = restorePrograms({
      activeId: "m",
      documents: [
        { id: "m", name: "part", kind: "mazatrol", data: p },
        { id: "e", name: "code", kind: "eia", source: "M30" },
        {
          id: "bad",
          name: "bad",
          kind: "mazatrol",
          data: { version: 1, units: [null] },
        },
      ],
    });
    expect(saved.documents).toHaveLength(2);
    expect(saved.activeId).toBe("m");
    expect(saved.documents[0]).toMatchObject({
      data: { extensions: { controlVersion: "practice" } },
    });
    expect(restorePrograms(null)).toEqual({ documents: [], activeId: null });
  });
});

describe("feature diameter validation", () => {
  it("rejects a drill row that does not make the requested hole", () => {
    const u = prepared("DRILLING");
    u.tools = [
      {
        kind: "drill",
        pocket: 2,
        diameter: 6.8,
        depthPass: 3,
        speed: 60,
        feed: 120,
      },
    ];
    expect(expandMazatrol(pack(u), tools).issues[0]?.code).toBe("diameter");
  });
  it("rejects a pilot hole larger than the tapped feature", () => {
    const u = prepared("TAPPING");
    const configured = structuredClone(tools);
    configured[1]!.actual = 9;
    u.tools[1]!.diameter = 9;
    expect(expandMazatrol(pack(u), configured).issues[0]?.code).toBe(
      "diameter",
    );
  });
});
