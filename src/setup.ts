import type { InterpreterOptions } from './nc';
import { verticalTravel } from './nc/safety';
import type { Vec3, WorkSystem } from './nc';

export const workSystems: WorkSystem[] = [54, 55, 56, 57, 58, 59];
export const toolKinds = ['endMill', 'faceMill', 'centerDrill', 'drill', 'tap', 'reamer', 'chamfer', 'ballMill'] as const;
export type { ToolKind } from './nc/stock';
import type { ToolKind } from './nc/stock';
export interface ToolData { pocket: number; kind: ToolKind; nominal: number; actual: number; length: number; life: number }
export function defaultOffsets(): Record<WorkSystem, Vec3> {
  return Object.fromEntries(workSystems.map(id => [id, { x: -500, y: -250, z: -400 }])) as Record<WorkSystem, Vec3>;
}
export function defaultTools(): ToolData[] {
  const presets: [ToolKind, number, number][] = [
    ['endMill', 6, 120], ['drill', 6.8, 160], ['tap', 8, 150], ['faceMill', 50, 100],
    ['ballMill', 6, 130], ['centerDrill', 4, 110], ['reamer', 8, 180], ['chamfer', 10, 110],
  ];
  return Array.from({ length: 20 }, (_, index) => {
    const [kind, diameter, length] = presets[index % presets.length]!;
    return { pocket: index + 1, kind, nominal: diameter, actual: diameter, length, life: 120 };
  });
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

export const machineHome: Vec3 = { x: 0, y: 0, z: 0 };
export function simulationOptions(workOffsets: Record<WorkSystem, Vec3>, tools: ToolData[], pocketWidth = 0): InterpreterOptions {
  return { initialPosition: machineHome, referencePosition: machineHome, workOffsets,
    toolLengths: Object.fromEntries(tools.map(tool => [tool.pocket, tool.length])),
    safety: { tools, stockOrigin: { ...workOffsets[54] }, travel: verticalTravel, pocketWidth } };
}
