import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { Term } from '../components/Term';
import { targetStock } from '../nc/lessons/target';
import type { CheckIssue, DifferenceCell } from '../nc/lessons/checker';
import type { LessonDefinition } from './types';
const noCells: DifferenceCell[] = [];

export function LessonDrawing({ lesson, cells = noCells, selected }: { lesson: LessonDefinition; cells?: DifferenceCell[]; selected?: CheckIssue }) {
  const { t, language } = useI18n(), l = t.lessons;
  const canvas = useRef<HTMLCanvasElement>(null), goal = lesson.target;
  useEffect(() => {
    const c = canvas.current?.getContext('2d'); if (!c) return;
    const px = (x: number) => 70 + x * 4.7, py = (y: number) => 350 - y * 4.7;
    c.clearRect(0, 0, 620, 420); c.fillStyle = '#f5f8f3'; c.fillRect(0, 0, 620, 420);
    const map = targetStock(goal);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      c.fillStyle = `hsl(168 22% ${84 + map.heights[y * map.width + x]! * 2}%)`;
      c.fillRect(px(x) - 2.35, py(y) - 2.35, 4.7, 4.7);
    }
    c.strokeStyle = '#27463d'; c.lineWidth = 1.5; c.strokeRect(px(0), py(60), 470, 282);
    c.font = '13px sans-serif'; c.fillStyle = '#203f36'; c.fillText(l.stockDimensions, 70, 25);
    const line = (x1: number, y1: number, x2: number, y2: number) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    const dimension = (x1: number, y1: number, x2: number, y2: number, label: string) => {
      line(x1, y1, x2, y2); line(x1 - 3, y1 - 4, x1 + 3, y1 + 4); line(x2 - 3, y2 - 4, x2 + 3, y2 + 4);
      c.fillText(label, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 5);
    };
    dimension(px(0), py(0) + 25, px(100), py(0) + 25, '100');
    dimension(px(0) - 25, py(0), px(0) - 25, py(60), '60');
    c.fillText(`0 · ${l.xAxis}/${l.yAxis}`, px(0) - 15, py(0) + 50);
    for (const r of [goal.pocket, goal.contour]) if (r) {
      c.strokeStyle = '#244f86'; c.strokeRect(px(r.x), py(r.y + r.height), r.width * 4.7, r.height * 4.7);
      dimension(px(r.x), py(r.y + r.height) - 10, px(r.x + r.width), py(r.y + r.height) - 10, `${r.width}`);
      dimension(px(r.x + r.width) + 12, py(r.y), px(r.x + r.width) + 12, py(r.y + r.height), `${r.height}`);
      c.fillText(`Z${r.bottom}`, px(r.x) + 5, py(r.y) - 8);
    }
    for (const [i, h] of goal.holes.entries()) {
      c.strokeStyle = '#27463d'; c.beginPath(); c.arc(px(h.x), py(h.y), (h.counterbore?.diameter ?? h.tap?.diameter ?? h.spotDiameter) * 2.35, 0, Math.PI * 2); c.stroke();
      line(px(h.x) - 4, py(h.y), px(h.x) + 4, py(h.y)); line(px(h.x), py(h.y) - 4, px(h.x), py(h.y) + 4);
      c.fillText(`${i + 1}`, px(h.x) + 10, py(h.y) - 12);
    }
    for (const cell of cells) { c.fillStyle = cell.code === 'overcut' ? '#c52f38' : '#cf900a'; c.fillRect(px(cell.x) - 1.5, py(cell.y) - 1.5, 3, 3); }
    for (const point of [selected?.at, selected?.actualAt]) if (point) {
      const x = Math.max(8, Math.min(612, px(point.x))), y = Math.max(8, Math.min(412, py(point.y)));
      c.strokeStyle = '#005dff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, 2 * Math.PI); c.stroke();
    }
  }, [goal, cells, selected, l.stockDimensions, l.xAxis, l.yAxis, language]);
  const rows: { label: React.ReactNode; xy: string; size: string; bottom: number }[] = [
    { label: <Term id="facing" label={l.face} />, xy: '0 / 0', size: '100 × 60', bottom: goal.face },
  ];
  goal.holes.forEach((h, i) => {
    const xy = `${h.x} / ${h.y}`, prefix = `${i + 1} · `;
    rows.push({ label: <>{prefix}<Term id="spotDrill" label={l.spot} /></>, xy, size: `${l.diameter}${h.spotDiameter}`, bottom: h.top - h.spotDiameter / 2 });
    rows.push({ label: <>{prefix}<Term id="drilling" label={l.hole} /></>, xy, size: `${l.diameter}${h.diameter}`, bottom: h.bottom });
    if (h.tap) rows.push({ label: <>{prefix}<Term id="tapping" label={l.tap} /></>, xy, size: `M${h.tap.diameter} × ${h.tap.pitch}`, bottom: h.tap.bottom });
    if (h.counterbore) rows.push({ label: <>{prefix}<Term id="counterbore" /></>, xy, size: `${l.diameter}${h.counterbore.diameter}`, bottom: h.counterbore.bottom });
  });
  for (const key of ['pocket', 'contour'] as const) {
    const r = goal[key]; if (r) rows.push({ label: <Term id={key === 'pocket' ? 'pocket' : 'outsideContour'} label={l[key]} />, xy: `${r.x} / ${r.y}`,
      size: `${r.width} × ${r.height} · ${key === 'pocket' ? `${l.radius} ${r.radius}` : `${l.band} ${r.radius * 2}`}`, bottom: r.bottom });
  }
  return <section aria-label={l.goal}>
    <h3>{l.goal}</h3><canvas ref={canvas} width={620} height={420} className="lesson-drawing" role="img" aria-label={`${l.goal}: ${l.items[lesson.id].title}`} aria-describedby="lesson-dimensions" />
    <div className="lesson-table"><table id="lesson-dimensions"><caption>{l.dimensions}</caption><thead><tr><th>{l.feature}</th><th>{l.position}</th><th>{l.size}</th><th>{l.bottom}</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><th>{r.label}</th><td>{r.xy}</td><td>{r.size}</td><td>{r.bottom}</td></tr>)}</tbody></table></div>
    <p className="hint">{l.depthHint}</p>
  </section>;
}
