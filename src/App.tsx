import { useEffect, useState } from 'react';
import { Term } from './components/Term';
import { useI18n } from './i18n';
import { glossary } from './i18n/glossary';
import { runProgram } from './nc';
import type { RunResult, Vec3 } from './nc';
import { useAppStore } from './store';

export default function App() {
  const { t, language } = useI18n();
  const { program, setProgram, setLanguage } = useAppStore();
  const [result, setResult] = useState<RunResult | null>(null);
  const [executedProgram, setExecutedProgram] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const stale = result !== null && program !== executedProgram;
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.title;
  }, [language, t.title]);
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
  const point = (value: Vec3) => `${t.x} ${number(value.x)} · ${t.y} ${number(value.y)} · ${t.z} ${number(value.z)}`;
  function run() { setResult(runProgram(program)); setExecutedProgram(program); setPage(0); }

  return <main>
    <header className="app-header">
      <div><p className="eyebrow">{t.subtitle}</p><h1>{t.title}</h1></div>
      <div role="group" aria-label={t.language} className="language-switch">
        <button lang="ja" aria-pressed={language === 'ja'} onClick={() => setLanguage('ja')}>{t.japanese}</button>
        <button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>{t.english}</button>
      </div>
    </header>
    <p className="disclaimer">{t.disclaimer}</p>
    <p className="introduction">{t.introduction}</p>
    <div className="workspace">
      <section className="panel editor-panel" aria-labelledby="program-heading">
        <h2 id="program-heading"><Term id="program" label={t.programKey} /></h2>
        <label className="sr-only" htmlFor="program">{t.programLabel}</label>
        <textarea id="program" value={program} onChange={event => setProgram(event.target.value)}
          spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={200000} />
        <div className="actions">
          <button className="primary" onClick={run}>{t.run}</button>
          <button className="secondary" onClick={() => setProgram(t.sampleProgram)}>{t.reset}</button>
        </div>
        <p className="hint">{t.exampleHint}</p>
        <p className="hint">{t.assumptions}</p>
        <details><summary>{t.explanation}</summary><p>{t.capabilities}</p><p>{t.limitNote}</p></details>
      </section>
      <section className="panel result-panel" aria-labelledby="results-heading">
        <div className="result-heading"><h2 id="results-heading"><Term id="motion" /></h2>
          {result && <span className="badge">{result.segments.length} {t.count}</span>}
        </div>
        <p className="hint"><Term id="machineCoordinate" /> · {t.mm}</p>
        <p className="hint">{t.coordinates}</p>
        <div role="status" className="status">
          {stale ? t.stale : result ? result.alarms.length ? t.stopped : t.complete : t.ready}
        </div>
        {result?.alarms.map((alarm, index) => <div role="alert" className="alarm" key={index}>
          <strong><Term id="alarm" /> · {t.line} {alarm.line}</strong>
          <p>{t.alarms[alarm.code]} <code>{alarm.detail}</code></p>
        </div>)}
        {result && result.segments.length === 0 && <p className="empty">{t.empty}</p>}
        {result && result.segments.length > 0 && <div className="table-scroll" tabIndex={0} aria-label={t.results}>
          <table><thead><tr>
            <th>{t.line}</th><th>{t.type}</th><th>{t.from} / {t.to}</th>
            <th><Term id="feed" /></th><th>{t.geometry}</th>
          </tr></thead><tbody>
            {result.segments.slice(page * pageSize, (page + 1) * pageSize).map((segment, index) => <tr key={index}>
              <td className="line-number">{segment.line}</td>
              <td><Term id={segment.kind} /></td>
              <td className="coordinates"><div>{point(segment.from)}</div><div>{point(segment.to)}</div></td>
              <td>{segment.feed === null ? t.dash : `${number(segment.feed)} ${t.mmMin}`}</td>
              <td>{'center' in segment ? <>
                <div>{t.center}: {point(segment.center)}</div>
                <div>{t.radius}: {number(segment.radius)} {t.mm}</div>
                <div>{t.sweep}: {number(segment.sweep * 180 / Math.PI)}{t.degrees}</div>
              </> : t.dash}</td>
            </tr>)}
          </tbody></table>
        </div>}
        {result && result.segments.length > pageSize && <nav className="pagination" aria-label={t.results}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>{t.previous}</button>
          <span>{t.page} {page + 1} / {Math.ceil(result.segments.length / pageSize)}</span>
          <button disabled={(page + 1) * pageSize >= result.segments.length} onClick={() => setPage(page + 1)}>{t.next}</button>
        </nav>}
      </section>
    </div>
    <section className="panel glossary-panel" aria-labelledby="glossary-heading">
      <h2 id="glossary-heading">{t.glossary}</h2>
      <p className="hint">{t.glossaryHint}</p>
      <div className="glossary-list">{glossary.map(term => <Term key={term.id} id={term.id} />)}</div>
    </section>
  </main>;
}
