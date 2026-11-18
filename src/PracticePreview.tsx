import { StockView } from './components/StockView';
import { machineHome, simulationOptions } from './setup';
import type { Heightmap } from './nc/stock';
import { activeWorkShift, segmentInWorkCoordinates } from './nc/coordinates';
import type { InterpreterOptions, ModalState } from './nc';
import { useEffect, useMemo, useState } from 'react';
import { PathView } from './components/PathView';
import { EventLog } from './components/EventLog';
import { Term } from './components/Term';
import { useI18n } from './i18n';
import { glossary } from './i18n/glossary';
import { parseProgram, resumeProgram, runProgram } from './nc';
import type { RunResult, Vec3 } from './nc';
import { useAppStore } from './store';

export default function PracticePreview({ embedded = false, showEditor = true, modalState, initialStock }: { embedded?: boolean; showEditor?: boolean; modalState?: ModalState; initialStock?: Heightmap }) {
  const { t, language } = useI18n();
  const { program, setProgram, setLanguage, strictDecimals, optionalStop, setStrictDecimals, setOptionalStop, workOffsets, tools, pocketWidth } = useAppStore();
  const [result, setResult] = useState<RunResult | null>(null);
  const [executedProgram, setExecutedProgram] = useState('');
  const [executedSettings, setExecutedSettings] = useState('');
  const [sample, setSample] = useState<keyof typeof t.samples>('contour');
  const options: InterpreterOptions = { ...simulationOptions(workOffsets, tools, pocketWidth), strictDecimals, optionalStop, initialStock,
    ...(modalState ? { initialModalState: { ...modalState, paused: null, ended: false } } : {}) };
  const [resultOptions, setResultOptions] = useState<InterpreterOptions>({});
  const settingsKey = JSON.stringify(options);
  const warnings = useMemo(() => parseProgram(program, { strictDecimals }).warnings, [program, strictDecimals]);
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const stale = result !== null && (program !== executedProgram || settingsKey !== executedSettings);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.title;
  }, [language, t.title]);
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
  const point = (value: Vec3) => `${t.x} ${number(value.x)} · ${t.y} ${number(value.y)} · ${t.z} ${number(value.z)}`;
  function run() {
    setResult(runProgram(program, options)); setResultOptions(structuredClone(options));
    setExecutedProgram(program); setExecutedSettings(settingsKey); setPage(0);
  }

  return <div className={embedded ? "preview-embedded" : "preview-standalone"}>
    {!embedded && <><header className="app-header">
      <div><p className="eyebrow">{t.subtitle}</p><h1>{t.title}</h1></div>
      <div role="group" aria-label={t.language} className="language-switch">
        <button lang="ja" aria-pressed={language === 'ja'} onClick={() => setLanguage('ja')}>{t.japanese}</button>
        <button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>{t.english}</button>
      </div>
    </header>
    <p className="disclaimer">{t.disclaimer}</p>
    <p className="introduction">{t.introduction}</p></>}
    {!showEditor && <div className="actions"><button className="primary" onClick={run}>{t.run}</button><span className="hint">{t.sim.preview}</span></div>}
    <div className={showEditor ? 'workspace' : 'preview-result'}>
      {showEditor && <section className="panel editor-panel" aria-labelledby="program-heading">
        <h2 id="program-heading"><Term id="program" label={t.programKey} /></h2>
        <div className="sample-picker">
          <label htmlFor="sample">{t.selectSample}</label>
          <select id="sample" value={sample} onChange={event => setSample(event.target.value as keyof typeof t.samples)}>
            {Object.entries(t.samples).map(([id, entry]) => <option key={id} value={id}>{entry.name}</option>)}
          </select>
          <p className="hint">{t.samples[sample].description}</p>
        </div>
        <label className="sr-only" htmlFor="program">{t.programLabel}</label>
        <textarea id="program" value={program} onChange={event => setProgram(event.target.value)}
          spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={200000} />
        <div className="actions">
          <button className="primary" onClick={run}>{t.run}</button>
          <button className="secondary" onClick={() => setProgram(t.samples[sample].program)}>{t.reset}</button>
        </div>
        <fieldset className="settings">
          <label><input type="checkbox" checked={strictDecimals} onChange={event => setStrictDecimals(event.target.checked)} />{t.strictDecimals}</label>
          <label><input type="checkbox" checked={optionalStop} onChange={event => setOptionalStop(event.target.checked)} />{t.optionalStop}</label>
        </fieldset>
        {warnings.length > 0 && <aside role="note" aria-label={t.decimalWarning} className="decimal-warning">
          <strong>{t.decimalWarning} · {warnings.length}</strong>
          <p>{t.decimalExplanation}</p>
          <p>{strictDecimals ? t.decimalStrict : t.decimalNormal}</p>
          <details><summary>{t.explanation}</summary>
            <ul>{warnings.slice(0, 50).map((warning, index) => <li key={index}>
              {t.line} {warning.line}: <code>{warning.word}</code> · {t.interpreted} {number(warning.interpreted)} {t.mm}
              {' · '}{t.strictValue} {warning.strictValue.toFixed(3)} {t.mm}
            </li>)}</ul>
            {warnings.length > 50 && <p>{t.warningLimit}</p>}
          </details>
        </aside>}
        <p className="hint">{t.exampleHint}</p>
        <p className="hint">{t.assumptions}</p>
        <details><summary>{t.explanation}</summary><p>{t.capabilities}</p><p>{t.limitNote}</p></details>
      </section>}
      <section className="panel result-panel" aria-labelledby="results-heading">
        <div className="result-heading"><h2 id="results-heading"><Term id="motion" /></h2>
          {result && <span className="badge">{result.segments.length} {t.count}</span>}
        </div>
        <p className="hint"><Term id="workCoordinate" /> · {t.mm}</p>
        <p className="hint">{t.coordinates}</p>
        <div role="status" className="status">
          {stale ? t.stale : result ? result.alarms.length ? t.stopped : result.state.paused ? t.paused : t.complete : t.ready}
        </div>
        {result?.state.paused && <div className="pause-panel">
          <p>{result.state.paused.code === 0 ? t.mandatoryStop : t.optionalPaused} · {t.line} {result.state.paused.line}</p>
          <button className="primary" disabled={stale} onClick={() => { setResult(resumeProgram(result)); setPage(0); }}>{t.continueRun}</button>
          <p className="hint">{t.pauseHint}</p>
        </div>}
        <PathView segments={result?.segments ?? []} position={result?.state.position ?? machineHome} workShift={result ? activeWorkShift(result.state, resultOptions) : undefined} />
        {result?.stock && <StockView stock={result.stock} position={result.state.position} origin={resultOptions.safety?.stockOrigin ?? workOffsets[54]}
          tool={resultOptions.safety?.tools.find(tool => tool.pocket === result.state.tool)} />}
        {result && result.events.length > 0 && <EventLog events={result.events} />}
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
            {result.segments.slice(page * pageSize, (page + 1) * pageSize).map(segmentInWorkCoordinates).map((segment, index) => <tr key={index}>
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
    {!embedded && <section className="panel glossary-panel" aria-labelledby="glossary-heading">
      <h2 id="glossary-heading">{t.glossary}</h2>
      <p className="hint">{t.glossaryHint}</p>
      <div className="glossary-list">{glossary.map(term => <Term key={term.id} id={term.id} />)}</div>
    </section>}
  </div>;
}
