import Link from "next/link";
import LineChart from "../../components/LineChart";
import Bars from "../../components/Bars";
import { properties, CATEGORY_COLOR, CATEGORIES, usdShort, pct, signedPct, median, ownerGroup } from "../../lib/data";
import { MARKET, BY_CLASS, SOURCES, assumptionsFor } from "../../lib/assumptions";
import { SERIES, fredUrl, last, at } from "../../lib/economy";

export const metadata = { title: "Rochester market analysis" };

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
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.05rem" }}><i className="dot" style={{ background: CATEGORY_COLOR[category] }} />{name}</h3>
      {children}
      <div style={{ borderTop: "1px solid var(--rule)", marginTop: 14, paddingTop: 12 }} className="small">
        <strong>On this platform:</strong> {t.n} parcels, {usdShort(t.value)} of value, assessments {signedPct(t.yoy)} value-weighted
        from 2024 (median parcel {signedPct(t.med)}). <Link href={`/properties/?category=${encodeURIComponent(category)}`}>Screen them</Link>
      </div>
    </div>
  );
}

function Chart({ title, id, note, children }: { title: string; id: string; note: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
      <p className="tiny faint" style={{ margin: "8px 0 0" }}>{note}. Source: <a href={fredUrl(id)} target="_blank" rel="noreferrer">FRED {id}</a></p>
    </div>
  );
}

export default function Market() {
  const { office: o, industrial: i, retail: r, multifamily: m } = MARKET;
  const E = SERIES;

  // Economy headline numbers
  const jobsNow = last(E.jobs.data).value, jobsPre = at(E.jobs.data, "2020-01-01")!.value;
  const mfgNow = last(E.manufacturing.data).value, mfg15 = E.manufacturing.data[0].value;
  const hpiNow = last(E.hpi.data).value, hpi20 = at(E.hpi.data, "2020-01-01")!.value, hpiYr = at(E.hpi.data, "2025-04-01")!.value;
  const incNow = last(E.income.data), inc19 = at(E.income.data, "2019-01-01")!.value;
  const popNow = last(E.population.data).value, pop10 = E.population.data[0].value;
  const tsy = last(E.treasury10.data).value;
  const w = properties.filter((p) => p.marketValue2024);
  const rollYoy = (w.reduce((a, p) => a + p.marketValue, 0) / w.reduce((a, p) => a + p.marketValue2024!, 0) - 1) * 100;
  const urNow = last(E.unemployment.data).value, usNow = last(E.usUnemployment.data).value;

  // Capital markets: cap-rate spread to the 10-year
  const spreadRows = CLASS_ORDER.map((c) => ({ c, sub: properties.find((p) => p.classCode === c)?.subtype, cap: BY_CLASS[c].capRate }));

  // Ownership concentration
  const owners = new Map<string, { value: number; n: number; types: Set<string> }>();
  for (const p of properties) {
    const g = ownerGroup(p.owner);
    const o2 = owners.get(g) || { value: 0, n: 0, types: new Set<string>() };
    o2.value += p.marketValue; o2.n++; o2.types.add(p.category);
    owners.set(g, o2);
  }
  const topOwners = [...owners.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 12);
  const total = properties.reduce((s, p) => s + p.marketValue, 0);
  const top10Share = topOwners.slice(0, 10).reduce((s, [, v]) => s + v.value, 0) / total * 100;

  // Municipalities
  const munis = [...new Set(properties.map((p) => p.municipality))].map((name) => {
    const list = properties.filter((p) => p.municipality === name);
    const value = list.reduce((s, p) => s + p.marketValue, 0);
    const exempt = list.filter((p) => p.taxStatus !== "Fully taxable").reduce((s, p) => s + p.marketValue, 0);
    const counts = new Map<string, number>();
    list.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + p.marketValue));
    const lead = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { name, n: list.length, value, exemptPct: (exempt / value) * 100, taxRate: median(list.map((p) => p.taxRateTotal)) ?? 0, medYoy: median(list.filter((p) => p.yoyPct != null).map((p) => p.yoyPct!)), lead };
  }).sort((a, b) => b.value - a.value);

  // Assessment change distribution
  const buckets = [
    { label: "Down 10%+", test: (v: number) => v <= -10 },
    { label: "Down 0–10%", test: (v: number) => v < 0 && v > -10 },
    { label: "Flat", test: (v: number) => v === 0 },
    { label: "Up 0–10%", test: (v: number) => v > 0 && v < 10 },
    { label: "Up 10–25%", test: (v: number) => v >= 10 && v < 25 },
    { label: "Up 25%+", test: (v: number) => v >= 25 },
  ];
  const yoys = properties.filter((p) => p.yoyPct != null).map((p) => p.yoyPct!);

  return (
    <div className="wrap">
      <div style={{ padding: "28px 0 8px" }}>
        <h1>Rochester market analysis</h1>
        <p className="muted">
          The regional economy, capital markets, sector fundamentals and ownership patterns behind the {properties.length} tracked
          parcels. Broker and economic figures cover the Rochester metro; assessment figures cover Monroe County parcels on this platform.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 16 }}>
        <h2>The read</h2>
        <div className="grid g3">
          <div className="panel">
            <h3>Stable, slow-growth demand</h3>
            <p className="small" style={{ margin: 0 }}>
              Metro payrolls are at {jobsNow.toFixed(1)}K, {signedPct((jobsNow / jobsPre - 1) * 100)} versus January 2020, and county
              population has barely moved since 2010 ({signedPct((popNow / pop10 - 1) * 100)}). Healthcare and education anchor the
              base; manufacturing has shed {(mfg15 - mfgNow).toFixed(1)}K jobs since 2015. Demand-side growth won't bail out a weak
              business plan here.
            </p>
          </div>
          <div className="panel">
            <h3>Values outrunning incomes</h3>
            <p className="small" style={{ margin: 0 }}>
              Home prices are up {signedPct((hpiNow / hpi20 - 1) * 100, 0)} since 2020 and {signedPct((hpiNow / hpiYr - 1) * 100)} over
              the past year, against {signedPct((incNow.value / inc19 - 1) * 100, 0)} for median household income since 2019. Tracked
              commercial assessments rose {signedPct(rollYoy)} in a single roll. That supports apartment rents and for-sale demand, but leaves
              less room for further appreciation.
            </p>
          </div>
          <div className="panel">
            <h3>A thin spread to Treasuries</h3>
            <p className="small" style={{ margin: 0 }}>
              With the 10-year at {pct(tsy, 2)}, an apartment bought at a {pct(BY_CLASS["411"].capRate, 2)} cap earns only
              about {((BY_CLASS["411"].capRate - tsy) * 100).toFixed(0)} basis points over a risk-free bond, and borrowing at
              6.75% is negative leverage. Returns in this market have to come from operations and basis, not cap compression.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Regional economy</h2>
        <div className="figs" style={{ marginBottom: 20 }}>
          <div className="fig"><div className="k">Unemployment, Rochester</div><div className="v">{pct(urNow)}</div><div className="s">US {pct(usNow)}, {last(E.unemployment.data).date.slice(0, 7)}</div></div>
          <div className="fig"><div className="k">Nonfarm jobs</div><div className="v">{jobsNow.toFixed(1)}K</div><div className="s">{signedPct((jobsNow / jobsPre - 1) * 100)} vs Jan 2020</div></div>
          <div className="fig"><div className="k">Manufacturing jobs</div><div className="v">{mfgNow.toFixed(1)}K</div><div className="s">{signedPct((mfgNow / mfg15 - 1) * 100)} since 2015</div></div>
          <div className="fig"><div className="k">House price index</div><div className="v">{signedPct((hpiNow / hpiYr - 1) * 100)}</div><div className="s">Year over year, Q2 2026</div></div>
          <div className="fig"><div className="k">Median household income</div><div className="v">${(incNow.value / 1000).toFixed(1)}K</div><div className="s">Monroe County, {incNow.date.slice(0, 4)}</div></div>
          <div className="fig"><div className="k">Population</div><div className="v">{popNow.toFixed(0)}K</div><div className="s">Monroe County, {last(E.population.data).date.slice(0, 4)}</div></div>
        </div>
        <div className="grid g2">
          <Chart title="Unemployment rate, Rochester vs US" id={E.unemployment.id} note="Seasonally adjusted; dashed line is the US">
            <LineChart label="Unemployment rate, Rochester versus US" format={(v) => `${v.toFixed(1)}%`} yMin={0}
              series={[{ name: "Rochester", color: "var(--parcel)", data: E.unemployment.data }, { name: "US", color: "var(--ink-3)", data: E.usUnemployment.data, dashed: true }]} />
          </Chart>
          <Chart title="Total nonfarm jobs, Rochester MSA (thousands)" id={E.jobs.id} note="Seasonally adjusted">
            <LineChart label="Rochester nonfarm jobs" format={(v) => v.toFixed(0)} series={[{ name: "Jobs", color: "var(--parcel)", data: E.jobs.data }]} />
          </Chart>
          <Chart title="House price index, Rochester MSA" id={E.hpi.id} note="FHFA all-transactions index, 1995 Q1 = 100">
            <LineChart label="Rochester house price index" format={(v) => v.toFixed(0)} series={[{ name: "HPI", color: "var(--lilac)", data: E.hpi.data }]} />
          </Chart>
          <Chart title="Manufacturing jobs, Rochester MSA (thousands)" id={E.manufacturing.id} note="Seasonally adjusted, January values">
            <LineChart label="Rochester manufacturing jobs" format={(v) => v.toFixed(1)} series={[{ name: "Manufacturing", color: CATEGORY_COLOR.Industrial, data: E.manufacturing.data }]} />
          </Chart>
        </div>
      </section>

      <section className="section split">
        <div>
          <h2>Capital markets</h2>
          <p className="muted small">The model's going-in cap rates against the current 10-year Treasury ({pct(tsy, 2)}, September 2026). Commercial real estate has historically priced around 300–400 basis points over the 10-year; a spread well inside that range means pricing leans on growth or on lower future rates.</p>
          <Chart title="10-year Treasury yield" id={E.treasury10.id} note="Monthly average; dashed line is the model's multifamily cap rate">
            <LineChart label="10-year Treasury yield with multifamily cap rate" format={(v) => `${v.toFixed(1)}%`} yMin={0}
              series={[{ name: "10-year", color: "var(--ink)", data: E.treasury10.data },
                { name: "MF cap", color: CATEGORY_COLOR.Multifamily, dashed: true, data: [{ date: "2019-01-01", value: BY_CLASS["411"].capRate }, { date: last(E.treasury10.data).date, value: BY_CLASS["411"].capRate }] }]} />
          </Chart>
        </div>
        <div className="panel tight tablewrap" style={{ alignSelf: "start", marginTop: 38 }}>
          <table>
            <thead><tr><th>Property type</th><th className="n">Cap rate</th><th className="n">Spread to 10-yr</th></tr></thead>
            <tbody>
              {spreadRows.map((row) => {
                const bps = (row.cap - tsy) * 100;
                return (
                  <tr key={row.c}>
                    <td>{row.sub}</td>
                    <td className="n">{pct(row.cap, 2)}</td>
                    <td className={`n ${bps < 200 ? "down" : bps >= 350 ? "up" : ""}`}>{bps.toFixed(0)} bps</td>
                  </tr>
                );
              })}
              <tr><td>Office in the CBD</td><td className="n">{pct(assumptionsFor("464", "CBD").capRate, 2)}</td><td className="n up">{((assumptionsFor("464", "CBD").capRate - tsy) * 100).toFixed(0)} bps</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Sector fundamentals</h2>
        <div className="grid g2">
          <Sector name="Office" category="Office">
            <p>Metro vacancy is {pct(o.vacancy)}, but it splits sharply: downtown sits at {pct(o.cbd)} while the suburbs run {pct(o.suburban)}. Average asking rent is ${o.askingRent.toFixed(2)}/SF, with Class A at ${o.classA.toFixed(2)}/SF. The suburbs have posted four straight quarters of positive absorption, {o.absorptionYtdSf.toLocaleString()} SF so far this year.</p>
            <p className="small faint" style={{ margin: 0 }}>{o.source}, {o.asOf}</p>
          </Sector>
          <Sector name="Industrial" category="Industrial">
            <p>Vacancy rose to {pct(i.vacancy)} from {pct(i.priorVacancy)} at year-end 2025. Warehouse and distribution space is tightest at {pct(i.warehouse)}, manufacturing is {pct(i.manufacturing)} and flex {pct(i.flex)}. Asking rents average ${i.askingRent.toFixed(2)}/SF net, ${i.warehouseRent.toFixed(2)} for warehouse.</p>
            <p className="small faint" style={{ margin: 0 }}>{i.source}, {i.asOf}</p>
          </Sector>
          <Sector name="Retail" category="Retail">
            <p>Retail vacancy was {pct(r.vacancy)} across {(r.inventorySf / 1e6).toFixed(1)} million SF of inventory, with new big-format leasing at Eastview Mall and Greece Ridge. Grocery anchors drive the market: Wegmans alone owns {properties.filter((p) => /wegmans/i.test(p.owner) && p.category === "Retail").length} of the tracked retail parcels.</p>
            <p className="small faint" style={{ margin: 0 }}>{r.source}, {r.asOf}</p>
          </Sector>
          <Sector name="Multifamily" category="Multifamily">
            <p>Apartment vacancy climbed to {pct(m.vacancy)} from {pct(m.priorVacancy)} as new supply delivered, moving Rochester from a landlord's market to a balanced one. Median advertised rent was ${m.medianRent.toLocaleString()} with {pct(m.rentGrowth)} growth; by September 2026 the average reached ${m.avgRentSep2026.toLocaleString()}, up {pct(m.avgRentGrowth)}.</p>
            <p className="small faint" style={{ margin: 0 }}>{m.source}</p>
          </Sector>
        </div>
      </section>

      <section className="section grid g2">
        <div>
          <h2>Who owns it</h2>
          <p className="muted small">Owner-of-record names grouped by organization. The ten largest hold {pct(top10Share, 0)} of tracked value.</p>
          <div className="panel tight tablewrap">
            <table>
              <thead><tr><th>Owner</th><th className="n">Parcels</th><th className="n">Market value</th><th className="n">Share</th></tr></thead>
              <tbody>
                {topOwners.map(([name, v]) => (
                  <tr key={name}>
                    <td style={{ whiteSpace: "normal" }}><Link href={`/properties/?q=${encodeURIComponent(name.split(" ")[0])}`}>{name}</Link><div className="tiny faint">{[...v.types].join(", ")}</div></td>
                    <td className="n">{v.n}</td>
                    <td className="n">{usdShort(v.value)}</td>
                    <td className="n">{pct((v.value / total) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>How assessments moved</h2>
          <p className="muted small">Distribution of 2024 to 2025 changes across {yoys.length} parcels. Large jumps usually mean new construction, a completed renovation or a reassessment; large drops often follow a tax appeal.</p>
          <Bars rows={buckets.map((b) => {
            const n = yoys.filter(b.test).length;
            return { label: b.label, value: n, display: `${n} parcels`, color: b.label.startsWith("Down") ? "var(--down)" : b.label === "Flat" ? "var(--ink-3)" : "var(--up)" };
          })} />
          <h2 style={{ marginTop: 28 }}>Value by asset class and tax status</h2>
          <Bars rows={CATEGORIES.map((c) => {
            const list = properties.filter((p) => p.category === c);
            const v = list.reduce((s, p) => s + p.marketValue, 0);
            const ex = list.filter((p) => p.taxStatus !== "Fully taxable").reduce((s, p) => s + p.marketValue, 0);
            return { label: c, value: (ex / v) * 100, display: `${pct((ex / v) * 100, 0)} exempt`, color: CATEGORY_COLOR[c] };
          })} max={100} />
        </div>
      </section>

      <section className="section">
        <h2>By municipality</h2>
        <p className="muted small">The City of Rochester held most commercial values flat on the 2025 roll, so its 0% median reflects the assessor's revaluation cycle, not the market. Town figures reflect active reassessment. Tax rates are the median combined county, municipal and school rate for tracked parcels; the city figure is its higher non-homestead (commercial) rate.</p>
        <div className="panel tight tablewrap">
          <table>
            <thead><tr><th>Municipality</th><th className="n">Parcels</th><th className="n">Market value</th><th className="n">Median YoY</th><th className="n">Not fully taxable</th><th className="n">Tax rate / $1,000</th><th>Largest asset class</th></tr></thead>
            <tbody>
              {munis.map((mu) => (
                <tr key={mu.name}>
                  <td><Link href={`/properties/?municipality=${encodeURIComponent(mu.name)}`}>{mu.name}</Link></td>
                  <td className="n">{mu.n}</td>
                  <td className="n">{usdShort(mu.value)}</td>
                  <td className={`n ${mu.medYoy == null ? "" : mu.medYoy >= 0 ? "up" : "down"}`}>{signedPct(mu.medYoy)}</td>
                  <td className="n">{pct(mu.exemptPct, 0)}</td>
                  <td className="n">${mu.taxRate.toFixed(2)}</td>
                  <td><i className="dot" style={{ background: CATEGORY_COLOR[mu.lead], marginRight: 8 }} />{mu.lead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Underwriting defaults by property type</h2>
        <p className="small muted">Cap rates start from Q2 2026 national averages (multifamily and industrial near 5.2%, retail 6.7%, Class B/C office 7.9%, hotels 7.5%) plus a spread for a tertiary market. Every value can be overridden on a property's page.</p>
        <div className="panel tight tablewrap">
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
                    <td className="muted" style={{ whiteSpace: "normal", minWidth: 260 }}>{a.basis}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Sources</h2>
        <ul>
          {SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
          <li><a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer">FRED, Federal Reserve Bank of St. Louis — BLS, FHFA, Census and Treasury series (IDs on each chart)</a></li>
        </ul>
      </section>
    </div>
  );
}
