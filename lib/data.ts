import raw from "../data/properties.json";

export type Property = {
  id: string;
  printKey: string;
  address: string;
  municipality: string;
  city: string;
  schoolDistrict: string;
  submarket: string;
  classCode: string;
  category: string;
  subtype: string;
  owner: string;
  ownerType: string;
  marketValue: number;
  marketValue2024: number | null;
  yoyPct: number | null;
  landValue: number;
  improvementValue: number;
  improvementRatio: number | null;
  assessedTotal: number | null;
  equalizationRatio: number | null;
  countyTaxable: number | null;
  taxablePct: number | null;
  taxStatus: string;
  frontageFt: number | null;
  depthFt: number | null;
  lotAcres: number | null;
  valuePerAcre: number | null;
  lat: number | null;
  lon: number | null;
  distanceToCbdMi: number | null;
  flags: string[];
  rank: number;
};

export const properties = raw as Property[];

export const CATEGORIES = ["Multifamily", "Office", "Industrial", "Retail", "Hospitality", "Mixed-use", "Parking"] as const;

// One hue per asset class, chosen to stay distinguishable on the light map and in charts.
export const CATEGORY_COLOR: Record<string, string> = {
  Multifamily: "#2B5FA8",
  Office: "#6A4C9C",
  Industrial: "#8A6A2E",
  Retail: "#2F7D5B",
  Hospitality: "#B2453A",
  "Mixed-use": "#3D8C9E",
  Parking: "#6B7280",
};

export const SUBMARKET_ORDER = ["CBD", "City of Rochester", "Southeast", "South", "West", "North", "East"];

export function byId(id: string) {
  return properties.find((p) => p.id === id);
}

export function displayCity(p: Property) {
  return p.municipality === "Rochester" ? "Rochester" : `${p.municipality}`;
}

export const usd = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });

export function usdShort(v: number | null | undefined) {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${v.toFixed(digits)}%`);
export const signedPct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
export const num = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Esri World Imagery static export, centered on the parcel. No API key; attribution shown wherever used. */
export function aerialUrl(lat: number, lon: number, w = 900, h = 520, spanDeg = 0.0024) {
  const dLat = spanDeg * (h / w) * 0.75;
  const bbox = [lon - spanDeg / 2, lat - dLat / 2, lon + spanDeg / 2, lat + dLat / 2].join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
}

export const streetViewUrl = (lat: number, lon: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
export const mapsUrl = (p: Property) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address}, ${p.municipality}, NY`)}`;
export const sourceRecordUrl = (p: Property) =>
  `https://data.ny.gov/resource/7vem-aaz7.json?county_name=Monroe&print_key_code=${encodeURIComponent(p.printKey)}&municipality_name=${encodeURIComponent(p.municipality)}`;

export function distanceMi(a: Property, b: Property) {
  if (a.lat == null || b.lat == null || a.lon == null || b.lon == null) return Infinity;
  const R = 3958.8, r = Math.PI / 180;
  const dp = (b.lat - a.lat) * r, dl = (b.lon - a.lon) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function comparables(p: Property, n = 5) {
  return properties
    .filter((q) => q.id !== p.id && q.category === p.category)
    .map((q) => ({ q, d: distanceMi(p, q) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function groupSum(key: keyof Property, list = properties) {
  const out = new Map<string, { count: number; value: number }>();
  for (const p of list) {
    const k = String(p[key]);
    const g = out.get(k) || { count: 0, value: 0 };
    g.count++; g.value += p.marketValue;
    out.set(k, g);
  }
  return out;
}

/** Groups owner-of-record names that belong to the same organization. */
const OWNER_GROUPS: [RegExp, string][] = [
  [/wegmans/i, "Wegmans Food Markets"],
  [/paychex/i, "Paychex"],
  [/universit(y|e) of roch|univ.*roch/i, "University of Rochester"],
  [/comida/i, "COMIDA (IDA-held leases)"],
  [/kodak/i, "Eastman Kodak"],
  [/rochester general|grhs/i, "Rochester Regional Health"],
  [/meridian centre/i, "Meridian Centre Associates"],
  [/costello/i, "Anthony J. Costello & Son"],
  [/wal-?mart/i, "Walmart"],
  [/lowe'?s/i, "Lowe's"],
  [/city of rochester|urban renewal/i, "City of Rochester"],
  [/real mckeever/i, "Real McKeever"],
  [/hylan enterprises/i, "Hylan Enterprises"],
  [/north forest/i, "North Forest Properties"],
  [/dimarco/i, "DiMarco Group"],
  [/widewaters/i, "Widewaters"],
  [/sibley/i, "Sibley redevelopment entities"],
  [/xerox/i, "Xerox"],
];
export function ownerGroup(owner: string) {
  for (const [re, name] of OWNER_GROUPS) if (re.test(owner)) return name;
  return owner;
}
