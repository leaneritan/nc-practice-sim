import { defaultOffsets, defaultTools, restoreSetup } from './setup';
import type { ToolData } from './setup';
import type { Vec3, WorkSystem } from './nc';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ja } from './i18n/ja';

export type Language = 'ja' | 'en';
interface AppState {
  pocketWidth: number;
  setPocketWidth: (value: number) => void;
  resetSetup: () => void;
  workOffsets: Record<WorkSystem, Vec3>;
  tools: ToolData[];
  setWorkOffset: (system: WorkSystem, axis: keyof Vec3, value: number) => void;
  setTool: (pocket: number, changes: Partial<ToolData>) => void;
  language: Language;
  program: string;
  strictDecimals: boolean;
  optionalStop: boolean;
  setStrictDecimals: (value: boolean) => void;
  setOptionalStop: (value: boolean) => void;
  setLanguage: (language: Language) => void;
  setProgram: (program: string) => void;
}
// Storage can be disabled or full. Editing and language switching must still work.
export const safeStorage = {
  getItem: (name: string): string | null => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string): void => {
    try { localStorage.setItem(name, value); } catch { /* Session-only fallback. */ }
  },
  removeItem: (name: string): void => {
    try { localStorage.removeItem(name); } catch { /* Session-only fallback. */ }
  },
};
export const useAppStore = create<AppState>()(persist(
  (set) => ({
    pocketWidth: 0, setPocketWidth: pocketWidth => set({ pocketWidth }),
    resetSetup: () => set({ workOffsets: defaultOffsets(), tools: defaultTools(), pocketWidth: 0 }),
    workOffsets: defaultOffsets(), tools: defaultTools(),
    setWorkOffset: (system, axis, value) => set(state => ({ workOffsets: { ...state.workOffsets, [system]: { ...state.workOffsets[system], [axis]: value } } })),
    setTool: (pocket, changes) => set(state => ({ tools: state.tools.map(tool => tool.pocket === pocket ? { ...tool, ...changes } : tool) })),
    language: 'ja', program: ja.sampleProgram, strictDecimals: false, optionalStop: false,
    setStrictDecimals: (strictDecimals) => set({ strictDecimals }),
    setOptionalStop: (optionalStop) => set({ optionalStop }),
    setLanguage: (language) => set({ language }),
    setProgram: (program) => set({ program }),
  }),
  {
    name: 'nc-practice-phase1',
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ pocketWidth, language, program, strictDecimals, optionalStop, workOffsets, tools }) => ({ pocketWidth, language, program, strictDecimals, optionalStop, workOffsets, tools }),
    merge: (persisted, current) => {
      const saved = persisted as Partial<AppState> | null;
      return {
        ...current,
        ...restoreSetup(saved),
        pocketWidth: typeof saved?.pocketWidth === 'number' && Number.isFinite(saved.pocketWidth) && saved.pocketWidth >= 0 && saved.pocketWidth <= 1000 ? saved.pocketWidth : 0,
        strictDecimals: saved?.strictDecimals === true,
        optionalStop: saved?.optionalStop === true,
        language: saved?.language === 'en' ? 'en' : 'ja',
        program: typeof saved?.program === 'string' ? saved.program : current.program,
      };
    },
  },
));
