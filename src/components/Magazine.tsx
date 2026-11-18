import { useI18n } from '../i18n';
import type { ToolData } from '../setup';
export function Magazine({ tools, mounted, selected, changing }: { tools: ToolData[]; mounted: number | null; selected: number | null; changing: boolean }) {
  const { t } = useI18n();
  return <section className="magazine" aria-label={t.sim.magazine}>
    <h3>{t.sim.magazine}</h3><p>{t.sim.mounted}: T{mounted ?? t.dash} · {t.sim.selected}: T{selected ?? t.dash} {changing && `· ${t.sim.changing}`}</p>
    <ol className="magazine-pockets">{tools.map(tool => <li key={tool.pocket} className={tool.pocket === mounted ? 'mounted' : tool.pocket === selected ? 'selected' : ''}>
      <strong>T{tool.pocket}</strong><span>{t.panel.kinds[tool.kind]}</span><small>{tool.actual} {t.mm} · {t.panel.length} {tool.length}</small>
      {tool.pocket === mounted && <b>{t.sim.mounted}</b>}{tool.pocket === selected && tool.pocket !== mounted && <b>{t.sim.selected}</b>}
    </li>)}</ol><p className="hint">{t.sim.magazineHint}</p>
  </section>;
}
