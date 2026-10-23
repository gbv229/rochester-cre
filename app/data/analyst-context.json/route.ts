import { properties } from "../../../lib/data";
import { BY_CLASS, MARKET, DEBT_DEFAULTS, assumptionsFor } from "../../../lib/assumptions";
import { SERIES, last } from "../../../lib/economy";

export const dynamic = "force-static";

/**
 * Compact context for the AI analyst. The Cloudflare Worker fetches this file and
 * builds its system prompt from it, so the model only ever sees platform data.
 */
export function GET() {
  const cols = ["id", "address", "municipality", "submarket", "subtype", "owner", "marketValue", "marketValue2024", "yoyPct",
    "landValue", "improvementRatio", "taxStatus", "taxablePct", "lotAcres", "distanceToCbdMi", "capRate", "impliedNoi", "flags"];
  const rows = properties.map((p) => {
    const a = assumptionsFor(p.classCode, p.submarket);
    return [p.id, p.address, p.municipality, p.submarket, p.subtype, p.owner, p.marketValue, p.marketValue2024 ?? "", p.yoyPct ?? "",
      p.landValue, p.improvementRatio ?? "", p.taxStatus, p.taxablePct ?? "", p.lotAcres ?? "", p.distanceToCbdMi ?? "",
      a.capRate, Math.round(p.marketValue * a.capRate / 100), p.flags.join("; ")].join("|");
  });
  const economy = Object.fromEntries(Object.entries(SERIES).map(([k, s]) => [k, { title: s.title, units: s.units, latest: last(s.data), series: s.data }]));
  return Response.json({
    generated: new Date().toISOString().slice(0, 10),
    propertyColumns: cols.join("|"),
    properties: rows,
    assumptionsByClass: BY_CLASS,
    cbdOffice: assumptionsFor("464", "CBD"),
    debtDefaults: DEBT_DEFAULTS,
    market: MARKET,
    economy,
  });
}
