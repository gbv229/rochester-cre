/**
 * Annual discounted-cash-flow model, structured like an ARGUS Enterprise
 * cash flow: potential gross income -> vacancy -> EGI -> opex -> NOI ->
 * debt service -> cash flow before tax, with a reversion in the exit year.
 *
 * The assessment roll does not publish rent rolls, so year-1 NOI defaults to
 * the assessor's market value times a market cap rate. NOI and purchase price
 * are separate inputs, so price can be negotiated against a fixed income stream;
 * NOI is grossed up through the vacancy and expense assumptions.
 */

export type Inputs = {
  price: number;
  noi: number;            // year-1 net operating income, $
  vacancy: number;        // %
  opexRatio: number;      // % of EGI in year 1
  incomeGrowth: number;   // %
  expenseGrowth: number;  // %
  ltv: number;            // %
  rate: number;           // %
  amortYears: number;
  holdYears: number;
  exitCap: number;        // %
  sellingCostPct: number; // %
  closingCostPct: number; // %
};

export type Year = {
  year: number; pgi: number; vacancyLoss: number; egi: number; opex: number; noi: number;
  debtService: number; cfbt: number; reversion: number; loanBalance: number; dscr: number;
};

export type Result = {
  years: Year[];
  loan: number;
  equity: number;
  annualDebtService: number;
  goingInNoi: number;
  goingInCap: number;
  dscrY1: number;
  debtYield: number;
  cashOnCashY1: number;
  leveredIrr: number | null;
  unleveredIrr: number | null;
  equityMultiple: number;
  exitValue: number;
  netSaleProceeds: number;
  breakevenOccupancy: number;
};

export function payment(principal: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12, n = years * 12;
  if (principal <= 0) return 0;
  if (r === 0) return (principal / n) * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n)) * 12;
}

export function balance(principal: number, ratePct: number, years: number, afterYears: number) {
  const r = ratePct / 100 / 12, n = years * 12, k = afterYears * 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal * (1 - k / n);
  const pmt = (principal * r) / (1 - Math.pow(1 + r, -n));
  return principal * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r);
}

/** IRR by bisection on NPV; robust for conventional cash flows. */
export function irr(flows: number[]): number | null {
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 1.5;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-6) return mid * 100;
    if (fLo * fm < 0) { hi = mid; fHi = fm; } else { lo = mid; fLo = fm; }
  }
  return ((lo + hi) / 2) * 100;
}

export function run(i: Inputs): Result {
  const goingInNoi = i.noi;
  const egi1 = goingInNoi / (1 - i.opexRatio / 100);
  const pgi1 = egi1 / (1 - i.vacancy / 100);
  const opex1 = egi1 - goingInNoi;

  const loan = i.price * (i.ltv / 100);
  const closing = i.price * (i.closingCostPct / 100);
  const equity = i.price - loan + closing;
  const ads = payment(loan, i.rate, i.amortYears);

  const years: Year[] = [];
  // Model hold + 1 so the exit is priced on forward (year N+1) NOI, as ARGUS does.
  for (let y = 1; y <= i.holdYears + 1; y++) {
    const pgi = pgi1 * Math.pow(1 + i.incomeGrowth / 100, y - 1);
    const vacancyLoss = pgi * (i.vacancy / 100);
    const egi = pgi - vacancyLoss;
    const opex = opex1 * Math.pow(1 + i.expenseGrowth / 100, y - 1);
    const noi = egi - opex;
    years.push({
      year: y, pgi, vacancyLoss, egi, opex, noi,
      debtService: ads, cfbt: noi - ads, reversion: 0,
      loanBalance: balance(loan, i.rate, i.amortYears, y),
      dscr: ads ? noi / ads : Infinity,
    });
  }

  const forwardNoi = years[i.holdYears].noi;
  const exitValue = forwardNoi / (i.exitCap / 100);
  const sellingCosts = exitValue * (i.sellingCostPct / 100);
  const payoff = years[i.holdYears - 1].loanBalance;
  const netSaleProceeds = exitValue - sellingCosts - payoff;
  const hold = years.slice(0, i.holdYears);
  hold[hold.length - 1].reversion = netSaleProceeds;

  const levered = [-equity, ...hold.map((y) => y.cfbt + y.reversion)];
  const unlevered = [-(i.price + closing), ...hold.map((y, k) => y.noi + (k === hold.length - 1 ? exitValue - sellingCosts : 0))];
  const totalIn = levered.slice(1).reduce((a, b) => a + b, 0);

  const pgi = hold[0].pgi;
  const breakevenOccupancy = ((hold[0].opex + ads) / pgi) * 100;

  return {
    years: hold,
    loan, equity, annualDebtService: ads, goingInNoi, goingInCap: (goingInNoi / i.price) * 100,
    dscrY1: ads ? hold[0].noi / ads : Infinity,
    debtYield: loan ? (hold[0].noi / loan) * 100 : Infinity,
    cashOnCashY1: (hold[0].cfbt / equity) * 100,
    leveredIrr: irr(levered),
    unleveredIrr: irr(unlevered),
    equityMultiple: totalIn / equity,
    exitValue, netSaleProceeds, breakevenOccupancy,
  };
}
