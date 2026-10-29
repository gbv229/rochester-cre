"use client";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import CountyMap from "../../components/CountyMap";
import Thumb from "../../components/Thumb";
import { properties, CATEGORIES, CATEGORY_COLOR, SUBMARKET_ORDER, usdShort, usd, signedPct, pct, num, median, type Property } from "../../lib/data";
import { assumptionsFor } from "../../lib/assumptions";

type SortKey = "marketValue" | "yoyPct" | "improvementRatio" | "lotAcres" | "valuePerAcre" | "distanceToCbdMi" | "address" | "impliedNoi" | "taxablePct" | "estTaxFull";
const MUNIS = [...new Set(properties.map((p) => p.municipality))].sort();
const TAX = ["Fully taxable", "Partially exempt", "Fully exempt / PILOT"];
const OWNERS = [...new Set(properties.map((p) => p.ownerType))].sort();
const FLAGS = [...new Set(properties.flatMap((p) => p.flags))].sort();
const SUBTYPES = [...new Set(properties.map((p) => p.subtype))].sort();

const impliedNoi = (p: Property) => p.marketValue * (assumptionsFor(p.classCode, p.submarket).capRate / 100);

export default function Screener() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [subtype, setSubtype] = useState("");
  const [sub, setSub] = useState("");
  const [muni, setMuni] = useState("");
  const [tax, setTax] = useState("");
  const [owner, setOwner] = useState("");
  const [flag, setFlag] = useState("");
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [minYoy, setMinYoy] = useState("");
  const [maxDist, setMaxDist] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "marketValue", dir: -1 });
  const [view, setView] = useState<"table" | "cards" | "map">("table");

  useEffect(() => {
    setCat(sp.get("category") || "");
    setSub(sp.get("submarket") || "");
    setMuni(sp.get("municipality") || "");
    setQ(sp.get("q") || "");
  }, [sp]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = properties.filter((p) =>
      (!ql || `${p.address} ${p.owner} ${p.municipality} ${p.printKey}`.toLowerCase().includes(ql)) &&
      (!cat || p.category === cat) && (!subtype || p.subtype === subtype) && (!sub || p.submarket === sub) &&
      (!muni || p.municipality === muni) && (!tax || p.taxStatus === tax) && (!owner || p.ownerType === owner) &&
      (!flag || p.flags.includes(flag)) &&
      (!minV || p.marketValue >= Number(minV) * 1e6) && (!maxV || p.marketValue <= Number(maxV) * 1e6) &&
      (!minYoy || (p.yoyPct != null && p.yoyPct >= Number(minYoy))) &&
      (!maxDist || (p.distanceToCbdMi != null && p.distanceToCbdMi <= Number(maxDist))));
    const val = (p: Property) => (sort.k === "impliedNoi" ? impliedNoi(p) : (p as any)[sort.k]);
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sort.dir;
    });
  }, [q, cat, subtype, sub, muni, tax, owner, flag, minV, maxV, minYoy, maxDist, sort]);

  const totalV = rows.reduce((s, p) => s + p.marketValue, 0);
  const medYoy = median(rows.filter((p) => p.yoyPct != null).map((p) => p.yoyPct!));
  const exemptShare = totalV ? (rows.filter((p) => p.taxStatus !== "Fully taxable").reduce((s, p) => s + p.marketValue, 0) / totalV) * 100 : 0;

  const reset = () => { setQ(""); setCat(""); setSubtype(""); setSub(""); setMuni(""); setTax(""); setOwner(""); setFlag(""); setMinV(""); setMaxV(""); setMinYoy(""); setMaxDist(""); };

  const exportCsv = () => {
    const cols: (keyof Property)[] = ["printKey", "address", "municipality", "submarket", "category", "subtype", "owner", "ownerType", "marketValue", "marketValue2024", "yoyPct", "landValue", "improvementValue", "improvementRatio", "countyTaxable", "taxablePct", "taxStatus", "taxRateTotal", "estTaxFull", "estTaxCurrent", "lotAcres", "valuePerAcre", "distanceToCbdMi", "lat", "lon"];
    const esc = (v: unknown) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [cols.join(","), ...rows.map((p) => cols.map((c) => esc(p[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "rochestercre-screen.csv";
    a.click();
  };

  const th = (k: SortKey, label: string, n = true) => (
    <th className={n ? "n" : ""} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : k === "address" || k === "distanceToCbdMi" ? 1 : -1 }))}>
        {label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  const sel = (label: string, v: string, set: (s: string) => void, opts: string[]) => (
    <label className="field">{label}
      <select value={v} onChange={(e) => set(e.target.value)}>
        <option value="">All</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="wrap">
      <div style={{ padding: "28px 0 8px" }}>
        <h1>Property screener</h1>
        <p className="muted">Filter {properties.length} commercial parcels by asset class, location, value, tax treatment and assessment trend. Click any column to sort; export the current screen to CSV.</p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <label className="field" style={{ gridColumn: "span 2" }}>Search address, owner or parcel ID
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Jefferson Rd, Wegmans, 121.31" />
          </label>
          {sel("Asset class", cat, setCat, [...CATEGORIES])}
          {sel("Property type", subtype, setSubtype, SUBTYPES)}
          {sel("Submarket", sub, setSub, SUBMARKET_ORDER)}
          {sel("Municipality", muni, setMuni, MUNIS)}
          {sel("Tax status", tax, setTax, TAX)}
          {sel("Owner type", owner, setOwner, OWNERS)}
          {sel("Screening flag", flag, setFlag, FLAGS)}
          <label className="field">Min value ($M)<input inputMode="decimal" value={minV} onChange={(e) => setMinV(e.target.value)} /></label>
          <label className="field">Max value ($M)<input inputMode="decimal" value={maxV} onChange={(e) => setMaxV(e.target.value)} /></label>
          <label className="field">Min YoY change (%)<input inputMode="decimal" value={minYoy} onChange={(e) => setMinYoy(e.target.value)} /></label>
          <label className="field">Max miles to downtown<input inputMode="decimal" value={maxDist} onChange={(e) => setMaxDist(e.target.value)} /></label>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="small">
          <strong>{rows.length}</strong> properties, <strong>{usdShort(totalV)}</strong> market value, median YoY <strong>{signedPct(medYoy)}</strong>, {pct(exemptShare, 0)} of value not fully taxable
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label="View">
            {(["table", "cards", "map"] as const).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          <button className="btn" onClick={reset}>Clear filters</button>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="panel"><p style={{ margin: 0 }}>No properties match these filters. Widen the value range or clear a filter to see results.</p></div>
      )}

      {view === "table" && rows.length > 0 && (
        <div className="panel tight tablewrap" style={{ maxHeight: "75vh" }} tabIndex={0} role="region" aria-label="Property results table">
          <table className="screener">
            <thead>
              <tr>
                {th("address", "Address", false)}
                <th>Type</th>
                <th>Submarket</th>
                {th("marketValue", "Market value")}
                {th("yoyPct", "YoY")}
                {th("improvementRatio", "Improvements")}
                {th("lotAcres", "Lot ac")}
                {th("valuePerAcre", "Value / ac")}
                {th("impliedNoi", "Implied NOI")}
                {th("estTaxFull", "Est. tax")}
                {th("taxablePct", "Taxable")}
                {th("distanceToCbdMi", "Mi to CBD")}
                <th>Owner of record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/properties/${p.id}/`}>{p.address}</Link><div className="tiny faint">{p.municipality}</div></td>
                  <td><i className="dot" style={{ background: CATEGORY_COLOR[p.category], marginRight: 8 }} />{p.subtype}</td>
                  <td>{p.submarket}</td>
                  <td className="n">{usd(p.marketValue)}</td>
                  <td className={`n ${p.yoyPct == null ? "" : p.yoyPct >= 0 ? "up" : "down"}`}>{signedPct(p.yoyPct)}</td>
                  <td className="n">{pct(p.improvementRatio, 0)}</td>
                  <td className="n">{num(p.lotAcres, 1)}</td>
                  <td className="n">{usdShort(p.valuePerAcre)}</td>
                  <td className="n">{usdShort(impliedNoi(p))}</td>
                  <td className="n">{usdShort(p.estTaxFull)}</td>
                  <td className="n">{pct(p.taxablePct, 0)}</td>
                  <td className="n">{num(p.distanceToCbdMi, 1)}</td>
                  <td className="muted">{p.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "cards" && (
        <div className="cards">
          {rows.slice(0, 60).map((p) => (
            <Link key={p.id} href={`/properties/${p.id}/`} className="card">
              <div className="thumb"><Thumb lat={p.lat} lon={p.lon} alt={`Aerial view of ${p.address}`} /></div>
              <div className="body">
                <div className="addr">{p.address}</div>
                <div className="small muted">{p.subtype}, {p.municipality}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <strong>{usdShort(p.marketValue)}</strong>
                  <span className={`small ${p.yoyPct == null ? "" : p.yoyPct >= 0 ? "up" : "down"}`}>{signedPct(p.yoyPct)} YoY</span>
                </div>
              </div>
            </Link>
          ))}
          {rows.length > 60 && <p className="muted small">Showing the first 60 of {rows.length}. Narrow the filters or switch to the table for the rest.</p>}
        </div>
      )}

      {view === "map" && rows.length > 0 && (
        <div className="panel tight" style={{ height: "70vh" }}>
          <CountyMap points={rows} fitToPoints scrollWheelZoom />
        </div>
      )}
    </div>
  );
}
