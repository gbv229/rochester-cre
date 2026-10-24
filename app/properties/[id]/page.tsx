import Link from "next/link";
import { notFound } from "next/navigation";
import CountyMap from "../../../components/CountyMap";
import Thumb from "../../../components/Thumb";
import Underwriter from "./Underwriter";
import Analyst from "../../../components/Analyst";
import { SERIES, last } from "../../../lib/economy";
import {
  properties, byId, comparables, median, CATEGORY_COLOR, usd, usdShort, pct, signedPct, num,
  streetViewUrl, mapsUrl, sourceRecordUrl,
} from "../../../lib/data";
import { assumptionsFor, DEBT_DEFAULTS } from "../../../lib/assumptions";
import { run } from "../../../lib/model";
import { defaultInputs } from "../../../lib/defaults";

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
  const defaults = defaultInputs(p);
  const baseNoi = defaults.pgi * (1 - defaults.vacancy / 100) - defaults.opex;

  const peers = properties.filter((q) => q.category === p.category);
  const sameType = properties.filter((q) => q.subtype === p.subtype);
  const rankInClass = [...peers].sort((x, y) => y.marketValue - x.marketValue).findIndex((q) => q.id === p.id) + 1;
  const peerMedian = median(peers.map((q) => q.marketValue))!;
  const peerYoy = median(peers.filter((q) => q.yoyPct != null).map((q) => q.yoyPct!));
  const peerImpr = median(peers.filter((q) => q.improvementRatio != null).map((q) => q.improvementRatio!));
  const comps = comparables(p, 6);
  const landShare = (p.landValue / p.marketValue) * 100;
  const yoyDollar = p.marketValue2024 ? p.marketValue - p.marketValue2024 : null;
  const tsy = last(SERIES.treasury10.data).value;
  const spreadBps = (a.capRate - tsy) * 100;

  // Investment considerations, derived only from this parcel's data and the market inputs.
  const notes: { t: string; d: string }[] = [];
  if (p.yoyPct != null && peerYoy != null) {
    const diff = p.yoyPct - peerYoy;
    if (p.yoyPct >= 25) notes.push({ t: "Large reassessment", d: `Value rose ${signedPct(p.yoyPct)} in one roll, versus a ${signedPct(peerYoy)} median for ${p.category.toLowerCase()}. Jumps this size usually reflect new construction, an expansion or a reassessment; confirm which before treating it as market appreciation.` });
    else if (p.yoyPct <= -10) notes.push({ t: "Assessment cut", d: `Value fell ${signedPct(p.yoyPct)} while the ${p.category.toLowerCase()} median rose ${signedPct(peerYoy)}. Drops like this often follow a tax certiorari settlement, which can signal weaker income or an owner actively managing taxes.` });
    else if (p.municipality === "Rochester" && p.yoyPct === 0) notes.push({ t: "City roll held flat", d: "The City of Rochester kept most commercial values unchanged on the 2025 roll, so a 0% change reflects the assessor's revaluation cycle rather than the market. A citywide reassessment could reset this value in either direction." });
    else if (Math.abs(diff) >= 3) notes.push({ t: diff > 0 ? "Outpacing its class" : "Lagging its class", d: `Assessment change of ${signedPct(p.yoyPct)} versus a ${signedPct(peerYoy)} median for tracked ${p.category.toLowerCase()} parcels.` });
  }
  // Property tax: turn the PILOT / exemption risk into dollars and IRR.
  const egiY1 = defaults.pgi * (1 - defaults.vacancy / 100);
  const baseRun = run(defaults);
  const stepRun = (defaults.taxStepUp ?? 0) > 0 ? run({ ...defaults, taxStepUpYear: 3 }) : null;
  if (p.taxStatus !== "Fully taxable" && stepRun) {
    notes.push({ t: "Tax step-up risk", d: `Taxes at full assessment would run about ${usdShort(p.estTaxFull)} a year (${pct(p.effectiveTaxRate, 2)} of value), versus roughly ${usdShort(p.estTaxCurrent ?? 0)} on the currently taxable share. That gap is ${pct((defaults.taxStepUp! / baseNoi) * 100, 0)} of implied NOI. If the ${p.taxStatus === "Fully exempt / PILOT" ? "PILOT" : "exemption"} ended in year 3, levered IRR would fall from ${pct(baseRun.leveredIrr)} to ${pct(stepRun.leveredIrr)}. Real PILOTs usually phase in, so treat this as the downside bound and get the actual schedule.` });
  } else if (p.estTaxPrior && p.estTaxFull - p.estTaxPrior > 50000) {
    notes.push({ t: "Reassessment raised the tax bill", d: `At current rates the new assessment implies about ${usdShort(p.estTaxFull)} in annual taxes, up roughly ${usdShort(p.estTaxFull - p.estTaxPrior)} from the 2024 value. That increase alone is ${pct(((p.estTaxFull - p.estTaxPrior) / baseNoi) * 100, 1)} of implied NOI, so check whether the owner has filed a grievance and underwrite taxes on the 2025 value.` });
  }
  if (p.improvementRatio != null && p.improvementRatio < 60) notes.push({ t: "Land-heavy basis", d: `Land is ${pct(100 - p.improvementRatio, 0)} of value (class median ${pct(100 - (peerImpr ?? 0), 0)}). The building may be under-improved for the site, which can support a redevelopment or densification angle.` });
  if (p.category === "Office") notes.push({ t: p.submarket === "CBD" ? "Downtown office vacancy" : "Suburban office vacancy", d: p.submarket === "CBD" ? "Downtown vacancy is 29.2%, roughly double the suburbs. Leasing risk, re-tenanting capital and conversion potential drive value more than in-place income." : "Suburban vacancy is 15.3% with four straight quarters of positive absorption, a healthier backdrop than downtown's 29.2%." });
  if (p.category === "Industrial") notes.push({ t: "Industrial demand", d: p.subtype.startsWith("Warehouse") ? "Warehouse and distribution is the tightest segment in the market at 5.6% vacancy." : `Rochester has lost manufacturing jobs since 2015 and manufacturing space is ${p.subtype.startsWith("Light") ? "9.5% (flex)" : "8.0%"} vacant, so tenant credit and re-leasing depth matter.` });
  if (p.category === "Multifamily") notes.push({ t: "Apartment supply", d: "Metro apartment vacancy rose from 4.9% to 6.6% in 2025 as new supply delivered, while rents grew under 3%. Underwrite concessions on lease-up." });
  notes.push({ t: "Spread to Treasuries", d: `At a ${pct(a.capRate, 2)} market cap rate, this asset prices ${spreadBps.toFixed(0)} bps over the ${pct(tsy, 2)} 10-year. ${spreadBps < 250 ? "That's thin by historical standards, so returns lean on growth." : "That's within or above the historical 300–400 bps range."}` });
  if (p.lotAcres && p.lotAcres >= 10) notes.push({ t: "Large site", d: `${num(p.lotAcres, 1)} acres at ${usdShort(p.valuePerAcre)} per acre gives room for pad sites, parking reconfiguration or phased additions.` });

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

      <section className="panel" style={{ marginBottom: 28 }}>
        <h2>Property taxes</h2>
        <div className="split" style={{ gap: 24 }}>
          <div>
            <div className="figs">
              <div className="fig"><div className="k">Est. tax at full assessment</div><div className="v">{usdShort(p.estTaxFull)}</div><div className="s">{pct(p.effectiveTaxRate, 2)} of market value</div></div>
              <div className="fig"><div className="k">Est. tax on taxable share</div><div className="v">{usdShort(p.estTaxCurrent)}</div><div className="s">{p.taxStatus}</div></div>
              <div className="fig"><div className="k">{p.taxStatus === "Fully taxable" ? "Share of implied EGI" : "If fully taxed, share of EGI"}</div><div className="v">{pct((p.estTaxFull / egiY1) * 100, 1)}</div><div className="s">{p.taxStatus === "Fully taxable" ? `Inside the ${pct(a.opexRatio, 0)} expense ratio` : "Not in the default expenses"}</div></div>
              <div className="fig"><div className="k">Change from 2024 value</div><div className="v">{p.estTaxPrior ? `${p.estTaxFull >= p.estTaxPrior ? "+" : "−"}${usdShort(Math.abs(p.estTaxFull - p.estTaxPrior))}` : "—"}</div><div className="s">{p.taxStatus === "Fully taxable" ? "Same rates, new assessment" : "Full-tax basis, same rates"}</div></div>
            </div>
          </div>
          <div>
            <table>
              <tbody>
                <tr><td>County{p.municipality === "Rochester" ? " (incl. Pure Waters)" : ""}</td><td className="n">${p.taxRates.county.toFixed(2)}</td></tr>
                <tr><td>{p.municipality === "Rochester" ? "City" : "Town"}</td><td className="n">${p.taxRates.municipal.toFixed(2)}</td></tr>
                <tr><td>School ({p.schoolDistrict})</td><td className="n">${p.taxRates.school.toFixed(2)}</td></tr>
                <tr className="total"><td>Combined, per $1,000</td><td className="n">${p.taxRateTotal.toFixed(2)}</td></tr>
              </tbody>
            </table>
            <p className="tiny faint" style={{ margin: "8px 0 0" }}>{p.taxBasis}. Excludes special districts (fire, sewer, library) and village taxes, so actual town bills run higher. PILOT payments aren't on the roll.</p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2>Underwriting</h2>
        <p className="muted">
          A five-year levered model with the assessor's full market value as the purchase price. Assessment rolls don't publish
          rent rolls, so default income is backed out of market value at a market cap rate: gross income, less vacancy, less
          operating expenses, gives NOI. Change price, rents, vacancy or expenses to stress-test it. It's not an appraisal.
        </p>
        <Underwriter defaults={defaults} basis={a.basis} property={p} />
      </section>

      <section className="split" style={{ marginBottom: 28 }}>
        <div className="panel">
          <h2>Investment considerations</h2>
          <p className="small muted">Generated from this parcel's assessment data and Rochester market inputs. Use them as diligence prompts.</p>
          <ul className="thesis" style={{ paddingLeft: "1.1rem", margin: 0 }}>
            {notes.map((n) => <li key={n.t}><strong>{n.t}.</strong> {n.d}</li>)}
          </ul>
        </div>
        <div>
          <h2>Ask about this property</h2>
          <Analyst compact propertyId={p.id} suggestions={[
            "Summarize this property as an investment in five bullets.",
            "What would I need to pay to hit a 12% levered IRR?",
            "What diligence questions should I ask the seller?",
            `How does it compare to the other ${p.subtype.toLowerCase()} parcels?`,
          ]} />
        </div>
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
