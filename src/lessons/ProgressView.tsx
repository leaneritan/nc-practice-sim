import { useState } from 'react';
import { useI18n } from '../i18n';
import { HelpButton } from '../guide/HelpButton';
import type { GuideChapter } from '../guide/chapters';
import { lessons } from './catalog';
import { importProgress, exportProgress, progressKey } from './progress';
import { useLessons } from './store';
import { tracks } from './types';
import type { LessonId, Track } from './types';

export function ProgressView({ onOpen, onGuide }: { onOpen: (id: LessonId, track: Track) => void; onGuide: (chapter: GuideChapter) => void }) {
  const { t, language } = useI18n(), l = t.lessons;
  const progress = useLessons(s => s.progress), merge = useLessons(s => s.import);
  const [message, setMessage] = useState<'imported' | 'invalidImport' | null>(null);
  return <section aria-label={l.progress}>
    <div className="result-heading"><h3>{l.progress}</h3><HelpButton chapter="checking" onOpen={onGuide} /></div>
    <p>{l.completed}: {Object.values(progress).filter(r => r.best.passed).length} / 14</p>
    <div className="lesson-table"><table><thead><tr><th>{l.title}</th><th>{l.track}</th><th>{l.best}</th><th>{l.last}</th><th>{l.attempts}</th><th>{l.open}</th></tr></thead>
      <tbody>{lessons.flatMap(lesson => tracks.map(track => {
        const r = progress[progressKey(lesson.id, track)];
        return <tr key={`${lesson.id}:${track}`}><th>{l.items[lesson.id].title}</th><td>{t.maz.formats[track]}</td>
          <td>{r ? `${r.best.passed ? l.pass : l.fail} · ${r.best.score}/100` : l.untried}</td>
          <td>{r ? <>{r.last.passed ? l.pass : l.fail} · {r.last.score}/100<br /><time dateTime={r.last.at}>{new Date(r.last.at).toLocaleString(language)}</time></> : t.dash}</td>
          <td>{r?.attempts ?? 0}</td><td><button onClick={() => onOpen(lesson.id, track)} aria-label={`${l.open}: ${l.items[lesson.id].title} · ${t.maz.formats[track]}`}>{l.open}</button></td></tr>;
      }))}</tbody></table></div>
    <p className="hint">{l.importHint}</p>
    <div className="lesson-actions"><button onClick={() => {
      const url = URL.createObjectURL(new Blob([exportProgress(progress)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = l.fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{l.export}</button>
      <label>{l.import}<input type="file" accept=".json,application/json" onChange={async event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
        try { if (file.size > 1_000_000) throw new Error(); const incoming = importProgress(await file.text()); merge(incoming); setMessage('imported'); }
        catch { setMessage('invalidImport'); }
      }} /></label></div>
    {message && <p role={message === 'invalidImport' ? 'alert' : 'status'}>{l[message]}</p>}
  </section>;
}
