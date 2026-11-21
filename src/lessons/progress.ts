import { lessonIds, tracks } from './types';
import type { LessonId, Track } from './types';
import type { LessonCheck } from '../nc/lessons/checker';

export type ProgressKey = `${LessonId}:${Track}`;
export const progressKeys = lessonIds.flatMap(id => tracks.map(track => `${id}:${track}` as ProgressKey));
export interface ResultSummary { passed: boolean; score: number; maxError: number; issueCount: number; at: string }
export interface ProgressRecord { attempts: number; best: ResultSummary; last: ResultSummary }
export type Progress = Partial<Record<ProgressKey, ProgressRecord>>;
export const progressKey = (id: LessonId, track: Track): ProgressKey => `${id}:${track}`;
const better = (a: ResultSummary, b: ResultSummary) =>
  a.passed !== b.passed ? a.passed : a.score !== b.score ? a.score > b.score : a.maxError < b.maxError;
export function recordAttempt(progress: Progress, key: ProgressKey, check: LessonCheck, at = new Date().toISOString()): Progress {
  const last = { passed: check.passed, score: check.score, maxError: check.maxError, issueCount: check.issues.length, at };
  const old = progress[key];
  return { ...progress, [key]: { attempts: (old?.attempts ?? 0) + 1, last, best: !old || better(last, old.best) ? last : old.best } };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function validSummary(v: unknown): v is ResultSummary {
  return object(v) && typeof v.passed === 'boolean' && typeof v.score === 'number' && Number.isInteger(v.score) && v.score >= 0 && v.score <= 100 &&
    typeof v.maxError === 'number' && Number.isFinite(v.maxError) && v.maxError >= 0 && v.maxError <= 10000 &&
    typeof v.issueCount === 'number' && Number.isSafeInteger(v.issueCount) && v.issueCount >= 0 && v.issueCount <= 100000 &&
    typeof v.at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.at) && Number.isFinite(Date.parse(v.at)) &&
    (v.passed ? v.score === 100 && v.issueCount === 0 : v.score < 100 && v.issueCount > 0);
}
export function validProgress(value: unknown): value is Progress {
  return object(value) && Object.entries(value).every(([key, v]) => progressKeys.includes(key as ProgressKey) && object(v) &&
    typeof v.attempts === 'number' && Number.isSafeInteger(v.attempts) && v.attempts > 0 && v.attempts < 1e9 &&
    validSummary(v.best) && validSummary(v.last) && !better(v.last, v.best));
}
export function exportProgress(progress: Progress): string {
  return JSON.stringify({ format: 'nc-practice-lessons', version: 1, progress }, null, 2);
}
/** Import is atomic and bounded; only the known lesson/track keys can reach persistent state. */
export function importProgress(json: string): Progress {
  if (json.length > 1_000_000) throw new Error('invalidProgress');
  const data: unknown = JSON.parse(json);
  if (!object(data) || data.format !== 'nc-practice-lessons' || data.version !== 1 || !validProgress(data.progress)) throw new Error('invalidProgress');
  return data.progress;
}
/** Idempotent merge: backups are snapshots, so counts use max rather than sum. */
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const merged = { ...current };
  for (const key of progressKeys) {
    const a = current[key], b = incoming[key];
    if (!b) continue;
    merged[key] = !a ? b : { attempts: Math.max(a.attempts, b.attempts), best: better(b.best, a.best) ? b.best : a.best,
      last: b.last.at > a.last.at ? b.last : a.last };
  }
  return merged;
}
