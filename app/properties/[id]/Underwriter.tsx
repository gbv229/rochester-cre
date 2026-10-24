"use client";
import { useMemo, useState } from "react";
import { run, type Inputs } from "../../../lib/model";
import { usd, usdShort, pct, num, type Property } from "../../../lib/data";

type Props = { defaults: Inputs; basis: string; property: Property };

const FIELDS: { k: keyof Inputs; label: string; step: number; group: string; suffix?: string }[] = [
  { k: "price", label: "Purchase price", step: 100000, group: "Acquisition", suffix: "$" },
  
  { k: "closingCostPct", label: "Closing costs", step: 0.25, group: "Acquisition", suffix: "%" },
  { k: "pgi", label: "Year 1 potential gross income", step: 10000, group: "Operations", suffix: "$" },
  { k: "vacancy", label: "Vacancy & credit loss", step: 0.5, group: "Operations", suffix: "%" },
  { k: "opex", label: "Year 1 operating expenses", step: 10000, group: "Operations", suffix: "$" },
  { k: "incomeGrowth", label: "Income growth", step: 0.25, group: "Operations", suffix: "%" },
  { k: "expenseGrowth", label: "Expense growth", step: 0.25, group: "Operations", suffix: "%" },
  { k: "ltv", label: "Loan-to-value", step: 5, group: "Financing", suffix: "%" },
  { k: "rate", label: "Interest rate", step: 0.125, group: "Financing", suffix: "%" },
  { k: "amortYears", label: "Amortization (years)", step: 5, group: "Financing" },
  { k: "holdYears", label: "Hold period (years)", step: 1, group: "Exit" },
  { k: "exitCap", label: "Exit cap rate", step: 0.25, group: "Exit", suffix: "%" },
  { k: "sellingCostPct", label: "Selling costs", step: 0.25, group: "Exit", suffix: "%" },
  { k: "taxStepUp", label: "Added property tax ($/yr)", step: 10000, group: "Property tax step-up", suffix: "$" },
  { k: "taxStepUpYear", label: "Starting in year (0 = never)", step: 1, group: "Property tax step-up" },
];

export default function Underwriter({ defaults, basis, property }: Props) {
  const [inp, setInp] = useState<Inputs>(defaults);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportExcel = async () => {
    setExporting(true); setExportError("");
    try {
      const { downloadModel } = await import("../../../lib/excel");
      await downloadModel(property, inp);
    } catch {
      setExportError("Couldn't build the Excel file. Try again, or use a desktop browser.");
    } finally { setExporting(false); }
  };
  const set = (k: keyof Inputs, v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return;
    const clamp = k === "holdYears" ? Math.min(10, Math.max(1, Math.round(n)))
      : k === "taxStepUpYear" ? Math.min(10, Math.max(0, Math.round(n)))
      : k === "amortYears" ? Math.max(1, n) : n;
    setInp((s) => ({ ...s, [k]: clamp }));
  };
  const r = useMemo(() => run(inp), [inp]);

  // Sensitivity: levered IRR across purchase price and exit cap.
  const priceSteps = [-10, -5, 0, 5, 10];
  const capSteps = [-0.5, -0.25, 0, 0.25, 0.5];
  const grid = useMemo(
    () => capSteps.map((dc) => priceSteps.map((dp) => run({ ...inp, price: inp.price * (1 + dp / 100), exitCap: inp.exitCap + dc }).leveredIrr)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inp]
  );
  const heat = (v: number | null) => {
    if (v == null) return "#eee";
    const t = Math.max(-1, Math.min(1, (v - 10) / 10)); // centered on a 10% hurdle
    return t >= 0 ? `rgba(47,125,91,${0.12 + t * 0.5})` : `rgba(178,69,58,${0.12 - t * 0.5})`;
  };

  const groups = [...new Set(FIELDS.map((f) => f.group))];
  const dscrWarn = r.dscrY1 < 1.25;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="split">
        <div className="panel">
          <h2>Assumptions</h2>
          <p className="small muted">Seeded from Rochester market data. {basis}. Change any input and every output below recalculates.</p>
          <div className="grid g2" style={{ gap: 16 }}>
            {groups.map((g) => (
              <fieldset key={g} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10, alignContent: "start" }}>
                <legend style={{ fontWeight: 650, fontSize: "0.9rem", marginBottom: 6 }}>{g}</legend>
                {FIELDS.filter((f) => f.group === g).map((f) => (
                  <label key={f.k} className="field">
                    {f.label}{f.suffix === "%" ? " (%)" : ""}
                    <input type="number" step={f.step} value={Number((inp[f.k] ?? 0).toFixed(f.suffix === "$" ? 0 : 3))} onChange={(e) => set(f.k, e.target.value)} />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn primary" onClick={exportExcel} disabled={exporting}>{exporting ? "Building workbook…" : "Download Excel model"}</button>
            {property.taxStatus !== "Fully taxable" && (inp.taxStepUpYear || 0) === 0 && (
              <button className="btn" onClick={() => setInp((s) => ({ ...s, taxStepUpYear: 3 }))}>Model full taxes from year 3</button>
            )}
            <button className="btn" onClick={() => setInp(defaults)}>Reset to market defaults</button>
          </div>
          <p className="tiny faint" style={{ margin: "8px 0 0" }}>The workbook uses live formulas and named inputs, so it recalculates in Excel exactly like this model.</p>
          {exportError && <p className="small down" role="alert">{exportError}</p>}
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="figs">
            <div className="fig"><div className="k">Levered IRR</div><div className="v">{pct(r.leveredIrr)}</div><div className="s">{inp.holdYears}-year hold</div></div>
            <div className="fig"><div className="k">Unlevered IRR</div><div className="v">{pct(r.unleveredIrr)}</div><div className="s">All-cash basis</div></div>
            <div className="fig"><div className="k">Equity multiple</div><div className="v">{r.equityMultiple.toFixed(2)}x</div><div className="s">{usdShort(r.equity)} equity in</div></div>
            <div className="fig"><div className="k">Cash-on-cash, year 1</div><div className="v">{pct(r.cashOnCashY1)}</div><div className="s">After debt service</div></div>
            <div className="fig"><div className="k">DSCR, year 1</div><div className={`v ${dscrWarn ? "down" : ""}`}>{r.dscrY1.toFixed(2)}x</div><div className="s">{dscrWarn ? "Below a 1.25x lender minimum" : "Clears 1.25x lender minimum"}</div></div>
            <div className="fig"><div className="k">Debt yield</div><div className="v">{pct(r.debtYield)}</div><div className="s">Year 1 NOI / loan</div></div>
            <div className="fig"><div className="k">Breakeven occupancy</div><div className="v">{pct(r.breakevenOccupancy)}</div><div className="s">Covers opex and debt</div></div>
            <div className="fig"><div className="k">Exit value</div><div className="v">{usdShort(r.exitValue)}</div><div className="s">Forward NOI at {pct(inp.exitCap, 2)}</div></div>
          </div>
          <div className="panel">
            <h3>Sources and uses</h3>
            <table>
              <tbody>
                <tr><td style={{ whiteSpace: "normal" }}>Senior loan ({pct(inp.ltv, 0)} LTV, {pct(inp.rate, 3)}, {inp.amortYears}-yr amortization)</td><td className="n">{usd(r.loan)}</td></tr>
                <tr><td style={{ whiteSpace: "normal" }}>Sponsor equity (incl. closing costs)</td><td className="n">{usd(r.equity)}</td></tr>
                <tr><td>Annual debt service</td><td className="n">{usd(r.annualDebtService)}</td></tr>
                <tr><td>Year 1 NOI</td><td className="n">{usd(r.goingInNoi)}</td></tr>
                <tr className="total"><td>Going-in cap rate</td><td className="n">{pct(r.goingInCap, 2)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel tight">
        <div style={{ padding: "16px 20px 0" }}>
          <h2>Annual cash flow</h2>
          <p className="small muted">Laid out like an ARGUS Enterprise cash flow report. Exit is priced on year {inp.holdYears + 1} NOI.</p>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Line item</th>{r.years.map((y) => <th key={y.year} className="n">Year {y.year}</th>)}</tr></thead>
            <tbody>
              <Line label="Potential gross income" vals={r.years.map((y) => y.pgi)} />
              <Line label="Vacancy & credit loss" vals={r.years.map((y) => -y.vacancyLoss)} />
              <Line label="Effective gross income" vals={r.years.map((y) => y.egi)} strong />
              <Line label="Operating expenses" vals={r.years.map((y) => -y.opex)} />
              {r.years.some((y) => y.taxStepUp > 0) && <Line label="Property tax step-up" vals={r.years.map((y) => -y.taxStepUp)} />}
              <Line label="Net operating income" vals={r.years.map((y) => y.noi)} strong />
              <Line label="Debt service" vals={r.years.map((y) => -y.debtService)} />
              <Line label="Cash flow before tax" vals={r.years.map((y) => y.cfbt)} strong />
              <Line label="Net sale proceeds" vals={r.years.map((y) => y.reversion)} />
              <Line label="Total levered cash flow" vals={r.years.map((y) => y.cfbt + y.reversion)} total />
              <tr><td className="muted">DSCR</td>{r.years.map((y) => <td key={y.year} className="n muted">{y.dscr.toFixed(2)}x</td>)}</tr>
              <tr><td className="muted">Loan balance, end of year</td>{r.years.map((y) => <td key={y.year} className="n muted">{usd(y.loanBalance)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>Levered IRR sensitivity</h2>
        <p className="small muted">Purchase price across with income held constant, exit cap rate down. Green clears a 10% hurdle, red falls short. The outlined cell is the current case.</p>
        <div className="tablewrap">
          <table className="heat">
            <thead>
              <tr><th>Exit cap \ Price</th>{priceSteps.map((d) => <th key={d} className="n">{usdShort(inp.price * (1 + d / 100))}<div className="tiny faint">{pct((r.goingInNoi / (inp.price * (1 + d / 100))) * 100, 2)} cap</div></th>)}</tr>
            </thead>
            <tbody>
              {capSteps.map((dc, i) => (
                <tr key={dc}>
                  <th>{pct(inp.exitCap + dc, 2)}</th>
                  {grid[i].map((v, j) => (
                    <td key={j} className={dc === 0 && priceSteps[j] === 0 ? "base" : ""} style={{ background: heat(v) }}>{pct(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Line({ label, vals, strong, total }: { label: string; vals: number[]; strong?: boolean; total?: boolean }) {
  return (
    <tr className={total ? "total" : ""} style={strong ? { fontWeight: 650 } : undefined}>
      <td>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`n ${v < 0 ? "muted" : ""}`}>{v === 0 ? "—" : v < 0 ? `(${num(-v)})` : num(v)}</td>
      ))}
    </tr>
  );
}
