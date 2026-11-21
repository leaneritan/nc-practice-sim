import { beforeEach, describe, expect, it } from 'vitest';
import { exportProgress, importProgress, mergeProgress, progressKey, recordAttempt } from './progress';
import { restoreLessons, useLessons } from './store';
import { lessons } from './catalog';
import { starterProgram } from './programs';
import { lessonEn, lessonJa } from './messages';
import { chapterIds } from '../guide/chapters';
import type { LessonCheck } from '../nc/lessons/checker';

const failed: LessonCheck = { passed: false, score: 60, maxError: 1, issues: [{ code: 'undercut' }], cells: [] };
const passed: LessonCheck = { passed: true, score: 100, maxError: 0, issues: [], cells: [] };
const first = '2026-11-21T10:00:00.000Z', second = '2026-11-21T11:00:00.000Z';
beforeEach(() => { localStorage.clear(); useLessons.setState({ progress: {}, drafts: {} }); });
describe('lesson progress', () => {
  it('counts attempts separately for every track and retains the best after a later failure', () => {
    let p = recordAttempt({}, 'face:mazatrol', failed, first);
    p = recordAttempt(p, 'face:mazatrol', passed, second);
    p = recordAttempt(p, 'face:mazatrol', failed, second);
    p = recordAttempt(p, 'face:eia', failed, first);
    expect(p['face:mazatrol']).toMatchObject({ attempts: 3, best: { passed: true, score: 100 }, last: { passed: false } });
    expect(p['face:eia']?.attempts).toBe(1);
    expect(p['drill:mazatrol']).toBeUndefined();
  });
  it('breaks score ties with height error and round-trips JSON', () => {
    let p = recordAttempt({}, 'pocket:eia', failed, first);
    p = recordAttempt(p, 'pocket:eia', { ...failed, maxError: .5 }, second);
    expect(p['pocket:eia']?.best.maxError).toBe(.5);
    expect(importProgress(exportProgress(p))).toEqual(p);
  });
  it('merges snapshots idempotently, preserving other tracks, best scores and latest attempts', () => {
    let current = recordAttempt({}, 'face:eia', passed, first);
    current = recordAttempt(current, 'drill:mazatrol', failed, first);
    let incoming = recordAttempt({}, 'face:eia', failed, second);
    incoming = recordAttempt(incoming, 'face:eia', failed, second);
    const merged = mergeProgress(current, incoming);
    expect(merged['face:eia']).toMatchObject({ attempts: 2, best: { passed: true }, last: { passed: false, at: second } });
    expect(merged['drill:mazatrol']).toEqual(current['drill:mazatrol']);
    expect(mergeProgress(merged, incoming)).toEqual(merged);
    expect(mergeProgress({}, current)).toEqual(current);
  });
  it.each([
    '{}', 'null', '[]', '{bad json', ' '.repeat(1_000_001),
    JSON.stringify({ format: 'nc-practice-lessons', version: 2, progress: {} }),
    JSON.stringify({ format: 'nc-practice-lessons', version: 1, progress: { 'unknown:eia': {} } }),
    '{"format":"nc-practice-lessons","version":1,"progress":{"__proto__":{}}}',
  ])('rejects invalid JSON/schema without changing state (%#)', json => {
    useLessons.getState().record('face:eia', passed); const before = useLessons.getState().progress;
    expect(() => importProgress(json)).toThrow(); expect(useLessons.getState().progress).toBe(before);
  });
  it.each(['attempts', 'score', 'date', 'error', 'inconsistent'])('rejects malformed %s data', field => {
    const data = JSON.parse(exportProgress(recordAttempt({}, 'tap:eia', passed, first)));
    const item = data.progress['tap:eia'];
    if (field === 'attempts') item.attempts = -1;
    if (field === 'score') item.best.score = 101;
    if (field === 'date') item.best.at = 'yesterday';
    if (field === 'error') item.best.maxError = null;
    if (field === 'inconsistent') item.best.passed = false;
    expect(() => importProgress(JSON.stringify(data))).toThrow();
  });
  it('restores progress and independent drafts from localStorage', async () => {
    const draft = starterProgram(lessons[0]!, 'mazatrol');
    useLessons.getState().setDraft('face:mazatrol', draft);
    useLessons.getState().setDraft('face:eia', { kind: 'eia', source: 'M30' });
    useLessons.getState().record('face:mazatrol', passed);
    const saved = localStorage.getItem('nc-practice-lessons-v1')!;
    useLessons.setState({ progress: {}, drafts: {} }); localStorage.setItem('nc-practice-lessons-v1', saved);
    await useLessons.persist.rehydrate();
    expect(useLessons.getState().drafts['face:mazatrol']).toEqual(draft);
    expect(useLessons.getState().drafts['face:eia']).toEqual({ kind: 'eia', source: 'M30' });
    expect(useLessons.getState().progress['face:mazatrol']?.best.passed).toBe(true);
  });
  it('ignores corrupt or mismatched drafts and preserves valid data', () => {
    const restored = restoreLessons({ progress: 'bad', drafts: { 'face:eia': { kind: 'mazatrol', data: {} }, 'drill:eia': { kind: 'eia', source: 'M30' }, 'tap:eia': { kind: 'eia', source: 'x'.repeat(200001) } } });
    expect(restored).toEqual({ progress: {}, drafts: { 'drill:eia': { kind: 'eia', source: 'M30' } } });
    expect(restoreLessons(null)).toEqual({ progress: {}, drafts: {} });
  });
  it('all seven lessons have bilingual content, both starters and valid guide links', () => {
    expect(lessons).toHaveLength(7);
    for (const lesson of lessons) {
      expect(chapterIds).toContain(lesson.chapter);
      for (const content of [lessonEn, lessonJa]) for (const text of Object.values(content.items[lesson.id])) expect(text.length).toBeGreaterThan(8);
      for (const track of ['eia', 'mazatrol'] as const) expect(starterProgram(lesson, track).kind).toBe(track);
      expect(progressKey(lesson.id, 'eia')).toBe(`${lesson.id}:eia`);
    }
    expect(Object.keys(lessonEn.issue)).toEqual(Object.keys(lessonJa.issue));
  });
});
