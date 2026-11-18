import type { Dispatch, SetStateAction } from 'react';
import { useI18n } from '../i18n';
import type { Machine, MachineMode, Controls } from '../nc/machine';
import { locked } from '../nc/machine';
import type { Vec3 } from '../nc';

export type JogInput = { axis: keyof Vec3; direction: -1 | 1 } | null;
export function ControlPanel({ machine, mode, start, hold, reset, controls, coolant, handle, setHandle, jog, setJog, optional }: {
  machine: Machine; mode: (mode: MachineMode) => void; start: () => void; hold: () => void; reset: () => void;
  controls: (controls: Partial<Controls>) => void; coolant: () => void; handle: 1 | 10 | 100;
  setHandle: Dispatch<SetStateAction<1 | 10 | 100>>; jog: (axis: keyof Vec3, direction: -1 | 1) => void;
  setJog: Dispatch<SetStateAction<JogInput>>; optional: (enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const manual = ['JOG', 'RAPID', 'HANDLE', 'ZERO RETURN'].includes(machine.mode);
  const blocked = locked(machine) || machine.status === 'alarm';
  return <aside className="operator-panel" aria-label={t.panel.controls}>
    <div role="group" aria-label={t.panel.mode} className="mode-keys">
      {Object.entries(t.panel.modes).map(([id, label]) => <button key={id} disabled={id === 'TAPE' || blocked}
        aria-pressed={machine.mode === id} onClick={() => mode(id as MachineMode)}>{label}</button>)}
    </div>
    <div className="cycle-keys">
      <button className="start-key" disabled={!['MEMORY', 'MDI'].includes(machine.mode) || ['running', 'alarm'].includes(machine.status)} onClick={start}>{t.panel.cycleStart}</button>
      <button className="hold-key" disabled={machine.status !== 'running'} onClick={hold}>{t.panel.feedHold}</button>
      <button className="reset-key" onClick={reset}>{t.panel.reset}</button>
    </div>
    <div className="switch-keys">
      <label><input type="checkbox" checked={machine.controls.singleBlock} onChange={event => controls({ singleBlock: event.target.checked })} />{t.panel.singleBlock}</label>
      <label><input type="checkbox" checked={machine.controls.dryRun} onChange={event => controls({ dryRun: event.target.checked })} />{t.panel.dryRun}</label>
      <label><input type="checkbox" checked={machine.controls.optionalStop} onChange={event => optional(event.target.checked)} />{t.panel.optionalStop}</label>
      <button aria-pressed={machine.state.coolant} onClick={coolant}>{t.panel.coolant}</button>
    </div>
    <div className="overrides">
      <label>{t.panel.feedOverride} <output>{machine.controls.feed}{t.panel.percent}</output>
        <input type="range" aria-label={t.panel.feedOverride} min="0" max="150" step="5" value={machine.controls.feed} onChange={event => controls({ feed: Number(event.target.value) })} /></label>
      <label>{t.panel.rapidOverride}
        <select aria-label={t.panel.rapidOverride} value={machine.controls.rapid} onChange={event => controls({ rapid: Number(event.target.value) as 25 | 50 | 100 })}>
          {[25, 50, 100].map(value => <option key={value} value={value}>{value}{t.panel.percent}</option>)}
        </select></label>
      <label>{t.panel.spindleOverride} <output>{machine.controls.spindle}{t.panel.percent}</output>
        <input type="range" aria-label={t.panel.spindleOverride} min="50" max="120" step="5" value={machine.controls.spindle} onChange={event => controls({ spindle: Number(event.target.value) })} /></label>
    </div>
    <fieldset className="manual-pad" disabled={!manual || blocked}>
      <legend>{t.panel.manual}</legend>
      <label>{t.panel.handleScale}<select aria-label={t.panel.handleScale} value={handle} onChange={event => setHandle(Number(event.target.value) as 1 | 10 | 100)}>
        {[1, 10, 100].map(value => <option key={value} value={value}>×{value}</option>)}</select></label>
      <div className="axis-keys">{(['x', 'y', 'z'] as const).map(axis => <div key={axis}>
        {([-1, 1] as const).map(direction => <button key={direction} aria-label={`${axis.toUpperCase()}${direction === 1 ? t.panel.plus : t.panel.minus}`}
          onPointerDown={event => {
            if (machine.mode === 'JOG' || machine.mode === 'RAPID') {
              event.currentTarget.setPointerCapture?.(event.pointerId); jog(axis, direction); setJog({ axis, direction });
            }
          }} onPointerUp={() => setJog(null)} onPointerCancel={() => setJog(null)} onLostPointerCapture={() => setJog(null)}
          onClick={event => { if (['HANDLE', 'ZERO RETURN'].includes(machine.mode) || event.detail === 0) jog(axis, direction); }}>
          {axis.toUpperCase()}{direction === 1 ? t.panel.plus : t.panel.minus}
        </button>)}
      </div>)}</div>
    </fieldset>
    <p className="hint">{machine.mode === 'ZERO RETURN' ? t.panel.referenceHint : t.panel.manualHint}</p>
    <details><summary>{t.explanation}</summary><p>{t.panel.dryHint}</p><p>{t.panel.spindleHint}</p></details>
  </aside>;
}
