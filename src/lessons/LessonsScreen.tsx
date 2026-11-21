import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { HelpButton } from '../guide/HelpButton';
import type { GuideChapter } from '../guide/chapters';
import { MazatrolEditor } from '../components/MazatrolEditor';
import { Term } from '../components/Term';
import { StockView } from '../components/StockView';
import { PathView } from '../components/PathView';
import { expandMazatrol } from '../nc/mazatrol/expand';
import { activeWorkShift } from '../nc/coordinates';
import { defaultTools } from '../setup';
import { parseProgram } from '../nc';
import { lessons } from './catalog';
import { starterProgram } from './programs';
import { runLesson } from './run';
import type { LessonRun } from './run';
import { progressKey } from './progress';
import { useLessons } from './store';
import { tracks } from './types';
import type { LessonDraft, LessonId, Track } from './types';
import { LessonDrawing } from './LessonDrawing';
import { ProgressView } from './ProgressView';

export type LessonView = 'lessons' | 'progress';
const tools = defaultTools();
export default function LessonsScreen({ view, onView, onClose, onGuide }: {
  view: LessonView; onView: (view: LessonView) => void; onClose: () => void; onGuide: (chapter: GuideChapter) => void;
}) {
  const { t } = useI18n(), l = t.lessons;
  const store = useLessons();
  const [id, setId] = useState<LessonId>('face'), [track, setTrack] = useState<Track>('mazatrol');
  const [strict, setStrict] = useState(false), [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState<{ key: string; draft: LessonDraft; strict: boolean; run: LessonRun } | null>(null);
  const [issueIndex, setIssueIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
  const lesson = lessons.find(item => item.id === id)!, key = progressKey(id, track);
  const starter = useMemo(() => starterProgram(lesson, track), [lesson, track]);
  const draft = store.drafts[key] ?? starter, content = l.items[id];
  const expansion = useMemo(() => draft.kind === 'mazatrol' ? expandMazatrol(draft.data, tools) : null, [draft]);
  const warnings = useMemo(() => draft.kind === 'eia' ? parseProgram(draft.source, { strictDecimals: strict }).warnings : [], [draft, strict]);
  const run = attempt?.key === key ? attempt.run : undefined;
  const status = (lessonId: LessonId, lessonTrack: Track) => {
    const record = store.progress[progressKey(lessonId, lessonTrack)];
    return record ? record.best.passed ? l.pass : l.fail : l.untried;
  };
  const stale = !!run && (attempt?.draft !== draft || attempt.strict !== strict);
  const selected = run?.check.issues[issueIndex];
  const markers = useMemo(() => [
    ...(run?.check.cells.map(c => ({ x: c.x, y: c.y, z: c.z + .6, kind: c.code })) ?? []),
    ...[selected?.at, selected?.actualAt].filter(p => !!p).map(p => ({ ...p, z: p.z + 1, kind: 'selected' as const })),
  ], [run, selected]);
  useEffect(() => { heading.current?.focus(); }, [view]);
  const open = (nextId: LessonId, nextTrack: Track) => { setId(nextId); setTrack(nextTrack); setIssueIndex(0); onView('lessons'); };
  function check() {
    setChecking(true);
    // Paint the busy state before the bounded synchronous core calculation.
    setTimeout(() => {
      try {
        const next = runLesson(lesson, draft, strict);
        setAttempt({ key, draft, strict, run: next }); setIssueIndex(0); store.record(key, next.check);
      } finally { setChecking(false); }
    }, 0);
  }
  useEffect(() => { if (attempt) resultHeading.current?.focus(); }, [attempt]);
  return <section className="lessons panel" aria-label={l.title}>
    <div className="result-heading"><h2 ref={heading} tabIndex={-1}>{view === 'progress' ? l.progress : l.title}</h2>
      <div className="lesson-actions"><button disabled={checking} onClick={() => onView(view === 'lessons' ? 'progress' : 'lessons')}>{view === 'lessons' ? l.progress : l.backToLessons}</button>
        <button disabled={checking} onClick={onClose}>{l.back}</button></div></div>
    {view === 'progress' ? <ProgressView onOpen={open} onGuide={onGuide} /> : <>
      <p>{l.intro}</p><p className="hint">{l.setup}</p>
      <div className="lesson-layout"><nav className="lesson-nav" aria-label={l.title}>{lessons.map(item => <button key={item.id} disabled={checking}
        aria-current={id === item.id ? 'page' : undefined} onClick={() => { setId(item.id); setIssueIndex(0); }}>{l.items[item.id].title}<small>{tracks.map(k => status(item.id, k)).join(' / ')}</small></button>)}</nav>
      <article className="lesson-content"><div className="result-heading"><h3>{content.title}</h3><HelpButton chapter={lesson.chapter} onOpen={onGuide} /></div>
        <h4>{l.learn}</h4><p>{content.learn}</p><p className="glossary-list">{lesson.terms.map(term => <Term key={term} id={term} />)}</p>
        <details><summary>{l.hint}</summary><p>{content.hint}</p></details>
        <button className="guide-link" onClick={() => onGuide(lesson.chapter)}>{l.guide} · {t.guide.chapters[lesson.chapter]}</button>
        <LessonDrawing lesson={lesson} cells={run?.check.cells} selected={selected} />
        <div className="lesson-actions" role="group" aria-label={l.track}>{tracks.map(k => <button key={k} disabled={checking} aria-pressed={track === k} onClick={() => setTrack(k)}>{t.maz.formats[k]} · {status(id, k)}</button>)}</div>
        <p className="hint">{l.starterHint}</p><button disabled={checking} onClick={() => store.setDraft(key, starterProgram(lesson, track))}>{l.starter}</button>
        {draft.kind === 'mazatrol' && expansion ? <MazatrolEditor key={key} data={draft.data} availableTools={tools} disabled={checking} expansion={expansion} onChange={data => store.setDraft(key, { kind: 'mazatrol', data })} /> : draft.kind === 'eia' && <>
          <label htmlFor="lesson-code">{l.program}</label><textarea id="lesson-code" value={draft.source} spellCheck={false} maxLength={200000} disabled={checking} onChange={e => store.setDraft(key, { kind: 'eia', source: e.target.value })} />
          <label className="strict-setting"><input type="checkbox" checked={strict} disabled={checking} onChange={e => setStrict(e.target.checked)} />{t.strictDecimals}</label>
          {warnings.length > 0 && <aside className="decimal-warning" role="note"><strong>{t.decimalWarning} · {warnings.length}</strong><p>{t.decimalExplanation}</p><p>{strict ? t.decimalStrict : t.decimalNormal}</p></aside>}
        </>}
        <button className="lesson-run" disabled={checking} onClick={check}>{checking ? l.running : l.run}</button>
        <p className="hint">{l.tolerance}</p>
        {run && <section className="lesson-result" aria-label={l.result}>
          <h3 ref={resultHeading} tabIndex={-1}>{l.result} · {stale ? l.stale : run.check.passed ? l.pass : l.fail}</h3>
          <p>{l.score}: {run.check.score}/100 · {l.maxError}: {run.check.maxError.toFixed(3)} {t.mm}</p><p className="hint">{l.scoreHint}</p>
          <p>{l.legend}</p>
          <ol className="lesson-issues">{run.check.issues.map((issue, i) => <li key={i}><button aria-pressed={issueIndex === i} onClick={() => setIssueIndex(i)}>
            {l.issue[issue.code]} {issue.alarm && t.alarms[issue.alarm]} {issue.line !== undefined && <span>{t.line} {issue.line}</span>}
            {issue.at && <span>{l.at}: X{issue.at.x.toFixed(3)} Y{issue.at.y.toFixed(3)} Z{issue.at.z.toFixed(3)}</span>}
            {issue.actualAt && <span>{l.actual}: X{issue.actualAt.x.toFixed(3)} Y{issue.actualAt.y.toFixed(3)} Z{issue.actualAt.z.toFixed(3)}</span>}
            {issue.expected !== undefined && <span>{l.expected}: {issue.expected.toFixed(3)} {t.mm}</span>}
            {issue.actual !== undefined && <span>{l.actual}: {issue.actual.toFixed(3)} {t.mm}</span>}
            {issue.count !== undefined && <span>{l.cells}: {issue.count}</span>}
          </button></li>)}</ol>
          {run.result.stock && <StockView stock={run.result.stock} position={run.result.state.position} origin={run.options.safety!.stockOrigin} rotation={run.options.safety!.stockRotation} markers={markers} />}
          <PathView segments={run.result.segments} position={run.result.state.position} workShift={activeWorkShift(run.result.state, run.options)} workRotation={run.options.wpc?.theta} />
        </section>}
      </article></div>
    </>}
  </section>;
}
