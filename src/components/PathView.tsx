import { machineToWork, segmentInWorkCoordinates } from '../nc/coordinates';
import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../i18n';
import type { MotionSegment, Vec3 } from '../nc';
import { boundsFor, fitTransform, pathGeometry, project, stock, vise } from '../view/path';
import type { Outline, ViewPlane } from '../view/path';
import { Term } from './Term';

const colors = { rapid: '#8c6740', feed: '#167965', stock: '#deeadb', vise: '#9ba5a4', tool: '#d55626' };
function CanvasView({ plane, geometry, position }: {
  plane: ViewPlane; geometry: ReturnType<typeof pathGeometry>; position: Vec3;
}) {
  const { t, language } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const width = Math.max(240, canvas.getBoundingClientRect().width);
      const height = 300;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const projected = geometry.map(path => ({ ...path, points: path.points.map(point => project(point, plane)) }));
      const bounds = boundsFor([
        ...[stock, ...vise].flatMap(outline => [project(outline.min, plane), project(outline.max, plane)]),
        ...projected.flatMap(path => path.points), project(position, plane),
      ]);
      const { scale, toPixel } = fitTransform(bounds, width, height);
      const outline = (shape: Outline, fill: string, stroke: string) => {
        const min = toPixel(project(shape.min, plane));
        const max = toPixel(project(shape.max, plane));
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.fillRect(min.u, max.v, max.u - min.u, min.v - max.v);
        ctx.strokeRect(min.u, max.v, max.u - min.u, min.v - max.v);
      };
      // Draw the base behind the jaws in both projections.
      [...vise].reverse().forEach(shape => outline(shape, '#e8eae7', colors.vise));
      outline(stock, colors.stock, '#68866a');
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#506259';
      ctx.lineWidth = 1;
      const origin = toPixel({ u: 0, v: 0 });
      ctx.strokeStyle = '#bcc9bf';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(20, origin.v); ctx.lineTo(width - 12, origin.v);
      ctx.moveTo(origin.u, 15); ctx.lineTo(origin.u, height - 18); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(t.x, width - 16, Math.max(14, Math.min(height - 10, origin.v - 5)));
      ctx.fillText(plane === 'XY' ? t.y : t.z, Math.min(width - 20, origin.u + 6), 16);
      // A 1/2/5 grid adapts to fit even a very large user program without excessive ticks.
      const rawStep = 50 / scale;
      const base = 10 ** Math.floor(Math.log10(rawStep));
      const step = [1, 2, 5, 10].find(value => value * base >= rawStep)! * base;
      const format = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
      const tick = (value: number) => format.format(Math.abs(value) < step * 1e-9 ? 0 : value);
      for (let u = Math.ceil(bounds.minU / step) * step; u <= bounds.maxU; u += step) {
        const pixel = toPixel({ u, v: bounds.minV });
        ctx.fillText(tick(u), pixel.u - 8, height - 7);
      }
      for (let v = Math.ceil(bounds.minV / step) * step; v <= bounds.maxV; v += step) {
        const pixel = toPixel({ u: bounds.minU, v });
        ctx.fillText(tick(v), 3, pixel.v + 3);
      }
      for (const path of projected) {
        ctx.beginPath();
        ctx.strokeStyle = path.kind === 'rapid' ? colors.rapid : colors.feed;
        ctx.lineWidth = path.kind === 'rapid' ? 1.3 : 2;
        ctx.setLineDash(path.kind === 'rapid' ? [6, 5] : []);
        path.points.forEach((point, index) => {
          const pixel = toPixel(point);
          if (index === 0) ctx.moveTo(pixel.u, pixel.v); else ctx.lineTo(pixel.u, pixel.v);
        });
        ctx.stroke();
      }
      const marker = toPixel(project(position, plane));
      ctx.setLineDash([]); ctx.strokeStyle = colors.tool; ctx.fillStyle = '#fff9eb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(marker.u, marker.v, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(marker.u - 9, marker.v); ctx.lineTo(marker.u + 9, marker.v);
      ctx.moveTo(marker.u, marker.v - 9); ctx.lineTo(marker.u, marker.v + 9); ctx.stroke();
    };
    draw();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    window.addEventListener('resize', draw);
    return () => { observer?.disconnect(); window.removeEventListener('resize', draw); };
  }, [plane, geometry, position, t.x, t.y, t.z, language]);
  return <figure className="path-figure">
    <figcaption>{plane === 'XY' ? t.xyView : t.xzView} · {t.mm}</figcaption>
    <canvas ref={ref} role="img" aria-label={plane === 'XY' ? t.xyCanvas : t.xzCanvas} />
  </figure>;
}

export function PathView({ segments, position, workShift = { x: 0, y: 0, z: 0 } }: { segments: MotionSegment[]; position: Vec3; workShift?: Vec3 }) {
  const { t } = useI18n();
  const geometry = useMemo(() => pathGeometry(segments.map(segmentInWorkCoordinates)), [segments]);
  return <section className="path-panel" aria-label={t.pathView}>
    <h3>{t.pathView}</h3>
    <div className="path-views">
      <CanvasView plane="XY" geometry={geometry} position={machineToWork(position, workShift)} />
      <CanvasView plane="XZ" geometry={geometry} position={machineToWork(position, workShift)} />
    </div>
    <div className="path-legend">
      <span><i className="legend-rapid" /><Term id="rapid" /></span>
      <span><i className="legend-feed" />{t.cutting}</span>
      <span><i className="legend-stock" /><Term id="stock" /></span>
      <span><i className="legend-vise" /><Term id="vise" /></span>
      <span><i className="legend-tool" />{t.toolMarker}</span>
    </div>
    <p className="hint">{t.stockNote}</p>
  </section>;
}
