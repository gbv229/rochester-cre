import Link from "next/link";
import { notFound } from "next/navigation";
import CountyMap from "../../../components/CountyMap";
import Thumb from "../../../components/Thumb";
import Underwriter from "./Underwriter";
import {
  properties, byId, comparables, median, CATEGORY_COLOR, usd, usdShort, pct, signedPct, num,
  streetViewUrl, mapsUrl, sourceRecordUrl,
} from "../../../lib/data";
import { assumptionsFor, DEBT_DEFAULTS } from "../../../lib/assumptions";

export function generateStaticParams() {
  return properties.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = byId((await params).id);
  return { title: p ? `${p.address}, ${p.municipality}` : "Property" };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const p = byId((await params).id);
  if (!p) notFound();

  const a = assumptionsFor(p.classCode, p.submarket);
  const defaults = {
    price: p.marketValue, noi: Math.round(p.marketValue * a.capRate / 100), vacancy: a.vacancy, opexRatio: a.opexRatio,
    incomeGrowth: a.incomeGrowth, expenseGrowth: a.expenseGrowth,
    ltv: DEBT_DEFAULTS.ltv, rate: DEBT_DEFAULTS.rate, amortYears: DEBT_DEFAULTS.amortYears,
    holdYears: DEBT_DEFAULTS.holdYears, exitCap: a.capRate + DEBT_DEFAULTS.exitCapSpreadBps / 100,
    sellingCostPct: DEBT_DEFAULTS.sellingCostPct, closingCostPct: DEBT_DEFAULTS.closingCostPct,
  };

  const peers = properties.filter((q) => q.category === p.category);
  const sameType = properties.filter((q) => q.subtype === p.subtype);
  const rankInClass = [...peers].sort((x, y) => y.marketValue - x.marketValue).findIndex((q) => q.id === p.id) + 1;
  const peerMedian = median(peers.map((q) => q.marketValue))!;
  const peerYoy = median(peers.filter((q) => q.yoyPct != null).map((q) => q.yoyPct!));
  const peerImpr = median(peers.filter((q) => q.improvementRatio != null).map((q) => q.improvementRatio!));
  const comps = comparables(p, 6);
  const landShare = (p.landValue / p.marketValue) * 100;
  const yoyDollar = p.marketValue2024 ? p.marketValue - p.marketValue2024 : null;

  return (
    <div className="wrap">
      <div className="crumbs">
        <Link href="/properties/">Screener</Link> / <Link href={`/properties/?category=${encodeURIComponent(p.category)}`}>{p.category}</Link> / {p.address}
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "end", paddingBottom: 18 }}>
        <div>
          <h1>{p.address}</h1>
          <div className="muted">{p.municipality}, Monroe County, NY. Parcel {p.printKey}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <span className="chip"><i className="dot" style={{ background: CATEGORY_COLOR[p.category] }} />{p.subtype}</span>
            <span className="chip">{p.submarket}</span>
            <span className="chip">{p.taxStatus}</span>
            <span className="chip">#{p.rank} of {properties.length} by value</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="small muted">2025 full market value</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontStretch: "112%", lineHeight: 1.1 }}>{usd(p.marketValue)}</div>
          <div className={`small ${p.yoyPct == null ? "muted" : p.yoyPct >= 0 ? "up" : "down"}`}>
            {p.yoyPct == null ? "No 2024 record under this parcel ID" : `${signedPct(p.yoyPct)} (${yoyDollar! >= 0 ? "+" : "−"}${usdShort(Math.abs(yoyDollar!))}) vs 2024 roll`}
          </div>
        </div>
      </header>

      <section className="split" style={{ paddingBottom: 28 }}>
        <div>
          <div className="aerial">
            <Thumb lat={p.lat} lon={p.lon} alt={`Aerial photograph of ${p.address}, ${p.municipality}`} w={900} h={520} span={0.0032} />
            {p.lat != null && <div className="pin" aria-hidden="true" />}
            <div className="credit">Imagery © Esri, Maxar, Earthstar Geographics</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {p.lat != null && <a className="btn" href={streetViewUrl(p.lat, p.lon!)} target="_blank" rel="noreferrer">Open Street View</a>}
            <a className="btn" href={mapsUrl(p)} target="_blank" rel="noreferrer">Google Maps</a>
            <a className="btn" href={sourceRecordUrl(p)} target="_blank" rel="noreferrer">Source assessment record</a>
          </div>
        </div>
        <div className="panel tight" style={{ height: "100%", minHeight: 320 }}>
          <CountyMap points={[p, ...comps.map((c) => c.q)]} focusId={p.id} fitToPoints />
        </div>
      </section>

      <section className="grid g3" style={{ paddingBottom: 28 }}>
        <div className="panel">
          <h2>Valuation</h2>
          <div className="stack" aria-label={`Land ${pct(landShare, 0)}, improvements ${pct(100 - landShare, 0)}`}>
            <div style={{ width: `${landShare}%`, background: "var(--lilac)" }} />
            <div style={{ width: `${100 - landShare}%`, background: "var(--parcel)" }} />
          </div>
          <div className="legend" style={{ margin: "8px 0 14px" }}>
            <span><i className="dot" style={{ background: "var(--lilac)" }} />Land {pct(landShare, 0)}</span>
            <span><i className="dot" style={{ background: "var(--parcel)" }} />Improvements {pct(100 - landShare, 0)}</span>
          </div>
          <dl className="kv">
            <dt>Land value</dt><dd>{usd(p.landValue)}</dd>
            <dt>Improvement value</dt><dd>{usd(p.improvementValue)}</dd>
            <dt>2024 market value</dt><dd>{usd(p.marketValue2024)}</dd>
            <dt>Assessed total</dt><dd>{usd(p.assessedTotal)}</dd>
            <dt>Level of assessment</dt><dd>{pct(p.equalizationRatio, 2)}</dd>
            <dt>Rank in {p.category.toLowerCase()}</dt><dd>{rankInClass} of {peers.length}</dd>
            <dt>vs class median</dt><dd>{(p.marketValue / peerMedian).toFixed(1)}x ({usdShort(peerMedian)})</dd>
          </dl>
        </div>
        <div className="panel">
          <h2>Tax and ownership</h2>
          <dl className="kv">
            <dt>Owner of record</dt><dd>{p.owner}</dd>
            <dt>Owner type</dt><dd>{p.ownerType}</dd>
            <dt>Tax status</dt><dd>{p.taxStatus}</dd>
            <dt>County taxable value</dt><dd>{usd(p.countyTaxable)}</dd>
            <dt>Share taxable</dt><dd>{pct(p.taxablePct, 1)}</dd>
            <dt>School district</dt><dd>{p.schoolDistrict}</dd>
          </dl>
          {p.ownerType === "IDA lease (COMIDA)" && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Title is held by the County of Monroe Industrial Development Agency, the usual structure for a payment-in-lieu-of-taxes
              (PILOT) agreement. Diligence should confirm the PILOT schedule and when it steps up to full taxes.
            </p>
          )}
        </div>
        <div className="panel">
          <h2>Site</h2>
          <dl className="kv">
            <dt>Lot area</dt><dd>{p.lotAcres ? `${num(p.lotAcres, 2)} acres` : "Irregular; not reported"}</dd>
            <dt>Frontage × depth</dt><dd>{p.frontageFt ? `${num(p.frontageFt, 0)} ft × ${p.depthFt ? num(p.depthFt, 0) + " ft" : "—"}` : "—"}</dd>
            <dt>Value per acre</dt><dd>{usd(p.valuePerAcre)}</dd>
            <dt>Distance to downtown</dt><dd>{p.distanceToCbdMi != null ? `${num(p.distanceToCbdMi, 1)} mi` : "—"}</dd>
            <dt>Submarket</dt><dd>{p.submarket}</dd>
            <dt>Property class</dt><dd>{p.classCode}, {p.subtype}</dd>
          </dl>
          {p.flags.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {p.flags.map((f) => <span key={f} className="flag">{f}</span>)}
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 28 }}>
        <h2>How it compares</h2>
        <div className="figs">
          <div className="fig"><div className="k">This parcel, YoY</div><div className={`v ${p.yoyPct != null && p.yoyPct < 0 ? "down" : "up"}`}>{signedPct(p.yoyPct)}</div><div className="s">{p.category} median {signedPct(peerYoy)}</div></div>
          <div className="fig"><div className="k">Improvement share</div><div className="v">{pct(p.improvementRatio, 0)}</div><div className="s">{p.category} median {pct(peerImpr, 0)}</div></div>
          <div className="fig"><div className="k">Same property type</div><div className="v">{sameType.length}</div><div className="s">tracked {p.subtype.toLowerCase()} parcels</div></div>
          <div className="fig"><div className="k">Implied going-in NOI</div><div className="v">{usdShort(p.marketValue * a.capRate / 100)}</div><div className="s">At a {pct(a.capRate, 2)} market cap</div></div>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2>Underwriting</h2>
        <p className="muted">
          A five-year levered model with the assessor's full market value as the purchase price. Assessment rolls don't publish
          rent rolls, so year 1 NOI starts at market value times a market cap rate, then grosses up through vacancy and expenses.
          Change the price to test what you'd pay for that income. Use it to stress-test value, not as an appraisal.
        </p>
        <Underwriter defaults={defaults} basis={a.basis} />
      </section>

      <section className="panel tight" style={{ marginBottom: 20 }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2>Nearest {p.category.toLowerCase()} comparables</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Address</th><th>Type</th><th className="n">Distance</th><th className="n">Market value</th><th className="n">YoY</th><th className="n">Improvements</th><th>Tax status</th></tr></thead>
            <tbody>
              {comps.map(({ q, d }) => (
                <tr key={q.id}>
                  <td><Link href={`/properties/${q.id}/`}>{q.address}</Link><div className="tiny faint">{q.municipality}</div></td>
                  <td>{q.subtype}</td>
                  <td className="n">{Number.isFinite(d) ? `${d.toFixed(1)} mi` : "—"}</td>
                  <td className="n">{usd(q.marketValue)}</td>
                  <td className={`n ${q.yoyPct == null ? "" : q.yoyPct >= 0 ? "up" : "down"}`}>{signedPct(q.yoyPct)}</td>
                  <td className="n">{pct(q.improvementRatio, 0)}</td>
                  <td>{q.taxStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
