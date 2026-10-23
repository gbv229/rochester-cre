/**
 * Market assumptions that seed the underwriting model.
 *
 * Vacancy figures are Rochester-specific where a published figure exists
 * (Cushman & Wakefield / Pyramid Brokerage Q2 2026 MarketBeats, CBRE year-end 2025
 * retail, Realtor.com 2025 rental data via the Rochester Business Journal).
 * Cap rates start from Q2 2026 national averages and add a tertiary-market spread,
 * since Rochester trades wider than gateway metros. Every figure is an editable input.
 */

export type Assumption = {
  capRate: number;        // going-in cap rate, %
  vacancy: number;        // vacancy & credit loss, % of potential gross income
  opexRatio: number;      // operating expenses, % of effective gross income
  incomeGrowth: number;   // annual rent / revenue growth, %
  expenseGrowth: number;  // annual expense growth, %
  basis: string;          // where the vacancy figure comes from
};

const base = { expenseGrowth: 3.0 };

export const BY_CLASS: Record<string, Assumption> = {
  "411": { ...base, capRate: 6.5, vacancy: 6.6, opexRatio: 45, incomeGrowth: 2.5, basis: "Rochester apartment vacancy 6.6% (Realtor.com 2025, via RBJ)" },
  "464": { ...base, capRate: 8.75, vacancy: 15.3, opexRatio: 42, incomeGrowth: 1.5, basis: "Rochester suburban office vacancy 15.3% (C&W / Pyramid, Q2 2026)" },
  "465": { ...base, capRate: 7.75, vacancy: 15.3, opexRatio: 40, incomeGrowth: 2.0, basis: "Rochester suburban office vacancy 15.3% (C&W / Pyramid, Q2 2026)" },
  "449": { ...base, capRate: 7.25, vacancy: 5.6, opexRatio: 15, incomeGrowth: 3.0, basis: "Rochester warehouse/distribution vacancy 5.6% (C&W / Pyramid, Q2 2026)" },
  "710": { ...base, capRate: 8.25, vacancy: 8.0, opexRatio: 15, incomeGrowth: 2.5, basis: "Rochester manufacturing vacancy 8.0% (C&W / Pyramid, Q2 2026)" },
  "714": { ...base, capRate: 8.0, vacancy: 9.5, opexRatio: 18, incomeGrowth: 2.5, basis: "Rochester flex vacancy 9.5% (C&W / Pyramid, Q2 2026)" },
  "452": { ...base, capRate: 7.75, vacancy: 6.3, opexRatio: 25, incomeGrowth: 2.0, basis: "Rochester retail vacancy 6.3% (CBRE, YE 2025)" },
  "453": { ...base, capRate: 8.0, vacancy: 6.3, opexRatio: 20, incomeGrowth: 1.5, basis: "Rochester retail vacancy 6.3% (CBRE, YE 2025)" },
  "454": { ...base, capRate: 7.0, vacancy: 6.3, opexRatio: 20, incomeGrowth: 2.0, basis: "Rochester retail vacancy 6.3% (CBRE, YE 2025)" },
  "414": { ...base, capRate: 9.25, vacancy: 35, opexRatio: 68, incomeGrowth: 3.0, basis: "Model assumption: 65% stabilized hotel occupancy" },
  "481": { ...base, capRate: 8.25, vacancy: 12, opexRatio: 40, incomeGrowth: 2.0, basis: "Blend of CBD residential and ground-floor retail (model assumption)" },
  "437": { ...base, capRate: 8.5, vacancy: 20, opexRatio: 35, incomeGrowth: 2.0, basis: "Model assumption tied to 29.2% CBD office vacancy" },
};

/** CBD office trades wider and carries the downtown vacancy rate. */
export function assumptionsFor(classCode: string, submarket: string): Assumption {
  const a = BY_CLASS[classCode];
  if ((classCode === "464" || classCode === "465") && submarket === "CBD") {
    return { ...a, capRate: 9.75, vacancy: 29.2, basis: "Rochester CBD office vacancy 29.2% (C&W / Pyramid, Q2 2026)" };
  }
  return a;
}

export const DEBT_DEFAULTS = { ltv: 65, rate: 6.75, amortYears: 25, holdYears: 5, exitCapSpreadBps: 50, sellingCostPct: 2.0, closingCostPct: 1.5 };

export const MARKET = {
  office: { asOf: "Q2 2026", vacancy: 19.9, cbd: 29.2, suburban: 15.3, askingRent: 17.5, classA: 21.0, absorptionYtdSf: 139501, source: "Cushman & Wakefield / Pyramid Brokerage" },
  industrial: { asOf: "Q2 2026", vacancy: 7.2, priorVacancy: 6.7, askingRent: 6.8, warehouseRent: 7.25, warehouse: 5.6, manufacturing: 8.0, flex: 9.5, source: "Cushman & Wakefield / Pyramid Brokerage" },
  retail: { asOf: "YE 2025", vacancy: 6.3, inventorySf: 21.4e6, source: "CBRE" },
  multifamily: { asOf: "2025", vacancy: 6.6, priorVacancy: 4.9, medianRent: 1330, rentGrowth: 0.5, avgRentSep2026: 1536, avgRentGrowth: 2.9, source: "Realtor.com via Rochester Business Journal; RentCafe Sep 2026" },
};

export const SOURCES = [
  { label: "NYS ORPTS — Property Assessment Data from Local Assessment Rolls (2024 & 2025 rolls)", url: "https://data.ny.gov/Government-Finance/Property-Assessment-Data-from-Local-Assessment-Rol/7vem-aaz7" },
  { label: "Cushman & Wakefield — Rochester MarketBeats (Q2 2026 office & industrial)", url: "https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/rochester-marketbeats" },
  { label: "TenantBase — Rochester market report, Q3 2026 (compiles C&W/Pyramid, CBRE, RentCafe)", url: "https://www.tenantbase.com/rochester/q3-2026/" },
  { label: "Rochester Business Journal — Rochester apartment market balanced in 2025 (Feb 2026)", url: "https://rbj.net/2026/02/17/rochester-apartment-market-balanced-2025/" },
  { label: "Apartment Loan Store — cap rates by property type (national benchmarks)", url: "https://apartmentloanstore.com/rochester/new-york/cap-rate" },
  { label: "Esri World Imagery — aerial photography", url: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" },
];
