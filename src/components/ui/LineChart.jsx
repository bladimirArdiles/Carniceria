import { useMemo, useRef, useState } from "react";

const W = 360;
const H = 220;
const P = { t: 16, r: 16, b: 28, l: 48 };

function niceTicks(min, max, count = 4) {
  if (min === max) { min = Math.max(0, min - 1); max = max + 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/* Grafica SVG interactiva (reutilizada del proyecto anterior). Toca o desliza para leer cada punto. */
export default function LineChart({ points, formatValue, formatTick = String, formatX }) {
  const [active, setActive] = useState(null);
  const ref = useRef(null);

  const geo = useMemo(() => {
    if (!points || points.length === 0) return { ticks: [0], y: () => H / 2, coords: [], line: "" };
    const vals = points.map((p) => p.value);
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const x = (i) => P.l + (points.length <= 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
    const y = (v) => P.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - P.t - P.b);
    const coords = points.map((p, i) => [x(i), y(p.value)]);
    return { ticks, y, coords, line: coords.map((c, i) => (i ? "L" : "M") + c[0] + " " + c[1]).join(" ") };
  }, [points]);

  const idx = active ?? (points && points.length > 0 ? points.length - 1 : 0);
  const sel = points && points.length > 0 ? points[idx] : { date: "", value: 0 };

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    geo.coords.forEach((c, i) => {
      if (Math.abs(c[0] - px) < Math.abs(geo.coords[best][0] - px)) best = i;
    });
    setActive(best);
  };

  const step = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-mono text-3xl font-bold tracking-tight">{formatValue(sel.value)}</p>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{formatX(sel.date)}</p>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" role="img" aria-label="Gráfica de ventas"
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={geo.y(t)} y2={geo.y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="1" />
            <text x={P.l - 8} y={geo.y(t) + 4} textAnchor="end" className="fill-zinc-600 font-mono dark:fill-zinc-400" fontSize="10">{formatTick(t)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={p.date} x={geo.coords[i][0]} y={H - 8}
              textAnchor={i === 0 && points.length > 1 ? "start" : i === points.length - 1 && points.length > 1 ? "end" : "middle"}
              className="fill-zinc-600 dark:fill-zinc-400" fontSize="10">{formatX(p.date)}</text>
          ) : null
        )}
        {points.length > 1 && <path d={geo.line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-accent-700 dark:stroke-accent-400" />}
        <line x1={geo.coords[idx][0]} x2={geo.coords[idx][0]} y1={P.t} y2={H - P.b} strokeDasharray="3 4" className="stroke-zinc-400 dark:stroke-zinc-600" />
        {geo.coords.map((c, i) => (
          <circle key={i} cx={c[0]} cy={c[1]} r={i === idx ? 6 : 3.5}
            className={i === idx ? "fill-accent-500 stroke-white dark:stroke-zinc-900" : "fill-accent-700 dark:fill-accent-400"} strokeWidth={i === idx ? 3 : 0} />
        ))}
      </svg>
    </div>
  );
}
