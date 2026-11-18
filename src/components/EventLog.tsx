import { useState } from 'react';
import { useI18n } from '../i18n';
import type { ProgramEvent } from '../nc';

export function EventLog({ events }: { events: ProgramEvent[] }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const total = Math.ceil(events.length / 50);
  const current = Math.min(page, total - 1);
  return <details className="event-log" open>
    <summary>{t.events} · {events.length}</summary>
    <ol aria-label={t.events} start={current * 50 + 1}>
      {events.slice(current * 50, (current + 1) * 50).map((event, index) => <li key={index}>
        <span>{t.line} {event.line} · {t.afterSegment} {event.afterSegment}: </span>
        {event.kind === 'toolChange' ? `${t.sim.toolChange}: T${event.fromTool ?? 0} → T${event.tool}` : event.kind === 'dwell' ? `${t.dwell} ${event.durationMs} ${t.milliseconds}`
          : event.kind === 'spindle' ? event.direction === 'cw' ? t.spindleCW : t.spindleCCW
          : event.code === 0 ? t.mandatoryStop : event.paused ? t.optionalPaused : t.optionalSkipped}
      </li>)}
    </ol>
    {total > 1 && <nav className="pagination" aria-label={t.events}>
      <button disabled={current === 0} onClick={() => setPage(current - 1)}>{t.previous}</button>
      <span>{t.page} {current + 1} / {total}</span>
      <button disabled={current === total - 1} onClick={() => setPage(current + 1)}>{t.next}</button>
    </nav>}
  </details>;
}
