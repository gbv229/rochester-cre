import Link from "next/link";
import CountyMap from "../components/CountyMap";
import Bars from "../components/Bars";
import { properties, CATEGORIES, CATEGORY_COLOR, SUBMARKET_ORDER, usdShort, signedPct, pct, median, groupSum } from "../lib/data";
import { MARKET } from "../lib/assumptions";

export default function Home() {
  const total = properties.reduce((s, p) => s + p.marketValue, 0);
  const withYoy = properties.filter((p) => p.yoyPct != null && p.marketValue2024);
  const v25 = withYoy.reduce((s, p) => s + p.marketValue, 0);
  const v24 = withYoy.reduce((s, p) => s + (p.marketValue2024 || 0), 0);
  const aggYoy = (v25 / v24 - 1) * 100;
  const exempt = properties.filter((p) => p.taxStatus !== "Fully taxable").reduce((s, p) => s + p.marketValue, 0);
  const munis = new Set(properties.map((p) => p.municipality)).size;

  const byCat = groupSum("category");
  const bySub = groupSum("submarket");
  const catYoy = CATEGORIES.map((c) => {
    const list = withYoy.filter((p) => p.category === c);
    const a = list.reduce((s, p) => s + p.marketValue, 0), b = list.reduce((s, p) => s + (p.marketValue2024 || 0), 0);
    return { c, yoy: b ? (a / b - 1) * 100 : 0, med: median(list.map((p) => p.yoyPct!)) };
  });
  const movers = [...withYoy].sort((a, b) => b.yoyPct! - a.yoyPct!);
  const up = movers.slice(0, 6), down = movers.slice(-6).reverse();
  const top = properties.slice(0, 10);

  return (
    <>
      <section className="hero">
        <div className="mapbox">
          <CountyMap points={properties} center={[43.16, -77.8]} zoom={10} />
        </div>
        <div className="plate">
          <h1 className="display">Monroe County, parcel by parcel.</h1>
          <p style={{ marginTop: 14 }}>
            The {properties.length} highest-value commercial properties across Rochester and {munis - 1} surrounding towns,
            screened on assessed value, tax status and assessment trend, and underwritten with a cash flow model you can adjust.
          </p>
          <div className="legend" style={{ marginBottom: 14 }}>
            {CATEGORIES.map((c) => (
              <span key={c}><i className="dot" style={{ background: CATEGORY_COLOR[c] }} />{c}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/properties/" className="btn primary">Open the screener</Link>
            <Link href="/market/" className="btn">Read the market</Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section">
          <div className="figs">
            <div className="fig"><div className="k">Tracked market value</div><div className="v">{usdShort(total)}</div><div className="s">2025 final rolls, equalized</div></div>
            <div className="fig"><div className="k">Assessment change, 2024 to 2025</div><div className={`v ${aggYoy >= 0 ? "up" : "down"}`}>{signedPct(aggYoy)}</div><div className="s">Value-weighted, {withYoy.length} parcels</div></div>
            <div className="fig"><div className="k">Value under exemption or PILOT</div><div className="v">{pct((exempt / total) * 100)}</div><div className="s">{usdShort(exempt)} not fully taxable</div></div>
            <div className="fig"><div className="k">Office vacancy, metro</div><div className="v">{pct(MARKET.office.vacancy)}</div><div className="s">CBD {pct(MARKET.office.cbd)}, {MARKET.office.asOf}</div></div>
            <div className="fig"><div className="k">Industrial vacancy</div><div className="v">{pct(MARKET.industrial.vacancy)}</div><div className="s">From {pct(MARKET.industrial.priorVacancy)} at YE 2025</div></div>
            <div className="fig"><div className="k">Apartment vacancy</div><div className="v">{pct(MARKET.multifamily.vacancy)}</div><div className="s">From {pct(MARKET.multifamily.priorVacancy)} in 2024</div></div>
          </div>
        </section>

        <section className="section grid g2">
          <div>
            <h2>Where the value sits, by asset class</h2>
            <Bars rows={CATEGORIES.map((c) => ({
              label: <Link href={`/properties/?category=${encodeURIComponent(c)}`}>{c} <span className="faint">({byCat.get(c)?.count})</span></Link>,
              value: byCat.get(c)?.value || 0, display: usdShort(byCat.get(c)?.value), color: CATEGORY_COLOR[c],
            }))} />
          </div>
          <div>
            <h2>By submarket</h2>
            <Bars rows={SUBMARKET_ORDER.filter((s) => bySub.has(s)).map((s) => ({
              label: <Link href={`/properties/?submarket=${encodeURIComponent(s)}`}>{s} <span className="faint">({bySub.get(s)?.count})</span></Link>,
              value: bySub.get(s)!.value, display: usdShort(bySub.get(s)!.value),
            }))} />
          </div>
        </section>

        <section className="section split">
          <div>
            <h2>Assessment trend by asset class</h2>
            <p className="muted small">Change in equalized full market value between the 2024 and 2025 final rolls. Assessors move slowly, so a sector-wide shift is a meaningful signal of how the market is repricing.</p>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Asset class</th><th className="n">Value-weighted</th><th className="n">Median parcel</th><th className="n">Parcels</th></tr></thead>
                <tbody>
                  {catYoy.map((r) => (
                    <tr key={r.c}>
                      <td><i className="dot" style={{ background: CATEGORY_COLOR[r.c], marginRight: 8 }} />{r.c}</td>
                      <td className={`n ${r.yoy >= 0 ? "up" : "down"}`}>{signedPct(r.yoy)}</td>
                      <td className="n">{signedPct(r.med)}</td>
                      <td className="n">{withYoy.filter((p) => p.category === r.c).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid">
            <div className="panel">
              <h2>Largest increases</h2>
              <MoverList list={up} />
            </div>
            <div className="panel">
              <h2>Largest decreases</h2>
              <MoverList list={down} />
            </div>
          </div>
        </section>

        <section className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <h2>Ten most valuable commercial parcels</h2>
            <Link href="/properties/" className="small">See all {properties.length}</Link>
          </div>
          <div className="panel tight tablewrap">
            <table>
              <thead><tr><th>Address</th><th>Municipality</th><th>Type</th><th>Owner of record</th><th className="n">Market value</th><th className="n">YoY</th><th>Tax status</th></tr></thead>
              <tbody>
                {top.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/properties/${p.id}/`}>{p.address}</Link></td>
                    <td>{p.municipality}</td>
                    <td><i className="dot" style={{ background: CATEGORY_COLOR[p.category], marginRight: 8 }} />{p.subtype}</td>
                    <td className="muted">{p.owner}</td>
                    <td className="n">{usdShort(p.marketValue)}</td>
                    <td className={`n ${p.yoyPct == null ? "" : p.yoyPct >= 0 ? "up" : "down"}`}>{signedPct(p.yoyPct)}</td>
                    <td>{p.taxStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function MoverList({ list }: { list: typeof properties }) {
  return (
    <table>
      <tbody>
        {list.map((p) => (
          <tr key={p.id}>
            <td style={{ whiteSpace: "normal" }}>
              <Link href={`/properties/${p.id}/`}>{p.address}</Link>
              <div className="tiny faint">{p.subtype}, {p.municipality}</div>
            </td>
            <td className="n">{usdShort(p.marketValue)}</td>
            <td className={`n ${p.yoyPct! >= 0 ? "up" : "down"}`}>{signedPct(p.yoyPct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
