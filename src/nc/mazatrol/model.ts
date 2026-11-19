import type { CuttingTool, ToolKind } from "../stock";
export type Material = "A5052" | "S45C" | "SUS304" | "SS400";
export type PointKind = "DRILLING" | "RGH CBOR" | "TAPPING" | "REAMING";
export interface XY {
  x: number;
  y: number;
}
export type Shape =
  | ({ kind: "PT" } & XY)
  | ({ kind: "LIN"; count: number; dx: number; dy: number } & XY)
  | ({ kind: "SQR"; width: number; height: number } & XY)
  | ({ kind: "GRD"; nx: number; ny: number; dx: number; dy: number } & XY)
  | ({ kind: "CIR"; count: number; radius: number; angle: number } & XY);
export type Edge =
  | ({ kind: "LINE" } & XY)
  | ({ kind: "ARC"; cx: number; cy: number; clockwise: boolean } & XY);
export interface ToolRow {
  kind: ToolKind;
  pocket: number;
  diameter: number;
  depthPass: number;
  speed: number;
  feed: number;
}
interface Base {
  id: string;
  extensions?: Record<string, unknown>;
}
interface Cut extends Base {
  top: number;
  depth: number;
  tools: ToolRow[];
}
export type Unit =
  | (Base & { kind: "COMMON"; material: Material; initialZ: number })
  | (Base & { kind: "WPC"; x: number; y: number; z: number; theta: number })
  | (Cut & {
      kind: PointKind;
      diameter: number;
      pitch: number;
      shapes: Shape[];
    })
  | (Cut & {
      kind: "FACE MILL" | "POCKET";
      x: number;
      y: number;
      width: number;
      height: number;
    })
  | (Cut & { kind: "LINE OUT"; start: XY; edges: Edge[] })
  | (Base & { kind: "END" });
export type CuttingUnit = Extract<Unit, { tools: ToolRow[] }>;
export interface MazatrolProgram {
  version: 1;
  units: Unit[];
  extensions?: Record<string, unknown>;
}
export const unitKinds = [
  "DRILLING",
  "RGH CBOR",
  "TAPPING",
  "REAMING",
  "FACE MILL",
  "POCKET",
  "LINE OUT",
] as const;
export const shapeKinds = ["PT", "LIN", "SQR", "GRD", "CIR"] as const;
export function newShape(kind: Shape["kind"]): Shape {
  const p = { x: 20, y: 20 };
  switch (kind) {
    case "PT":
      return { kind, ...p };
    case "LIN":
      return { kind, ...p, count: 4, dx: 15, dy: 0 };
    case "SQR":
      return { kind, ...p, width: 60, height: 20 };
    case "GRD":
      return { kind, ...p, nx: 3, ny: 2, dx: 20, dy: 20 };
    case "CIR":
      return { kind, x: 50, y: 30, count: 4, radius: 15, angle: 0 };
  }
}
export function newUnit(kind: CuttingUnit["kind"], id: string): CuttingUnit {
  const cut = { id, top: 0, depth: kind === "FACE MILL" ? 1 : 5, tools: [] };
  if (kind === "LINE OUT")
    return {
      ...cut,
      kind,
      start: { x: 20, y: 15 },
      edges: [
        { kind: "LINE", x: 80, y: 15 },
        { kind: "LINE", x: 80, y: 45 },
        { kind: "LINE", x: 20, y: 45 },
        { kind: "LINE", x: 20, y: 15 },
      ],
    };
  if (kind === "FACE MILL" || kind === "POCKET")
    return {
      ...cut,
      kind,
      x: kind === "POCKET" ? 30 : 0,
      y: kind === "POCKET" ? 20 : 0,
      width: kind === "POCKET" ? 40 : 100,
      height: kind === "POCKET" ? 20 : 60,
    };
  return { ...cut, kind, diameter: 8, pitch: 1.25, shapes: [newShape("PT")] };
}
export function blankMazatrol(): MazatrolProgram {
  return {
    version: 1,
    units: [
      { id: "common", kind: "COMMON", material: "A5052", initialZ: 15 },
      { id: "wpc", kind: "WPC", x: 0, y: 0, z: 0, theta: 0 },
      { id: "end", kind: "END" },
    ],
  };
}
/** Starting values for practice, not validated machining recommendations. FR is mm/min. */
export function autoTools(
  unit: CuttingUnit,
  material: Material,
  tools: CuttingTool[],
): ToolRow[] {
  const factor = { A5052: 1, S45C: 0.45, SUS304: 0.25, SS400: 0.5 }[material];
  const specs: [ToolKind, number][] =
    unit.kind === "TAPPING"
      ? [
          ["centerDrill", 4],
          [
            "drill",
            unit.diameter === 8 && unit.pitch === 1.25
              ? 6.8
              : Math.round((unit.diameter - unit.pitch) * 10) / 10,
          ],
          ["tap", unit.diameter],
        ]
      : unit.kind === "DRILLING"
        ? [
            ["centerDrill", 4],
            ["drill", unit.diameter],
          ]
        : unit.kind === "REAMING"
          ? [
              ["centerDrill", 4],
              ["drill", unit.diameter - 0.2],
              ["reamer", unit.diameter],
            ]
          : unit.kind === "FACE MILL"
            ? [["faceMill", 50]]
            : [["endMill", 6]];
  return specs.map(([kind, diameter]) => {
    const speed = Math.round(
      {
        centerDrill: 40,
        drill: 60,
        tap: 12,
        reamer: 20,
        faceMill: 150,
        endMill: 120,
        ballMill: 100,
        chamfer: 60,
      }[kind] * factor,
    );
    const rpm = Math.min(
      12000,
      Math.round((speed * 1000) / (Math.PI * diameter)),
    );
    return {
      kind,
      diameter,
      pocket:
        tools.find(
          (t) => t.kind === kind && Math.abs(t.actual - diameter) < 0.01,
        )?.pocket ?? 0,
      depthPass: kind === "centerDrill" ? 1 : kind === "drill" ? 3 : 1,
      speed,
      feed:
        unit.kind === "TAPPING" && kind === "tap"
          ? rpm * unit.pitch
          : Math.max(
              10,
              Math.round(
                rpm * (kind === "endMill" || kind === "faceMill" ? 0.08 : 0.04),
              ),
            ),
    };
  });
}
export function sampleMazatrol(tools: CuttingTool[]): MazatrolProgram {
  const p = blankMazatrol();
  const face = newUnit("FACE MILL", "face");
  const holes: CuttingUnit = {
    id: "holes",
    kind: "TAPPING",
    top: -1,
    depth: 10,
    diameter: 8,
    pitch: 1.25,
    shapes: [{ kind: "SQR", x: 15, y: 15, width: 70, height: 30 }],
    tools: [],
  };
  const pocket = { ...newUnit("POCKET", "pocket"), top: -1, depth: 4 };
  const cuts = [face, holes, pocket].map((u) => ({
    ...u,
    tools: autoTools(u, "A5052", tools),
  }));
  p.units.splice(2, 0, ...cuts);
  return p;
}
