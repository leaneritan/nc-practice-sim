import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../store';
import { validMazatrol } from '../programs';
import { progressKeys, validProgress, recordAttempt, mergeProgress } from './progress';
import type { Progress, ProgressKey } from './progress';
import type { LessonCheck } from '../nc/lessons/checker';
import type { LessonDraft } from './types';

interface LessonState {
  progress: Progress;
  drafts: Partial<Record<ProgressKey, LessonDraft>>;
  setDraft: (key: ProgressKey, draft: LessonDraft) => void;
  record: (key: ProgressKey, check: LessonCheck) => void;
  import: (progress: Progress) => void;
}
export function restoreLessons(value: unknown): Pick<LessonState, 'progress' | 'drafts'> {
  const result: Pick<LessonState, 'progress' | 'drafts'> = { progress: {}, drafts: {} };
  if (!value || typeof value !== 'object') return result;
  const data = value as Record<string, unknown>;
  if (validProgress(data.progress)) result.progress = data.progress;
  if (data.drafts && typeof data.drafts === 'object') {
    for (const key of progressKeys) {
      const draft: unknown = (data.drafts as Record<string, unknown>)[key];
      if (!draft || typeof draft !== 'object') continue;
      const d = draft as Record<string, unknown>;
      if (key.endsWith(':eia') && d.kind === 'eia' && typeof d.source === 'string' && d.source.length <= 200000) result.drafts[key] = { kind: 'eia', source: d.source };
      if (key.endsWith(':mazatrol') && d.kind === 'mazatrol' && validMazatrol(d.data)) result.drafts[key] = { kind: 'mazatrol', data: d.data };
    }
  }
  return result;
}
export const useLessons = create<LessonState>()(persist(set => ({
  progress: {}, drafts: {},
  setDraft: (key, draft) => set(s => ({ drafts: { ...s.drafts, [key]: draft } })),
  record: (key, check) => set(s => ({ progress: recordAttempt(s.progress, key, check) })),
  import: progress => set(s => ({ progress: mergeProgress(s.progress, progress) })),
}), {
  name: 'nc-practice-lessons-v1', version: 1, storage: createJSONStorage(() => safeStorage),
  partialize: s => ({ progress: s.progress, drafts: s.drafts }),
  merge: (saved, current) => ({ ...current, ...restoreLessons(saved) }),
}));
