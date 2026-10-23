type Series = { name: string; color: string; data: readonly { date: string; value: number }[]; dashed?: boolean };

/** Small, dependency-free SVG line chart. Renders on the server; scales to its container. */
export default function LineChart({
  series, height = 220, format = (v: number) => v.toFixed(1), yMin, yMax, label,
}: {
  series: Series[]; height?: number; format?: (v: number) => string; yMin?: number; yMax?: number; label: string;
}) {
  const W = 640, H = height, L = 46, R = 70, T = 14, B = 26;
  const all = series.flatMap((s) => s.data);
  const t = (d: string) => new Date(d + "T00:00:00Z").getTime();
  const x0 = Math.min(...all.map((p) => t(p.date))), x1 = Math.max(...all.map((p) => t(p.date)));
  let lo = yMin ?? Math.min(...all.map((p) => p.value)), hi = yMax ?? Math.max(...all.map((p) => p.value));
  const pad = (hi - lo) * 0.08 || 1;
  if (yMin == null) lo -= pad;
  if (yMax == null) hi += pad;
  const X = (d: string) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const ticks = 4;
  const yt = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);
  const y0 = new Date(x0).getUTCFullYear(), y1 = new Date(x1).getUTCFullYear();
  const step = y1 - y0 > 10 ? 3 : 2;
  const years: number[] = [];
  for (let y = y0; y <= y1; y += step) years.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block", overflow: "visible" }}>
      {yt.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" strokeWidth="1" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{format(v)}</text>
        </g>
      ))}
      {years.map((y) => (
        <text key={y} x={X(`${y}-01-01`)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{y}</text>
      ))}
      {series.map((s) => {
        const d = s.data.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
        const lp = s.data[s.data.length - 1];
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
            <circle cx={X(lp.date)} cy={Y(lp.value)} r="3.5" fill={s.color} />
            <text x={X(lp.date) + 8} y={Y(lp.value) + 4} fontSize="12" fontWeight="650" fill={s.color}>{format(lp.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}
