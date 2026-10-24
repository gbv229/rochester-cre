/**
 * Builds a live-formula Excel version of a property's underwriting model.
 * Same function runs in the browser (download button) and in Node (verification),
 * so the file a visitor downloads is the file that was tested.
 *
 * Conventions: Arial; blue = hardcoded inputs, black = formulas, green = links to another sheet.
 * Percentages are stored as fractions. Every assumption has its own named cell.
 */
import type { Inputs } from "./model";
import type { Property } from "./data";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ExcelJSModule = any;

const BLUE = "FF0000FF", BLACK = "FF000000", GREEN = "FF008000", GREY = "FF595959";
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7ECF2" } } as const;
const KEY_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } } as const;
const USD = '$#,##0;($#,##0);"-"';
const PCT = '0.00%;(0.00%);"-"';
const PCT1 = '0.0%;(0.0%);"-"';
const MULT = '0.00"x"';
const YEARS = 11; // up to a 10-year hold plus the forward year used to price the exit

const font = (color = BLACK, extra: Record<string, unknown> = {}) => ({ name: "Arial", size: 10, color: { argb: color }, ...extra });
const colLetter = (n: number) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export async function buildWorkbook(ExcelJS: ExcelJSModule, p: Property, inp: Inputs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RochesterCRE";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  const asm = wb.addWorksheet("Assumptions", { views: [{ showGridLines: false }] });
  const cf = wb.addWorksheet("Cash Flow", { views: [{ showGridLines: false, state: "frozen", xSplit: 1, ySplit: 4 }] });

  /* ---------------- Assumptions ---------------- */
  asm.columns = [{ width: 38 }, { width: 18 }, { width: 70 }];
  asm.getCell("A1").value = "Assumptions";
  asm.getCell("A1").font = font(BLACK, { size: 14, bold: true });
  asm.getCell("A2").value = "Blue cells are inputs. Change them and every sheet recalculates.";
  asm.getCell("A2").font = font(GREY, { italic: true });

  let r = 4;
  const header = (label: string) => {
    const row = asm.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(1).font = font(BLACK, { bold: true });
    [1, 2, 3].forEach((c) => (row.getCell(c).fill = HEAD_FILL));
  };
  const input = (label: string, name: string, value: number, fmt: string, note: string, key = false) => {
    const row = asm.getRow(r++);
    row.getCell(1).value = label; row.getCell(1).font = font();
    const c = row.getCell(2);
    c.value = value; c.numFmt = fmt; c.font = font(BLUE); c.name = name;
    if (key) c.fill = KEY_FILL;
    row.getCell(3).value = note; row.getCell(3).font = font(GREY);
  };
  const calc = (label: string, name: string, formula: string, fmt: string, note = "") => {
    const row = asm.getRow(r++);
    row.getCell(1).value = label; row.getCell(1).font = font();
    const c = row.getCell(2);
    c.value = { formula }; c.numFmt = fmt; c.font = font(); c.name = name;
    if (note) { row.getCell(3).value = note; row.getCell(3).font = font(GREY); }
  };

  header("Acquisition");
  input("Purchase price", "Purchase_Price", inp.price, USD, "Default: assessor's 2025 full market value (NYS ORPTS roll)", true);
  input("Closing costs (% of price)", "Closing_Cost", inp.closingCostPct / 100, PCT, "Model assumption");
  header("Operations");
  input("Year 1 potential gross income", "PGI_Y1", inp.pgi, USD, "Default: market value x market cap rate, grossed up through vacancy and the class expense ratio. Replace with a rent roll when known", true);
  input("Vacancy & credit loss (% of PGI)", "Vacancy_Rate", inp.vacancy / 100, PCT, "Rochester broker data by property type; see the site's Market page");
  input("Year 1 operating expenses", "Opex_Y1", inp.opex, USD, "Default: class expense ratio x EGI; includes current real estate taxes", true);
  input("Income growth (annual)", "Income_Growth", inp.incomeGrowth / 100, PCT, "Model assumption");
  input("Expense growth (annual)", "Expense_Growth", inp.expenseGrowth / 100, PCT, "Model assumption");
  header("Financing");
  input("Loan-to-value", "Loan_LTV", inp.ltv / 100, PCT, "Model assumption");
  input("Interest rate", "Interest_Rate", inp.rate / 100, PCT, "Model assumption; fixed, monthly amortization");
  input("Amortization (years)", "Amort_Years", inp.amortYears, "0", "Model assumption");
  header("Exit");
  input("Hold period (years, 1 to 10)", "Hold_Years", inp.holdYears, "0", "Exit is priced on the following year's NOI", true);
  input("Exit cap rate", "Exit_Cap", inp.exitCap / 100, PCT, "Default: going-in market cap + 50 bps", true);
  input("Selling costs (% of exit value)", "Selling_Cost", inp.sellingCostPct / 100, PCT, "Model assumption");
  header("Property tax step-up");
  input("Added property tax ($/yr, year-1 dollars)", "Tax_StepUp", inp.taxStepUp || 0, USD, "For PILOT or exempt parcels: estimated tax at full assessment minus current taxable share");
  input("First year it applies (0 = never)", "Tax_StepUp_Year", inp.taxStepUpYear || 0, "0", "Set to the year the PILOT or exemption ends");
  header("Derived (formulas)");
  calc("Year 1 effective gross income", "EGI_Y1", "PGI_Y1*(1-Vacancy_Rate)", USD);
  calc("Year 1 net operating income", "Year1_NOI", "EGI_Y1-Opex_Y1", USD, "Before any property tax step-up");
  calc("Going-in cap rate", "Going_In_Cap", "IF(Purchase_Price=0,0,Year1_NOI/Purchase_Price)", PCT);
  calc("Expense ratio (% of EGI)", "Expense_Ratio", "IF(EGI_Y1=0,0,Opex_Y1/EGI_Y1)", PCT);
  calc("Loan amount", "Loan_Amount", "Purchase_Price*Loan_LTV", USD);
  calc("Closing costs ($)", "Closing_Costs", "Purchase_Price*Closing_Cost", USD);
  calc("Sponsor equity", "Equity_Required", "Purchase_Price-Loan_Amount+Closing_Costs", USD);
  calc("Annual debt service", "Debt_Service", "IF(Loan_Amount=0,0,IF(Interest_Rate=0,Loan_Amount/Amort_Years,PMT(Interest_Rate/12,Amort_Years*12,-Loan_Amount)*12))", USD, "Monthly payment x 12");

  /* ---------------- Cash Flow ---------------- */
  const first = 2; // column B = year 0
  const lastCol = first + YEARS; // year 11
  cf.getColumn(1).width = 34;
  for (let c = first; c <= lastCol; c++) cf.getColumn(c).width = 14;
  cf.getCell("A1").value = `Annual cash flow: ${p.address}, ${p.municipality}`;
  cf.getCell("A1").font = font(BLACK, { size: 14, bold: true });
  cf.getCell("A2").value = "Columns after the hold period are zero in the return rows. Year 11 exists so a 10-year hold can price its exit on forward NOI.";
  cf.getCell("A2").font = font(GREY, { italic: true });

  const row3 = cf.getRow(3), row4 = cf.getRow(4);
  row3.getCell(1).value = "Line item"; row4.getCell(1).value = "Year number";
  for (let y = 0; y <= YEARS; y++) {
    const c = first + y;
    row3.getCell(c).value = `Year ${y}`;
    row4.getCell(c).value = y; row4.getCell(c).numFmt = "0";
  }
  [row3, row4].forEach((row) => { for (let c = 1; c <= lastCol; c++) { row.getCell(c).font = font(BLACK, { bold: row === row3 }); row.getCell(c).fill = HEAD_FILL; row.getCell(c).alignment = { horizontal: c === 1 ? "left" : "right" }; } });

  const lines: { label: string; f: (col: string, next: string) => string; y0?: string; fmt?: string; bold?: boolean; topBorder?: boolean }[] = [
    { label: "In hold period (1 = yes)", f: (c) => `IF(AND(${c}$4>=1,${c}$4<=Hold_Years),1,0)`, fmt: "0" },
    { label: "Potential gross income", f: (c) => `PGI_Y1*(1+Income_Growth)^(${c}$4-1)` },
    { label: "Vacancy & credit loss", f: (c) => `-${c}6*Vacancy_Rate` },
    { label: "Effective gross income", f: (c) => `${c}6+${c}7`, bold: true },
    { label: "Operating expenses", f: (c) => `-Opex_Y1*(1+Expense_Growth)^(${c}$4-1)` },
    { label: "Property tax step-up", f: (c) => `-IF(AND(Tax_StepUp_Year>0,${c}$4>=Tax_StepUp_Year),Tax_StepUp*(1+Expense_Growth)^(${c}$4-1),0)` },
    { label: "Net operating income", f: (c) => `${c}8+${c}9+${c}10`, bold: true, topBorder: true },
    { label: "Debt service", f: (c) => `-Debt_Service*${c}5` },
    { label: "Cash flow before tax", f: (c) => `${c}11*${c}5+${c}12`, bold: true },
    { label: "Loan balance, end of year", f: (c) => `IF(${c}5=1,IF(Interest_Rate=0,Loan_Amount*(1-${c}$4/Amort_Years),Loan_Amount*(1+Interest_Rate/12)^(${c}$4*12)-Debt_Service/12*((1+Interest_Rate/12)^(${c}$4*12)-1)/(Interest_Rate/12)),0)` },
    { label: "Exit value (forward NOI / exit cap)", f: (c, n) => `IF(${c}$4=Hold_Years,${n}11/Exit_Cap,0)` },
    { label: "Selling costs", f: (c) => `-${c}15*Selling_Cost` },
    { label: "Loan payoff", f: (c) => `-IF(${c}$4=Hold_Years,${c}14,0)` },
    { label: "Net sale proceeds", f: (c) => `${c}15+${c}16+${c}17`, bold: true },
    { label: "Total levered cash flow", f: (c) => `${c}13+${c}18`, y0: "-Equity_Required", bold: true, topBorder: true },
    { label: "Total unlevered cash flow", f: (c) => `${c}11*${c}5+${c}15+${c}16`, y0: "-(Purchase_Price+Closing_Costs)", bold: true },
    { label: "Debt service coverage (DSCR)", f: (c) => `IF(AND(${c}5=1,Debt_Service>0),${c}11/Debt_Service,"")`, fmt: MULT },
  ];
  lines.forEach((ln, i) => {
    const rowNum = 5 + i;
    const row = cf.getRow(rowNum);
    row.getCell(1).value = ln.label;
    row.getCell(1).font = font(BLACK, { bold: !!ln.bold });
    for (let y = 0; y <= YEARS; y++) {
      const c = first + y, col = colLetter(c), next = colLetter(c + 1);
      const cell = row.getCell(c);
      if (y === 0) {
        if (ln.y0) cell.value = { formula: ln.y0 };
      } else if (y === YEARS && ln.label.startsWith("Exit value")) {
        cell.value = 0; // a 10-year hold is the maximum, so year 11 never exits
      } else {
        cell.value = { formula: ln.f(col, next) };
      }
      cell.numFmt = ln.fmt || USD;
      cell.font = font(BLACK, { bold: !!ln.bold });
      if (ln.topBorder) cell.border = { top: { style: "thin", color: { argb: BLACK } } };
    }
    if (ln.topBorder) row.getCell(1).border = { top: { style: "thin", color: { argb: BLACK } } };
  });
  const range = (rowNum: number) => `'Cash Flow'!$${colLetter(first)}$${rowNum}:$${colLetter(lastCol)}$${rowNum}`;

  /* ---------------- Summary ---------------- */
  summary.columns = [{ width: 40 }, { width: 34 }, { width: 70 }];
  summary.getCell("A1").value = `${p.address}, ${p.municipality}, NY`;
  summary.getCell("A1").font = font(BLACK, { size: 14, bold: true });
  summary.getCell("A2").value = `RochesterCRE underwriting model, exported ${new Date().toISOString().slice(0, 10)}. Blue = input, black = formula, green = link to another sheet.`;
  summary.getCell("A2").font = font(GREY, { italic: true });

  let s = 4;
  const sHead = (label: string) => { const row = summary.getRow(s++); row.getCell(1).value = label; row.getCell(1).font = font(BLACK, { bold: true }); [1, 2, 3].forEach((c) => (row.getCell(c).fill = HEAD_FILL)); };
  const sFact = (label: string, value: string | number | null, fmt?: string, note = "") => {
    const row = summary.getRow(s++);
    row.getCell(1).value = label; row.getCell(1).font = font();
    row.getCell(2).value = value ?? "n/a"; row.getCell(2).font = font(typeof value === "number" ? BLUE : BLACK);
    if (fmt) row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: typeof value === "number" ? "right" : "left" };
    if (note) { row.getCell(3).value = note; row.getCell(3).font = font(GREY); }
  };
  const sCalc = (label: string, formula: string, fmt: string, link = false, note = "") => {
    const row = summary.getRow(s++);
    row.getCell(1).value = label; row.getCell(1).font = font();
    row.getCell(2).value = { formula }; row.getCell(2).numFmt = fmt; row.getCell(2).font = font(link ? GREEN : BLACK, { bold: true });
    if (note) { row.getCell(3).value = note; row.getCell(3).font = font(GREY); }
  };

  sHead("Property (NYS assessment roll, 2025 final)");
  sFact("Parcel ID (print key)", p.printKey);
  sFact("Property type", `${p.subtype} (NYS class ${p.classCode})`);
  sFact("Submarket", p.submarket);
  sFact("Owner of record", p.owner);
  sFact("2025 full market value", p.marketValue, USD, "Assessor's equalized estimate, not a sale price");
  sFact("2024 full market value", p.marketValue2024, USD);
  sFact("Tax status", p.taxStatus, undefined, `County taxable value is ${p.taxablePct ?? "n/a"}% of assessment`);
  sFact("Combined tax rate (per $1,000)", p.taxRateTotal, "0.00", p.taxBasis);
  sFact("Est. annual tax at full assessment", p.estTaxFull, USD, "County + town/city + school levies; excludes special districts and village taxes");

  sHead("Returns");
  sCalc("Levered IRR", `IFERROR(IRR(${range(19)},0.1),IFERROR(IRR(${range(19)},-0.2),IRR(${range(19)},-0.5)))`, PCT, true, "Retries from lower starting guesses so deeply negative returns still solve");
  sCalc("Unlevered IRR", `IFERROR(IRR(${range(20)},0.1),IFERROR(IRR(${range(20)},-0.2),IRR(${range(20)},-0.5)))`, PCT, true);
  sCalc("Equity multiple", `SUM('Cash Flow'!$C$19:$${colLetter(lastCol)}$19)/Equity_Required`, MULT);
  sCalc("Cash-on-cash, year 1", `'Cash Flow'!$C$13/Equity_Required`, PCT);
  sCalc("DSCR, year 1", `IF(Debt_Service=0,"",'Cash Flow'!$C$11/Debt_Service)`, MULT, false, "Lenders typically require 1.25x or more");
  sCalc("Debt yield, year 1", `IF(Loan_Amount=0,"",'Cash Flow'!$C$11/Loan_Amount)`, PCT);
  sCalc("Breakeven occupancy", `(-'Cash Flow'!$C$9-'Cash Flow'!$C$10+Debt_Service)/'Cash Flow'!$C$6`, PCT1, false, "Share of potential income needed to cover expenses and debt service");
  sCalc("Going-in cap rate", "Going_In_Cap", PCT, true);
  sCalc("Exit value", `SUM('Cash Flow'!$C$15:$${colLetter(lastCol)}$15)`, USD, true);
  sCalc("Net sale proceeds", `SUM('Cash Flow'!$C$18:$${colLetter(lastCol)}$18)`, USD, true);

  sHead("Notes");
  [
    "Income is implied: assessment rolls don't publish rent rolls, so default income and expenses are backed out of market value at a market cap rate.",
    "For a sensitivity table, select the Levered IRR cell and use Data > What-If Analysis > Data Table with Purchase_Price and Exit_Cap.",
    "Source data: NYS ORPTS assessment rolls (data.ny.gov 7vem-aaz7); tax rates from NYS OSC (data.ny.gov iq85-sdzs) and the City of Rochester.",
    "Modeled estimate for research and education, not an appraisal or offer. Site: gbv229.github.io/rochester-cre",
  ].forEach((t) => { const row = summary.getRow(s++); row.getCell(1).value = t; row.getCell(1).font = font(GREY); summary.mergeCells(`A${s - 1}:C${s - 1}`); row.getCell(1).alignment = { wrapText: true, vertical: "top" }; row.height = 26; });

  [summary, asm, cf].forEach((ws: any) => { ws.pageSetup = { orientation: ws === cf ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; });
  return wb;
}

/** Browser entry point: build the workbook and trigger a download. */
export async function downloadModel(p: Property, inp: Inputs) {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = await buildWorkbook(ExcelJS, p, inp);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `RochesterCRE_${p.address.replace(/[^A-Za-z0-9]+/g, "_")}_${p.municipality}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
