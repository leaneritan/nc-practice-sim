import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ja } from './i18n/ja';

export type Language = 'ja' | 'en';
interface AppState {
  language: Language;
  program: string;
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
    language: 'ja', program: ja.sampleProgram,
    setLanguage: (language) => set({ language }),
    setProgram: (program) => set({ program }),
  }),
  {
    name: 'nc-practice-phase1',
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ language, program }) => ({ language, program }),
    merge: (persisted, current) => {
      const saved = persisted as Partial<AppState> | null;
      return {
        ...current,
        language: saved?.language === 'en' ? 'en' : 'ja',
        program: typeof saved?.program === 'string' ? saved.program : current.program,
      };
    },
  },
));
