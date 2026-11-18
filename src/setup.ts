import type { Vec3, WorkSystem } from './nc';

export const workSystems: WorkSystem[] = [54, 55, 56, 57, 58, 59];
export const toolKinds = ['endMill', 'faceMill', 'centerDrill', 'drill', 'tap', 'reamer', 'chamfer', 'ballMill'] as const;
export type ToolKind = typeof toolKinds[number];
export interface ToolData { pocket: number; kind: ToolKind; nominal: number; actual: number; length: number; life: number }
export function defaultOffsets(): Record<WorkSystem, Vec3> {
  return Object.fromEntries(workSystems.map(id => [id, { x: 0, y: 0, z: 0 }])) as Record<WorkSystem, Vec3>;
}
export function defaultTools(): ToolData[] {
  return Array.from({ length: 20 }, (_, index) => ({ pocket: index + 1, kind: 'endMill', nominal: 6, actual: 6, length: 0, life: 0 }));
}
const valid = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
/** Validate old/corrupted browser data before it reaches the interpreter. */
export function restoreSetup(saved: unknown) {
  const input = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {};
  const offsets = defaultOffsets();
  const rawOffsets = input.workOffsets as Partial<Record<WorkSystem, Vec3>> | undefined;
  for (const system of workSystems) {
    const value = rawOffsets?.[system];
    if (value && ['x', 'y', 'z'].every(axis => valid(value[axis as keyof Vec3], -1e6, 1e6))) offsets[system] = { ...value };
  }
  const tools = defaultTools();
  if (Array.isArray(input.tools)) for (const [index, raw] of input.tools.entries()) {
    if (index >= 20 || !raw || typeof raw !== 'object') continue;
    const tool = raw as ToolData;
    if (tool.pocket === index + 1 && toolKinds.includes(tool.kind) && valid(tool.nominal, 0, 1000) &&
        valid(tool.actual, 0, 1000) && valid(tool.length, 0, 10000) && valid(tool.life, 0, 1e6)) tools[index] = { ...tool };
  }
  return { workOffsets: offsets, tools };
}
