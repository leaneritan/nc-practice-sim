import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./store";
import {
  blankMazatrol,
  newShape,
  newUnit,
  unitKinds,
} from "./nc/mazatrol/model";
import type { MazatrolProgram, Shape, Unit } from "./nc/mazatrol/model";
export type ProgramDocument = { id: string; name: string } & (
  | { kind: "eia"; source: string }
  | { kind: "mazatrol"; data: MazatrolProgram }
);
export function validMazatrol(value: unknown): value is MazatrolProgram {
  if (!value || typeof value !== "object") return false;
  const p = value as MazatrolProgram;
  const matches = (value: object, template: object) =>
    Object.entries(template).every(
      ([k, v]) =>
        typeof (value as Record<string, unknown>)[k] === typeof v &&
        (typeof v !== "number" ||
          Number.isFinite((value as Record<string, unknown>)[k])),
    );
  if (
    p.version !== 1 ||
    !Array.isArray(p.units) ||
    p.units.length < 3 ||
    p.units.length > 100
  )
    return false;
  if (new Set(p.units.map((u) => u?.id)).size !== p.units.length) return false;
  if (
    p.units[0]?.kind !== "COMMON" ||
    p.units[1]?.kind !== "WPC" ||
    p.units.at(-1)?.kind !== "END"
  )
    return false;
  return p.units.every((u: Unit, i) => {
    if (!u || typeof u.id !== "string" || !u.id || u.id.length > 80)
      return false;
    const fixed = blankMazatrol().units;
    if (i < 2 || i === p.units.length - 1)
      return matches(u, fixed[i < 2 ? i : 2]!);
    if (
      !unitKinds.includes(u.kind as (typeof unitKinds)[number]) ||
      !("tools" in u)
    )
      return false;
    if (
      !matches(u, newUnit(u.kind, u.id)) ||
      !Array.isArray(u.tools) ||
      u.tools.length > 10 ||
      !u.tools.every(
        (r) =>
          r &&
          (r.depth === undefined ||
            (typeof r.depth === "number" && Number.isFinite(r.depth))) &&
          matches(r, {
            kind: "",
            pocket: 0,
            diameter: 0,
            depthPass: 0,
            speed: 0,
            feed: 0,
          }),
      )
    )
      return false;
    if (
      u.kind === "POCKET" &&
      u.entry !== undefined &&
      !["ramp", "plunge"].includes(u.entry)
    )
      return false;
    if ("shapes" in u)
      return (
        Array.isArray(u.shapes) &&
        u.shapes.length <= 100 &&
        u.shapes.every(
          (s: Shape) =>
            s &&
            ["PT", "LIN", "SQR", "GRD", "CIR"].includes(s.kind) &&
            matches(s, newShape(s.kind)),
        )
      );
    if (u.kind === "LINE OUT")
      return (
        !!u.start &&
        matches(u.start, { x: 0, y: 0 }) &&
        Array.isArray(u.edges) &&
        u.edges.length <= 200 &&
        u.edges.every(
          (e) =>
            e &&
            ["LINE", "ARC"].includes(e.kind) &&
            matches(
              e,
              e.kind === "LINE"
                ? { kind: "", x: 0, y: 0 }
                : { kind: "", x: 0, y: 0, cx: 0, cy: 0, clockwise: false },
            ),
        )
      );
    return true;
  });
}
export function restorePrograms(value: unknown): {
  documents: ProgramDocument[];
  activeId: string | null;
} {
  const v = value as { documents?: unknown; activeId?: unknown } | null;
  const documents: ProgramDocument[] = Array.isArray(v?.documents)
    ? v.documents
        .slice(0, 100)
        .filter(
          (d): d is ProgramDocument =>
            !!d &&
            typeof d.id === "string" &&
            d.id.length <= 80 &&
            typeof d.name === "string" &&
            d.name.length <= 80 &&
            (d.kind === "eia"
              ? typeof d.source === "string" && d.source.length <= 200000
              : d.kind === "mazatrol" && validMazatrol(d.data)),
        )
    : [];
  const unique = documents.filter(
    (d, i) => documents.findIndex((other) => other.id === d.id) === i,
  );
  return {
    documents: unique,
    activeId: unique.some((d) => d.id === v?.activeId)
      ? (v!.activeId as string)
      : null,
  };
}
interface Library {
  documents: ProgramDocument[];
  activeId: string | null;
  select: (id: string | null) => void;
  add: (
    name: string,
    kind: ProgramDocument["kind"],
    data?: MazatrolProgram,
  ) => void;
  update: (document: ProgramDocument) => void;
}
export const usePrograms = create<Library>()(
  persist(
    (set) => ({
      documents: [],
      activeId: null,
      select: (activeId) => set({ activeId }),
      add: (name, kind, data) =>
        set((state) => {
          if (state.documents.length >= 100) return state;
          const id = crypto.randomUUID();
          const document: ProgramDocument =
            kind === "eia"
              ? { id, name: name.trim().slice(0, 80), kind, source: "" }
              : {
                  id,
                  name: name.trim().slice(0, 80),
                  kind,
                  data: data ?? blankMazatrol(),
                };
          return { documents: [...state.documents, document], activeId: id };
        }),
      update: (document) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === document.id ? document : d,
          ),
        })),
    }),
    {
      name: "nc-practice-programs-v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ documents, activeId }) => ({ documents, activeId }),
      merge: (saved, current) => ({ ...current, ...restorePrograms(saved) }),
    },
  ),
);
