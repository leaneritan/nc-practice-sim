import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useAppStore } from '../store';
import { toolKinds, workSystems } from '../setup';
import type { ToolKind } from '../setup';
import type { WorkSystem } from '../nc';
import { Term } from './Term';

export function NumberField({ label, value, min, max, disabled, commit }: {
  label: string; value: number; min: number; max: number; disabled: boolean; commit: (value: number) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(String(value)); setInvalid(false); }, [value]);
  function save() {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || next < min || next > max) { setInvalid(true); return; }
    setInvalid(false); if (next !== value) commit(next);
  }
  return <span className="number-field">
    <input type="number" aria-label={label} min={min} max={max} step="any" value={draft} disabled={disabled}
      aria-invalid={invalid} onChange={event => setDraft(event.target.value)} onBlur={save}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    {invalid && <small role="alert">{t.panel.invalidNumber} ({min}…{max})</small>}
  </span>;
}
export function WorkOffsetScreen({ disabled, active, select, beforeEdit }: {
  disabled: boolean; active: WorkSystem; select: (id: WorkSystem) => void; beforeEdit: () => void;
}) {
  const { t } = useI18n();
  const { workOffsets, setWorkOffset } = useAppStore();
  return <section>
    <h2>{t.panel.screens['WORK OFFSET']} · <Term id="workOffset" /></h2>
    <p className="hint">{t.panel.offsetNote}</p><p className="hint">{disabled ? t.panel.setupLocked : t.panel.saveHint}</p>
    <div className="setup-scroll"><table><thead><tr><th><Term id="workCoordinate" /></th><th>{t.x}</th><th>{t.y}</th><th>{t.z}</th><th>{t.panel.select}</th></tr></thead>
      <tbody>{workSystems.map(system => <tr key={system}>
        <th scope="row">G{system}</th>
        {(['x', 'y', 'z'] as const).map(axis => <td key={axis}><NumberField label={`G${system} ${axis.toUpperCase()}`} value={workOffsets[system][axis]}
          min={-1e6} max={1e6} disabled={disabled} commit={value => { beforeEdit(); setWorkOffset(system, axis, value); }} /></td>)}
        <td><button disabled={disabled} aria-pressed={active === system} onClick={() => select(system)}>{active === system ? t.panel.active : t.panel.select} G{system}</button></td>
      </tr>)}</tbody></table></div>
  </section>;
}
export function ToolDataScreen({ disabled, beforeEdit }: { disabled: boolean; beforeEdit: () => void }) {
  const { t } = useI18n();
  const { tools, setTool, pocketWidth, setPocketWidth } = useAppStore();
  const fields = ['nominal', 'actual', 'length', 'life'] as const;
  return <section>
    <h2>{t.panel.screens['TOOL DATA']} · <Term id="toolLength" /></h2>
    <label>{t.sim.pocketWidth}<NumberField label={t.sim.pocketWidth} value={pocketWidth} min={0} max={1000} disabled={disabled} commit={value => { beforeEdit(); setPocketWidth(value); }} /></label><p className="hint">{t.sim.pocketHint}</p>
    <p className="hint">{t.panel.toolNote}</p><p className="hint">{disabled ? t.panel.setupLocked : t.panel.saveHint}</p>
    <div className="setup-scroll"><table><thead><tr><th>{t.panel.pocket}</th><th>{t.panel.kind}</th>{fields.map(field => <th key={field}>{t.panel[field]}</th>)}</tr></thead>
      <tbody>{tools.map(tool => <tr key={tool.pocket}>
        <th scope="row">{tool.pocket}</th>
        <td><select aria-label={`${t.panel.kind} T${tool.pocket}`} value={tool.kind} disabled={disabled}
          onChange={event => { beforeEdit(); setTool(tool.pocket, { kind: event.target.value as ToolKind }); }}>
          {toolKinds.map(kind => <option value={kind} key={kind}>{t.panel.kinds[kind]}</option>)}
        </select></td>
        {fields.map(field => <td key={field}><NumberField label={`${t.panel[field]} H${tool.pocket}`} value={tool[field]} min={field === 'actual' || field === 'length' ? .001 : 0}
          max={field === 'length' ? 10000 : field === 'life' ? 1e6 : 1000} disabled={disabled}
          commit={value => { beforeEdit(); setTool(tool.pocket, { [field]: value }); }} /></td>)}
      </tr>)}</tbody></table></div>
  </section>;
}
