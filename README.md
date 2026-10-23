# RochesterCRE

**Live site: https://gbv229.github.io/rochester-cre/**

A commercial real estate research and underwriting platform for Rochester and Monroe County, New York. It tracks the
222 highest-value commercial parcels in the county, covering $3.7 billion of assessed market value, across multifamily,
office, industrial, retail, hospitality, mixed-use and parking. Users can screen them, map them, and run a levered
cash flow model on any one of them.

## What it does

- **Screener.** Filter by asset class, property type, submarket, municipality, value, tax status, owner type,
  assessment trend, distance to downtown and screening flags. Sort any column, switch between table, card and map
  views, and export the current screen to CSV.
- **Property pages (222).** Each one has an aerial photo, a location map with the nearest comparables, a land and
  improvement value split, the 2024 to 2025 assessment change, tax and PILOT status, owner of record, site data, and
  peer benchmarks within its asset class.
- **Underwriting model.** An annual levered DCF laid out like an ARGUS Enterprise cash flow (PGI, vacancy, EGI, opex,
  NOI, debt service, CFBT, reversion). Outputs are levered and unlevered IRR, equity multiple, cash-on-cash, DSCR,
  debt yield and breakeven occupancy, plus an IRR sensitivity grid of purchase price against exit cap. Every
  assumption can be edited.
- **Market page.** Rochester office, industrial, retail and multifamily fundamentals from broker reports, set beside
  the assessment-roll trend for the tracked parcels.

## Data

| Source | Use |
|---|---|
| NYS ORPTS, *Property Assessment Data from Local Assessment Rolls* (data.ny.gov `7vem-aaz7`), Monroe County 2024 and 2025 final rolls | Parcel IDs, addresses, owners, full market value, land and total assessment, taxable value, lot dimensions, coordinates |
| Cushman & Wakefield / Pyramid Brokerage Rochester MarketBeats, Q2 2026 | Office and industrial vacancy and rents |
| CBRE, YE 2025 | Retail vacancy |
| Realtor.com via the Rochester Business Journal; RentCafe | Apartment vacancy and rents |
| Esri World Imagery | Aerial photography |

Every property page links to its raw source record so any figure can be checked.

## How it's built

```
pipeline/build_data.py   Python: parse roll extracts, convert state-plane coordinates
                         (EPSG:2262 city / EPSG:32017 towns) to WGS84 with pyproj, derive metrics
data/properties.json     Clean dataset consumed by the site
lib/model.ts             DCF engine: amortization, loan balance, IRR (bisection), DSCR, reversion
lib/assumptions.ts       Market assumptions by NYS property class, with sources
app/                     Next.js 15 (App Router, TypeScript), statically exported
components/              Leaflet maps, aerial imagery, charts
.github/workflows/       GitHub Actions build and deploy to GitHub Pages
```

There is no backend. Pages are pre-rendered at build time, and screening and underwriting run in the browser.

```bash
pip install -r pipeline/requirements.txt
npm install
npm run data     # rebuild data/properties.json from pipeline/raw
npm run dev      # http://localhost:3000
```

## Limitations

Full market value is the assessor's estimate, not a transaction price. Assessment rolls don't publish rent rolls, so
year 1 NOI is implied from value and a market cap rate. The model is for stress-testing, not appraisal. See the
Methodology page for the full list.

---

Built by Gage Van Quekelberg, Lehigh University, Finance major and Real Estate minor.
