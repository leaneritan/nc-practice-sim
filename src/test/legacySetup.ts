import { vi } from 'vitest';
// Earlier-phase UI regressions use their original zero-offset, no-physics fixture.
// Phase4.test.tsx exercises the real default setup and enabled safety end to end.
vi.mock('../setup', async importOriginal => {
  const actual = await importOriginal<typeof import('../setup')>();
  const defaultOffsets = () => Object.fromEntries(actual.workSystems.map(id => [id, { x: 0, y: 0, z: 0 }])) as ReturnType<typeof actual.defaultOffsets>;
  const defaultTools = () => actual.defaultTools().map(tool => ({ ...tool, kind: 'endMill' as const, nominal: 6, actual: 6, length: 0, life: 0 }));
  return { ...actual, defaultOffsets, defaultTools, machineHome: { x: 0, y: 0, z: 80 },
    simulationOptions: (workOffsets: ReturnType<typeof defaultOffsets>, tools: ReturnType<typeof defaultTools>) => ({ workOffsets,
      toolLengths: Object.fromEntries(tools.map(tool => [tool.pocket, tool.length])), initialPosition: { x: 0, y: 0, z: 80 }, referencePosition: { x: 0, y: 0, z: 80 } }) };
});
