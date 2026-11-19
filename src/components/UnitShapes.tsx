import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { Expansion } from "../nc/mazatrol/expand";
import { boundsFor, fitTransform } from "../view/path";
export function UnitShapes({ shapes }: { shapes: Expansion["shapes"] }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const width = Math.max(240, canvas.clientWidth),
        height = 300,
        ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const points = shapes
        .flatMap((s) => s.points)
        .map((p) => ({ u: p.x, v: p.y }));
      const { toPixel } = fitTransform(
        boundsFor([{ u: 0, v: 0 }, { u: 100, v: 60 }, ...points]),
        width,
        height,
      );
      const a = toPixel({ u: 0, v: 0 }),
        b = toPixel({ u: 100, v: 60 });
      ctx.fillStyle = "#e2ebdd";
      ctx.fillRect(a.u, b.v, b.u - a.u, a.v - b.v);
      const colors = ["#187d68", "#985522", "#4c65b1"];
      shapes.forEach((shape, i) => {
        ctx.strokeStyle = colors[i % colors.length]!;
        ctx.lineWidth = 2;
        ctx.beginPath();
        shape.points.forEach((point, j) => {
          const p = toPixel({ u: point.x, v: point.y });
          if (j === 0) ctx.moveTo(p.u, p.v);
          else ctx.lineTo(p.u, p.v);
        });
        ctx.stroke();
      });
    };
    draw();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [shapes]);
  return (
    <section>
      <h3>{t.maz.shapeCheck}</h3>
      <p className="hint">{t.maz.shapeHint}</p>
      <canvas
        className="unit-canvas"
        role="img"
        aria-label={t.maz.shapeCheck}
        ref={ref}
      />
    </section>
  );
}
