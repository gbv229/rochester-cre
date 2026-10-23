type Row = { label: React.ReactNode; value: number; display: string; color?: string };

export default function Bars({ rows, max }: { rows: Row[]; max?: number }) {
  const m = max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar" key={i}>
          <div>{r.label}</div>
          <div className="track" aria-hidden="true">
            <div className="fill" style={{ width: `${(Math.abs(r.value) / m) * 100}%`, background: r.color || "var(--parcel)" }} />
          </div>
          <div className="val">{r.display}</div>
        </div>
      ))}
    </div>
  );
}
