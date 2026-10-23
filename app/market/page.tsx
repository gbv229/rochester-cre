import Link from "next/link";
import { properties, CATEGORY_COLOR, usdShort, pct, signedPct, median } from "../../lib/data";
import { MARKET, BY_CLASS, SOURCES, assumptionsFor } from "../../lib/assumptions";

export const metadata = { title: "Rochester market fundamentals" };

const CLASS_ORDER = ["411", "464", "465", "449", "710", "714", "452", "453", "454", "414", "481", "437"];

function tracked(category: string) {
  const list = properties.filter((p) => p.category === category);
  const yoy = list.filter((p) => p.yoyPct != null && p.marketValue2024);
  const a = yoy.reduce((s, p) => s + p.marketValue, 0), b = yoy.reduce((s, p) => s + (p.marketValue2024 || 0), 0);
  return { n: list.length, value: list.reduce((s, p) => s + p.marketValue, 0), yoy: b ? (a / b - 1) * 100 : null, med: median(yoy.map((p) => p.yoyPct!)) };
}

function Sector({ name, children, category }: { name: string; children: React.ReactNode; category: string }) {
  const t = tracked(category);
  return (
    <div className="panel">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="dot" style={{ background: CATEGORY_COLOR[category] }} />{name}</h2>
      {children}
      <div style={{ borderTop: "1px solid var(--rule)", marginTop: 14, paddingTop: 12 }} className="small">
        <strong>On this platform:</strong> {t.n} parcels, {usdShort(t.value)} of value, assessments {signedPct(t.yoy)} value-weighted
        from 2024 (median parcel {signedPct(t.med)}). <Link href={`/properties/?category=${encodeURIComponent(category)}`}>Screen them</Link>
      </div>
    </div>
  );
}

export default function Market() {
  const { office: o, industrial: i, retail: r, multifamily: m } = MARKET;
  return (
    <div className="wrap">
      <div style={{ padding: "28px 0 16px" }}>
        <h1>Rochester market fundamentals</h1>
        <p className="muted">
          The vacancy and rent figures that seed every underwriting model on this site, with the assessment-roll trend for the
          parcels tracked here alongside. Broker figures cover the Rochester metro; the assessment trend covers Monroe County parcels only.
        </p>
      </div>

      <div className="grid g2" style={{ marginBottom: 28 }}>
        <Sector name="Office" category="Office">
          <p>Metro vacancy is {pct(o.vacancy)}, but it splits sharply: downtown sits at {pct(o.cbd)} while the suburbs run {pct(o.suburban)}. Average asking rent is ${o.askingRent.toFixed(2)}/SF, with Class A at ${o.classA.toFixed(2)}/SF. The suburbs have now posted four straight quarters of positive absorption, {o.absorptionYtdSf.toLocaleString()} SF so far this year.</p>
          <p className="small faint" style={{ margin: 0 }}>{o.source}, {o.asOf}</p>
        </Sector>
        <Sector name="Industrial" category="Industrial">
          <p>Vacancy rose to {pct(i.vacancy)} from {pct(i.priorVacancy)} at year-end 2025. Warehouse and distribution space is tightest at {pct(i.warehouse)}, manufacturing is {pct(i.manufacturing)} and flex {pct(i.flex)}. Asking rents average ${i.askingRent.toFixed(2)}/SF net, ${i.warehouseRent.toFixed(2)} for warehouse.</p>
          <p className="small faint" style={{ margin: 0 }}>{i.source}, {i.asOf}</p>
        </Sector>
        <Sector name="Retail" category="Retail">
          <p>Retail vacancy was {pct(r.vacancy)} across {(r.inventorySf / 1e6).toFixed(1)} million SF of inventory, with new big-format leasing at Eastview Mall and Greece Ridge.</p>
          <p className="small faint" style={{ margin: 0 }}>{r.source}, {r.asOf}</p>
        </Sector>
        <Sector name="Multifamily" category="Multifamily">
          <p>Apartment vacancy climbed to {pct(m.vacancy)} from {pct(m.priorVacancy)} as new supply delivered, moving Rochester from a landlord's market to a balanced one. Median advertised rent was ${m.medianRent.toLocaleString()} with {pct(m.rentGrowth)} growth; by September 2026 the average reached ${m.avgRentSep2026.toLocaleString()}, up {pct(m.avgRentGrowth)}.</p>
          <p className="small faint" style={{ margin: 0 }}>{m.source}</p>
        </Sector>
      </div>

      <section className="panel tight" style={{ marginBottom: 28 }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2>Underwriting defaults by property type</h2>
          <p className="small muted">Cap rates start from Q2 2026 national averages (multifamily and industrial near 5.2%, retail 6.7%, Class B/C office 7.9%, hotels 7.5%) plus a spread for a tertiary market. Every value can be overridden on a property's page.</p>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Property type</th><th className="n">Cap rate</th><th className="n">Vacancy</th><th className="n">Opex % EGI</th><th className="n">Income growth</th><th>Vacancy basis</th></tr></thead>
            <tbody>
              {CLASS_ORDER.map((c) => {
                const a = BY_CLASS[c];
                const sample = properties.find((p) => p.classCode === c);
                return (
                  <tr key={c}>
                    <td>{sample?.subtype} <span className="faint">({c})</span></td>
                    <td className="n">{pct(a.capRate, 2)}</td>
                    <td className="n">{pct(a.vacancy)}</td>
                    <td className="n">{pct(a.opexRatio, 0)}</td>
                    <td className="n">{pct(a.incomeGrowth, 2)}</td>
                    <td className="muted" style={{ whiteSpace: "normal" }}>{a.basis}</td>
                  </tr>
                );
              })}
              <tr>
                <td>Office in the CBD <span className="faint">(464/465)</span></td>
                <td className="n">{pct(assumptionsFor("464", "CBD").capRate, 2)}</td>
                <td className="n">{pct(assumptionsFor("464", "CBD").vacancy)}</td>
                <td className="n">{pct(BY_CLASS["464"].opexRatio, 0)}</td>
                <td className="n">{pct(BY_CLASS["464"].incomeGrowth, 2)}</td>
                <td className="muted" style={{ whiteSpace: "normal" }}>{assumptionsFor("464", "CBD").basis}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2>Sources</h2>
        <ul>
          {SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
        </ul>
      </section>
    </div>
  );
}
