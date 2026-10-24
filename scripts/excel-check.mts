/** Writes test workbooks and the site model's expected outputs, for recalculation + comparison. */
import ExcelJS from "exceljs";
import fs from "node:fs";
import { buildWorkbook } from "../lib/excel";
import { run, type Inputs } from "../lib/model";
import { byId } from "../lib/data";
import { defaultInputs } from "../lib/defaults";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const cases: { id: string; tweak: Partial<Inputs> }[] = [
  { id: "161-01-1-25-11", tweak: {} },                                        // 220 John St defaults
  { id: "161-01-1-33", tweak: { taxStepUpYear: 3 } },                         // 380 John St, PILOT ends year 3
  { id: "121-31-1-15-002", tweak: { holdYears: 10, ltv: 50, rate: 7.25 } },   // CBD office, 10-yr hold
  { id: "134-08-1-85", tweak: { holdYears: 3, price: 22e6, exitCap: 8.5, vacancy: 12 } },   // industrial, short hold
];
const expected: Record<string, unknown> = {};
for (const [i, c] of cases.entries()) {
  const p = byId(c.id)!;
  const base: Inputs = defaultInputs(p);
  const inp = { ...base, ...c.tweak };
  const r = run(inp);
  const wb = await buildWorkbook(ExcelJS, p, inp);
  await wb.xlsx.writeFile(`${out}/case${i}.xlsx`);
  expected[`case${i}`] = { address: p.address, leveredIrr: r.leveredIrr, unleveredIrr: r.unleveredIrr, equityMultiple: r.equityMultiple,
    cashOnCash: r.cashOnCashY1, dscr: r.dscrY1, debtYield: r.debtYield, breakeven: r.breakevenOccupancy, exitValue: r.exitValue,
    netSale: r.netSaleProceeds, noiY1: r.goingInNoi, ads: r.annualDebtService };
}
fs.writeFileSync(`${out}/expected.json`, JSON.stringify(expected, null, 1));
console.log("wrote", Object.keys(expected).length, "cases");
