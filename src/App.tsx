import { usePrograms } from './programs';
import { expandMazatrol } from './nc/mazatrol/expand';
import { ProgramLibrary } from './components/ProgramLibrary';
import { MazatrolEditor } from './components/MazatrolEditor';
import { UnitShapes } from './components/UnitShapes';
import { StockView } from './components/StockView';
import { Magazine } from './components/Magazine';
import { machineHome, simulationOptions } from './setup';
import { createStock } from './nc/stock';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { HelpButton } from './guide/HelpButton';
import { helpChapter } from './guide/chapters';
import type { GuideChapter, MachineScreen } from './guide/chapters';
import { useI18n } from './i18n';
import { glossary } from './i18n/glossary';
import { useAppStore } from './store';
import { Term } from './components/Term';
import { PathView } from './components/PathView';
import { EventLog } from './components/EventLog';
import { ToolDataScreen, WorkOffsetScreen } from './components/SetupScreens';
import { ControlPanel } from './components/ControlPanel';
import type { JogInput } from './components/ControlPanel';
import PracticePreview from './PracticePreview';
import { parseProgram } from './nc';
import type { InterpreterOptions, Vec3 } from './nc';
import { activeWorkShift, machineToWork } from './nc/coordinates';
import { createMachine, cycleStart, distanceRemaining, feedHold, locked, manualMove, motionRate, currentSegment,
  resetMachine, setControls, setCoolant, setMode, tickMachine, visibleSegments } from './nc/machine';

const Guide = lazy(() => import('./guide/Guide'));
type Screen = MachineScreen;
const axes = ['x', 'y', 'z'] as const;
export default function App() {
  const { t, language } = useI18n();
  const store = useAppStore();
  const library = usePrograms();
  const programDocument = library.documents.find(d => d.id === library.activeId);
  const expansion = useMemo(() => programDocument?.kind === 'mazatrol' ? expandMazatrol(programDocument.data, store.tools) : null, [programDocument, store.tools]);
  const unitLabels = useMemo(() => expansion && programDocument?.kind === 'mazatrol' ? Object.fromEntries(Object.entries(expansion.lineUnits).map(([line,id]) => {
    const index = programDocument.data.units.findIndex(unit => unit.id === id);
    const kind = programDocument.data.units[index]?.kind;
    return [line, `${index + 1} · ${kind ? t.maz.unitNames[kind] : id}`];
  })) : undefined, [expansion, programDocument, t.maz.unitNames]);
  const memorySource = programDocument?.kind === 'mazatrol' ? expansion!.source : programDocument?.kind === 'eia' ? programDocument.source : store.program;
  const updateSource = (source: string) => programDocument?.kind === 'eia' ? library.update({ ...programDocument, source }) : store.setProgram(source);
  const [machine, setMachine] = useState(() => setControls(createMachine(machineHome), { optionalStop: store.optionalStop }));
  const [screen, setScreen] = useState<Screen>('PROGRAM');
  const [guideChapter, setGuideChapter] = useState<GuideChapter | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [mdi, setMdi] = useState('');
  const [handle, setHandle] = useState<1 | 10 | 100>(1);
  const [jogInput, setJogInput] = useState<JogInput>(null);
  const [sample, setSample] = useState<keyof typeof t.samples>('contour');
  const busy = locked(machine);
  const options = useMemo<InterpreterOptions>(() => ({ ...simulationOptions(store.workOffsets, store.tools, store.pocketWidth),
    strictDecimals: store.strictDecimals, optionalStop: store.optionalStop, sourceUnits: unitLabels,
  }), [store.workOffsets, store.tools, store.pocketWidth, store.strictDecimals, store.optionalStop, unitLabels]);
  const activeOptions = machine.session?.options ?? options;
  const shift = activeWorkShift(machine.state, activeOptions);
  const work = machineToWork(machine.state.position, shift);
  const trace = useMemo(() => visibleSegments(machine), [machine]);
  const source = machine.mode === 'MDI' ? mdi : memorySource;
  const warnings = useMemo(() => parseProgram(source, { strictDecimals: store.strictDecimals }).warnings, [source, store.strictDecimals]);
  const number = (value: number) => (Math.abs(value) < .0000001 ? 0 : value).toFixed(3);
  const segment = currentSegment(machine);
  const actualFeed = machine.status === 'running' && segment ? motionRate(segment, machine.controls) : 0;
  const actualSpeed = machine.state.spindle === 'off' ? 0 : machine.state.speed * machine.controls.spindle / 100;
  const editable = !busy && machine.status !== 'alarm' && (machine.mode === 'EDIT' || machine.mode === 'MDI');
  function invalidate() { setMachine(current => resetMachine(current)); }
  function openGuide(chapter: GuideChapter) {
    if (!guideChapter && document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    setJogInput(null);
    setMachine(feedHold);
    setGuideChapter(chapter);
  }
  useEffect(() => { if (!guideChapter) returnFocus.current?.focus(); }, [guideChapter]);
  useEffect(() => { document.documentElement.lang = language; document.title = t.title; }, [language, t.title]);
  useEffect(() => {
    if (machine.status !== 'running') return;
    const timer = window.setInterval(() => setMachine(current => tickMachine(current, 50)), 50);
    return () => window.clearInterval(timer);
  }, [machine.status]);
  useEffect(() => {
    if (!jogInput || busy || !['JOG', 'RAPID'].includes(machine.mode)) return;
    const timer = window.setInterval(() => setMachine(current => manualMove(current, jogInput.axis, jogInput.direction, handle, options)), 100);
    return () => window.clearInterval(timer);
  }, [jogInput, busy, machine.mode, handle, options]);
  useEffect(() => {
    const map: Record<string, Exclude<JogInput, null>> = {
      ArrowRight: { axis: 'x', direction: 1 }, ArrowLeft: { axis: 'x', direction: -1 },
      ArrowUp: { axis: 'y', direction: 1 }, ArrowDown: { axis: 'y', direction: -1 },
      PageUp: { axis: 'z', direction: 1 }, PageDown: { axis: 'z', direction: -1 },
    };
    const stop = () => setJogInput(null);
    const down = (event: KeyboardEvent) => {
      if (guideChapter) return;
      if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select, button') || event.target.isContentEditable)) return;
      if (!['JOG', 'RAPID', 'HANDLE'].includes(machine.mode) || busy || !map[event.key]) return;
      event.preventDefault(); if (event.repeat) return;
      const input = map[event.key]!;
      setMachine(current => manualMove(current, input.axis, input.direction, handle, options));
      if (machine.mode !== 'HANDLE') setJogInput(input);
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', stop); window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', stop); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); };
  }, [machine.mode, busy, handle, options, guideChapter]);

  const activeTools = activeOptions.safety?.tools ?? store.tools;
  const stockOrigin = activeOptions.safety?.stockOrigin ?? store.workOffsets[54];
  const tool = activeTools.find(tool => tool.pocket === machine.state.tool);
  const pending = machine.session?.pending;
  const operation = pending?.operations[pending.index];
  const changing = operation?.kind === 'event' && operation.event.kind === 'toolChange';
  const stockView = <StockView stock={machine.stock} position={machine.state.position} origin={stockOrigin} tool={tool} />;
  const magazine = <Magazine tools={store.tools} mounted={machine.state.tool} selected={pending?.state.selectedTool ?? machine.state.selectedTool} changing={!!changing} />;
  function coordinates(label: string, point: Vec3, term: 'workCoordinate' | 'machineCoordinate' | null) {
    return <section className="position-card" aria-label={label}>
      <h3>{term ? <Term id={term} label={label} /> : label}</h3>
      <dl>{axes.map(axis => <div key={axis}><dt>{axis.toUpperCase()}</dt><dd aria-label={`${label} ${axis.toUpperCase()}`}>{number(point[axis])}</dd></div>)}</dl>
    </section>;
  }
  return <main className="machine-app">
    <header className="app-header"><div><p className="eyebrow">{t.subtitle}</p><h1>{t.title}</h1></div>
      <div className="header-actions"><button className="secondary" onClick={() => openGuide('start')}>{t.guide.title}</button>
      <div role="group" aria-label={t.language} className="language-switch">
        <button lang="ja" aria-pressed={language === 'ja'} onClick={() => store.setLanguage('ja')}>{t.japanese}</button>
        <button lang="en" aria-pressed={language === 'en'} onClick={() => store.setLanguage('en')}>{t.english}</button>
      </div>
      </div>
    </header>
    <p className="disclaimer">{t.disclaimer}</p><p className="hint">{t.sim.defaults}</p>
    {guideChapter && <Suspense fallback={<p role="status">{t.guide.loading}</p>}><Guide chapter={guideChapter} onChapter={setGuideChapter} onClose={() => setGuideChapter(null)} /></Suspense>}
    <div hidden={guideChapter !== null}>
    <div className="machine-console">
      <div className="display-unit">
        <div className="machine-status" role="status" aria-label={t.panel.statusLabel}>
          <strong>{t.panel.modes[machine.mode]} · {t.panel.status[machine.status]}</strong>
          <span>{activeOptions.sourceUnits?.[machine.line] && <>{t.maz.unit} {activeOptions.sourceUnits[machine.line]} · </>}{t.panel.programNo} {machine.programNumber ?? t.dash} · {t.panel.block} {machine.line || t.dash}</span>
          <span>S {number(actualSpeed)} · F {number(actualFeed)} · T {machine.state.tool ?? t.dash}</span>
          <span>{t.panel.spindle}: {t.panel[machine.state.spindle]} · {t.panel.coolant}: {machine.state.coolant ? t.panel.on : t.panel.off}</span>
        </div>
        <div id="machine-screen" role="tabpanel" aria-labelledby={`tab-${screen.replaceAll(' ', '-')}`} className="machine-screen">
          <div className="screen-help"><HelpButton chapter={helpChapter(screen, programDocument?.kind === 'mazatrol', machine.mode === 'MDI')} onOpen={openGuide} /></div>
          {screen === 'POSITION' && <section>
            <h2>{t.panel.screens.POSITION}</h2>
            <div className="position-grid">
              {coordinates(t.panel.workPosition, work, 'workCoordinate')}
              {coordinates(t.panel.machinePosition, machine.state.position, 'machineCoordinate')}
              {coordinates(t.panel.remaining, distanceRemaining(machine), null)}
            </div>
            <p className="hint">G{machine.state.workSystem} · H{machine.state.lengthOffset ?? 0} · {t.panel.block} {machine.line || t.dash}</p>
            <PathView segments={trace} position={machine.state.position} workShift={shift} />
            <p className="hint">{t.panel.traceHint}</p>{stockView}{magazine}
          </section>}
          {screen === 'PROGRAM' && <section>
            <h2>{t.panel.screens.PROGRAM}</h2>
            {machine.mode !== 'MDI' && <ProgramLibrary disabled={!editable} beforeChange={invalidate} />}
            {machine.mode !== 'MDI' && programDocument?.kind === 'mazatrol' && expansion ? <MazatrolEditor key={programDocument.id} data={programDocument.data} expansion={expansion} disabled={!editable} onChange={data => { invalidate(); library.update({ ...programDocument, data }); }} /> : <>
            {machine.mode !== 'MDI' && <div className="sample-picker">
              <label htmlFor="sample">{t.selectSample}</label>
              <select id="sample" value={sample} disabled={!editable} onChange={event => setSample(event.target.value as keyof typeof t.samples)}>
                {Object.entries(t.samples).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
              </select>
              <button className="secondary" disabled={!editable} onClick={() => { invalidate(); updateSource(t.samples[sample].program); }}>{t.reset}</button>
              <p className="hint">{t.samples[sample].description}</p>
            </div>}
            <label htmlFor="machine-program">{machine.mode === 'MDI' ? t.panel.mdiLabel : t.programLabel}</label>
            <textarea id="machine-program" spellCheck={false} maxLength={200000} value={source} readOnly={!editable}
              onChange={event => {
                if (machine.mode === 'MDI') {
                  // A new MDI entry retains the current G/M modal state and physical position.
                  setMachine(current => ({ ...current, session: null, status: 'idle', segments: [], events: [], line: 0,
                    state: { ...current.state, ended: false, paused: null } }));
                  setMdi(event.target.value);
                } else { invalidate(); updateSource(event.target.value); }
              }} />
            <p className="hint">{machine.mode === 'MDI' ? t.panel.mdiHint : t.panel.memoryHint}</p>
            {!editable && <p className="hint">{busy ? t.panel.setupLocked : t.panel.editHint}</p>}
            <label className="strict-setting"><input type="checkbox" disabled={busy} checked={store.strictDecimals}
              onChange={event => { invalidate(); store.setStrictDecimals(event.target.checked); }} />{t.strictDecimals}</label>
            {warnings.length > 0 && <aside role="note" aria-label={t.decimalWarning} className="decimal-warning">
              <strong>{t.decimalWarning} · {warnings.length}</strong><p>{t.decimalExplanation}</p>
              <p>{store.strictDecimals ? t.decimalStrict : t.decimalNormal}</p>
              <details><summary>{t.explanation}</summary><ul>{warnings.slice(0, 50).map((warning, index) => <li key={index}>{t.line} {warning.line}: {warning.word} · {t.interpreted} {warning.interpreted} {t.mm}</li>)}</ul></details>
            </aside>}
            </>}
          </section>}
          {screen === 'SHAPE CHECK' && <section>
            <h2>{t.panel.screens['SHAPE CHECK']} · <Term id="workCoordinate" /></h2>
            {expansion && <><UnitShapes shapes={expansion.shapes} />{expansion.issues.map((issue,i) => <p className="alarm" role="alert" key={i}>{t.maz.unit} {issue.unit}: {t.maz.errors[issue.code]}</p>)}</>}
            {expansion?.issues.length ? null : (busy || machine.session || trace.length > 0) ? <><PathView segments={trace} position={machine.state.position} workShift={shift} />
              {stockView}<p className="hint">{t.panel.traceHint}</p>{machine.events.length > 0 && <EventLog events={machine.events} />}
              {!busy && <p className="hint">{t.panel.previewResetHint}</p>}</>
              : <PracticePreview embedded showEditor={false} modalState={machine.state} initialStock={machine.stock} programSource={memorySource} sourceUnits={unitLabels} />}
          </section>}
          {screen === 'WORK OFFSET' && <WorkOffsetScreen disabled={busy} active={machine.state.workSystem} beforeEdit={invalidate}
            select={system => setMachine(current => { const reset = resetMachine(current); return { ...reset, state: { ...reset.state, workSystem: system } }; })} />}
          {screen === 'TOOL DATA' && <><ToolDataScreen disabled={busy} beforeEdit={invalidate} />{magazine}</>}
          {screen === 'ALARM' && <section><h2>{t.panel.screens.ALARM}</h2>
            {machine.alarms.length === 0 ? <p>{t.panel.noAlarms}</p> : machine.alarms.map((alarm, index) => <div role="alert" className="alarm" key={index}>
              <strong>{activeOptions.sourceUnits?.[alarm.line] && <>{t.maz.unit} {activeOptions.sourceUnits[alarm.line]} · </>}{t.line} {alarm.line} · {alarm.detail}</strong><p>{t.alarms[alarm.code]}</p>
            </div>)}<p className="hint">{t.panel.alarmHint}</p>
          </section>}
        </div>
        <nav role="tablist" aria-label={t.panel.screensLabel} className="screen-keys">{Object.entries(t.panel.screens).map(([id, label]) =>
          <button role="tab" id={`tab-${id.replaceAll(' ', '-')}`} aria-controls="machine-screen" aria-selected={screen === id} key={id} onClick={() => setScreen(id as Screen)}>{label}</button>)}</nav>
      </div>
      <ControlPanel help={<HelpButton chapter="controls" onOpen={openGuide} />} machine={machine} mode={mode => { setJogInput(null); setMachine(current => setMode(current, mode)); setScreen(['EDIT', 'MDI'].includes(mode) ? 'PROGRAM' : 'POSITION'); }}
        start={() => { setMachine(current => expansion?.issues.length && current.mode !== 'MDI' ? { ...current, status: 'alarm', alarms: [{ code: 'unitParameters', line: 0, detail: expansion.issues[0]!.unit }] } : cycleStart(current, current.mode === 'MDI' ? mdi : memorySource, current.mode === 'MDI' ? { ...options, sourceUnits: undefined } : options)); setScreen('POSITION'); }}
        hold={() => { setJogInput(null); setMachine(feedHold); }} reset={() => { setJogInput(null); setMachine(resetMachine); }}
        controls={changes => setMachine(current => setControls(current, changes))} coolant={() => setMachine(setCoolant)} handle={handle} setHandle={setHandle}
        optional={enabled => { store.setOptionalStop(enabled); setMachine(current => setControls(current, { optionalStop: enabled })); }}
        jog={(axis, direction) => setMachine(current => manualMove(current, axis, direction, handle, options))} setJog={setJogInput} />
    </div>
    <section className="panel setup-actions"><HelpButton chapter="setup" onOpen={openGuide} /><button disabled={busy} onClick={() => { setJogInput(null); store.resetSetup(); setMachine(setControls(createMachine(machineHome), { optionalStop: store.optionalStop })); }}>{t.sim.resetSetup}</button><p className="hint">{t.sim.resetHint}</p>
      <button disabled={busy} onClick={() => setMachine(current => ({ ...resetMachine(current), stock: createStock() }))}>{t.sim.newStock}</button><p className="hint">{t.sim.stockHint}</p></section>
    {machine.alarms.length > 0 && screen !== 'ALARM' && <button className="alarm-summary" onClick={() => setScreen('ALARM')}>{t.panel.screens.ALARM} · {t.line} {machine.alarms[0]!.line} · {t.alarms[machine.alarms[0]!.code]}</button>}
    <section className="panel glossary-panel" aria-labelledby="glossary-heading"><h2 id="glossary-heading">{t.glossary}</h2><p className="hint">{t.glossaryHint}</p>
      <HelpButton chapter="start" onOpen={openGuide} />
      <div className="glossary-list">{glossary.map(term => <Term key={term.id} id={term.id} />)}</div>
    </section>
    </div>
  </main>;
}
