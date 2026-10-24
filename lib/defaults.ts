import type { Inputs } from "./model";
import type { Property } from "./data";
import { assumptionsFor, DEBT_DEFAULTS } from "./assumptions";

/**
 * Market-default underwriting inputs for a parcel. With no rent roll, stabilized NOI is
 * market value x the market cap rate; that NOI is grossed up through the class's expense
 * ratio and vacancy to a potential gross income, and expenses are fixed in dollars.
 */
export function defaultInputs(p: Property): Inputs {
  const a = assumptionsFor(p.classCode, p.submarket);
  const noi = p.marketValue * (a.capRate / 100);
  const egi = noi / (1 - a.opexRatio / 100);
  const pgi = egi / (1 - a.vacancy / 100);
  return {
    price: p.marketValue,
    pgi: Math.round(pgi),
    vacancy: a.vacancy,
    opex: Math.round(egi - noi),
    incomeGrowth: a.incomeGrowth,
    expenseGrowth: a.expenseGrowth,
    ltv: DEBT_DEFAULTS.ltv,
    rate: DEBT_DEFAULTS.rate,
    amortYears: DEBT_DEFAULTS.amortYears,
    holdYears: DEBT_DEFAULTS.holdYears,
    exitCap: a.capRate + DEBT_DEFAULTS.exitCapSpreadBps / 100,
    sellingCostPct: DEBT_DEFAULTS.sellingCostPct,
    closingCostPct: DEBT_DEFAULTS.closingCostPct,
    taxStepUp: p.taxStatus === "Fully taxable" ? 0 : Math.max(0, p.estTaxFull - (p.estTaxCurrent ?? 0)),
    taxStepUpYear: 0,
  };
}
