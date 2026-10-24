import Link from "next/link";
import Thumb from "../../components/Thumb";
import { byId, properties, median, usd, usdShort, pct, signedPct, num } from "../../lib/data";
import { defaultInputs } from "../../lib/defaults";
import { run, payment, type Inputs } from "../../lib/model";
import { BY_CLASS } from "../../lib/assumptions";

export const metadata = {
  title: "Case study: The Province, 220 John St",
  description: "An investment memo on purpose-built student housing at RIT, built from RochesterCRE's assessment data and underwriting model.",
};

// Comparable sales reported by the Rochester Business Journal.
const COMPS = [
  { name: "APEX, 380 John St", date: "Jan 2022", price: 161.5e6, beds: 1256, url: "https://rbj.net/2022/01/07/upscale-student-housing-near-rit-apex-sells-for-a-whopping-161-million/" },
  { name: "The Hill, Fairwood Dr", date: "Early 2025", price: 27.285e6, beds: 358, url: "https://rbj.net/2025/03/03/selling-price-of-apartment-community-near-rit-27-million/" },
];
const RENT_LOW = 789, RENT_HIGH = 889; // advertised private-room rates, per bed per month (amberstudent.com, Oct 2026)
const RENT_MID = (RENT_LOW + RENT_HIGH) / 2;

function priceFor(target: number, inp: Inputs) {
  let lo = 1e6, hi = 3e8;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (run({ ...inp, price: m }).leveredIrr ?? -100) > target ? (lo = m) : (hi = m); }
  return (lo + hi) / 2;
}

export default function CaseStudy() {
  const p = byId("161-01-1-25-11")!;
  const base = defaultInputs(p);
  const r = run(base);
  const egi = base.pgi * (1 - base.vacancy / 100);
  const debtConstant = payment(r.loan, base.rate, base.amortYears) / r.loan * 100;
  const capRate = BY_CLASS[p.classCode].capRate;

  const scenarios = [
    { name: "Base case (market defaults)", inp: base, note: `${pct(base.vacancy)} vacancy, ${pct((base.opex / egi) * 100, 0)} expense ratio, ${pct(base.exitCap, 2)} exit cap` },
    { name: "Softer leasing", inp: { ...base, vacancy: 10 }, note: "10% vacancy, as a weak preleasing season would produce" },
    { name: "Student-housing expense load", inp: { ...base, opex: Math.round(egi * 0.5) }, note: "Expenses at 50% of EGI for furnished, all-inclusive units" },
    { name: "Combined downside", inp: { ...base, vacancy: 10, opex: Math.round(egi * 0.5), exitCap: base.exitCap + 0.5 }, note: "Both of the above plus a 50 bp wider exit cap" },
  ].map((s) => ({ ...s, r: run(s.inp), p12: priceFor(12, s.inp) }));
  const downside = scenarios[3];

  const bedsImplied = base.pgi / (RENT_MID * 12);
  const henrietta = properties.filter((q) => q.municipality === "Henrietta" && q.yoyPct != null);
  const henMedian = median(henrietta.map((q) => q.yoyPct!));
  const taxJump = p.estTaxFull - (p.estTaxPrior ?? 0);

  return (
    <article className="wrap memo" style={{ paddingTop: 28, paddingBottom: 20 }}>
      <div className="crumbs" style={{ paddingTop: 0 }}><Link href="/">RochesterCRE</Link> / Case study</div>
      <h1>The Province at RIT: pass at the assessed value</h1>
      <p className="muted">Investment memo on 220 John St, Henrietta. Prepared by Gage Van Quekelberg, October 2026, using this site's data and underwriting model.</p>

      <section className="panel" style={{ margin: "20px 0", borderLeft: "4px solid var(--lilac)" }}>
        <h2 style={{ marginBottom: 8 }}>Recommendation</h2>
        <p style={{ margin: 0 }}>
          Pass at the {usdShort(p.marketValue)} assessed value. On market assumptions the deal returns a {pct(r.leveredIrr)} levered IRR
          with a {r.dscrY1.toFixed(2)}x DSCR, below a typical 1.25x lender minimum. A 12% levered return needs about {usdShort(scenarios[0].p12)}, and
          about {usdShort(downside.p12)} once student-housing expenses and softer leasing are layered in. Re-engage only with a verified bed count and
          a trailing-12 operating statement, because bed count decides whether this income exists at all.
        </p>
      </section>

      <div className="split">
        <div>
          <h2>The asset</h2>
          <p>
            The Province is purpose-built student housing on John Street, next to RIT's campus and on its shuttle route. Units are furnished, leased
            by the bed with private bedrooms and bathrooms, and include internet and an electricity allowance. American Campus Communities owns and
            manages it, per its website; the owner of record is {p.owner}. Advertised private-room rates run ${RENT_LOW}–${RENT_HIGH} a month.
          </p>
          <p>
            The parcel covers {num(p.lotAcres, 1)} acres and improvements are {pct(p.improvementRatio, 0)} of value. The 2025 roll lifted its full market
            value from {usdShort(p.marketValue2024)} to {usdShort(p.marketValue)}, a {signedPct(p.yoyPct)} jump, against a {signedPct(henMedian)} median for
            the {henrietta.length} tracked Henrietta parcels. The neighboring APEX traded for $161.5M in 2022, so the old value likely lagged the market,
            and the town's reassessment caught up.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            The state roll codes it as class {p.classCode}, ordinary apartments, so the screener applies Rochester apartment vacancy and a {pct((base.opex / egi) * 100, 0)} expense
            ratio. Student housing behaves differently: leases reset every August, demand tracks one university's enrollment, and furnished,
            all-inclusive units carry higher expenses. The downside cases below adjust for that.
          </p>
        </div>
        <div className="aerial" style={{ alignSelf: "start" }}>
          <Thumb lat={p.lat} lon={p.lon} alt="Aerial photograph of 220 John St, Henrietta" w={900} h={520} span={0.0045} />
          <div className="pin" aria-hidden="true" />
          <div className="credit">Imagery © Esri, Maxar, Earthstar Geographics</div>
        </div>
      </div>

      <section className="section">
        <h2>What the assessed value implies</h2>
        <p>
          At a {pct(capRate, 2)} market cap rate, {usdShort(p.marketValue)} implies {usd(r.goingInNoi)} of NOI. Grossed up through the model's vacancy and
          expenses, that requires {usd(base.pgi)} of potential rent. At the {usd(RENT_MID)} midpoint of advertised rates, the building would need about{" "}
          <strong>{num(bedsImplied, 0)} beds</strong> fully leased to support the value.
        </p>
        <div className="panel tight tablewrap" style={{ marginBottom: 12 }}>
          <table>
            <thead><tr><th>Comparable sale</th><th>Date</th><th className="n">Price</th><th className="n">Beds</th><th className="n">Per bed</th><th className="n">Beds implied at {usdShort(p.marketValue)}</th></tr></thead>
            <tbody>
              {COMPS.map((c) => (
                <tr key={c.name}>
                  <td><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a></td>
                  <td>{c.date}</td>
                  <td className="n">{usdShort(c.price)}</td>
                  <td className="n">{num(c.beds)}</td>
                  <td className="n">{usd(c.price / c.beds)}</td>
                  <td className="n">{num(p.marketValue / (c.price / c.beds), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Neither the roll nor the operator's site states The Province's bed count. Priced like APEX, {usdShort(p.marketValue)} buys about {num(p.marketValue / (COMPS[0].price / COMPS[0].beds), 0)} beds;
          priced like The Hill, about {num(p.marketValue / (COMPS[1].price / COMPS[1].beds), 0)}. The income test points to the higher number. If the true
          count is closer to 600, the assessed value overstates what the rent can carry.
        </p>
      </section>

      <section className="section">
        <h2>Underwriting</h2>
        <p>
          Five-year hold, {pct(base.ltv, 0)} loan-to-value at {pct(base.rate, 2)} with {base.amortYears}-year amortization, {pct(base.exitCap, 2)} exit cap.
          The loan's debt constant is {pct(debtConstant, 2)} against a {pct(capRate, 2)} going-in cap, so leverage is negative: every borrowed dollar
          costs more than the property earns on it. That is why the levered IRR ({pct(r.leveredIrr)}) sits below the unlevered ({pct(r.unleveredIrr)}).
        </p>
        <div className="panel tight tablewrap">
          <table>
            <thead><tr><th>Scenario</th><th className="n">Year 1 NOI</th><th className="n">Levered IRR</th><th className="n">Unlevered IRR</th><th className="n">DSCR</th><th className="n">Price for 12% levered</th></tr></thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.name}>
                  <td style={{ whiteSpace: "normal" }}><strong>{s.name}</strong><div className="tiny faint">{s.note}</div></td>
                  <td className="n">{usdShort(s.r.goingInNoi)}</td>
                  <td className={`n ${(s.r.leveredIrr ?? 0) >= 10 ? "up" : "down"}`}>{pct(s.r.leveredIrr)}</td>
                  <td className="n">{pct(s.r.unleveredIrr)}</td>
                  <td className={`n ${s.r.dscrY1 < 1.25 ? "down" : ""}`}>{s.r.dscrY1.toFixed(2)}x</td>
                  <td className="n">{usdShort(s.p12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Base case: {r.equityMultiple.toFixed(2)}x equity multiple, {pct(r.cashOnCashY1)} year-1 cash-on-cash, {pct(r.debtYield)} debt yield and
          {" "}{pct(r.breakevenOccupancy)} breakeven occupancy. At a 1.25x DSCR, a lender would size the loan below {pct(base.ltv, 0)} LTV, which cuts leverage further.
        </p>
      </section>

      <section className="section grid g2">
        <div>
          <h2>Property taxes</h2>
          <p>
            The parcel is fully taxable. At Henrietta's combined ${p.taxRateTotal.toFixed(2)} per $1,000 (county, town and Rush-Henrietta schools), the
            new value implies about {usdShort(p.estTaxFull)} a year, or {pct((p.estTaxFull / egi) * 100, 1)} of effective gross income. At the same
            rates, the reassessment alone adds roughly {usdShort(taxJump)} a year, which is {pct((taxJump / r.goingInNoi) * 100, 1)} of NOI.
          </p>
          <p style={{ margin: 0 }}>
            A buyer should underwrite taxes on the 2025 value, check whether the owner has filed a grievance, and expect the purchase price itself to
            anchor the next assessment.
          </p>
        </div>
        <div>
          <h2>Key risks</h2>
          <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
            <li><strong>Single-demand-driver risk.</strong> Occupancy depends on RIT enrollment and on how much housing RIT builds on campus.</li>
            <li><strong>Annual re-leasing.</strong> Nearly every bed turns over each August, so a weak preleasing season shows up as a full year of vacancy.</li>
            <li><strong>Competing supply.</strong> APEX added a large modern community next door in 2021.</li>
            <li><strong>Expense creep.</strong> Utilities, furniture replacement and turnover costs run higher than in conventional apartments.</li>
            <li><strong>Negative leverage.</strong> At today's rates, debt dilutes returns unless NOI grows faster than modeled.</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <h2>Diligence before any bid</h2>
        <ol style={{ paddingLeft: "1.2rem" }}>
          <li>Bed count, unit mix and rent roll by bed type; confirm achieved rents against advertised rates.</li>
          <li>Trailing-12 operating statement, with utilities, payroll and turnover costs broken out.</li>
          <li>Prelease velocity for the coming academic year against the same point in prior years.</li>
          <li>RIT enrollment trend and any planned on-campus housing.</li>
          <li>The 2025 tax bill and the status of any assessment grievance.</li>
          <li>Year built, capital expenditure history and a property condition report.</li>
        </ol>
        <p className="small muted" style={{ margin: 0 }}>
          Run the numbers yourself on the <Link href={`/properties/${p.id}/`}>property page</Link>: change bed-driven income, vacancy or price, or
          download the model to Excel with live formulas.
        </p>
      </section>

      <section className="section">
        <h2>Sources</h2>
        <ul className="small">
          <li><a href="https://data.ny.gov/Government-Finance/Property-Assessment-Data-from-Local-Assessment-Rol/7vem-aaz7" target="_blank" rel="noreferrer">NYS ORPTS assessment rolls, 2024 and 2025</a>; <a href="https://data.ny.gov/resource/iq85-sdzs.json" target="_blank" rel="noreferrer">NYS OSC tax rates</a></li>
          <li><a href="https://www.americancampus.com/student-apartments/ny/rochester/the-province" target="_blank" rel="noreferrer">American Campus Communities, The Province at RIT</a></li>
          <li><a href="https://amberstudent.com/places/the-province-rochester-2503252195024" target="_blank" rel="noreferrer">Amber Student, The Province advertised rates (October 2026)</a></li>
          {COMPS.map((c) => <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">Rochester Business Journal: {c.name} sale</a></li>)}
          <li><a href="https://en.wikipedia.org/wiki/Park_Point_at_RIT" target="_blank" rel="noreferrer">Park Point at RIT</a> (student housing context near John St)</li>
        </ul>
        <p className="tiny faint">Modeled estimates for research and education, not an appraisal, offer or investment advice.</p>
      </section>
    </article>
  );
}
