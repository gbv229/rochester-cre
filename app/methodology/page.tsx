import Link from "next/link";
import { properties, BASE } from "../../lib/data";
import { SOURCES } from "../../lib/assumptions";

export const metadata = { title: "Methodology" };

export default function Methodology() {
  const munis = new Set(properties.map((p) => p.municipality)).size;
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 20 }}>
      <h1>Methodology</h1>
      <p className="muted">How the data is collected, what each metric means, and where the model's limits are.</p>

      <div className="grid g2" style={{ marginTop: 24, gap: 28 }}>
        <section>
          <h2>Property universe</h2>
          <p>
            The platform tracks {properties.length} parcels across {munis} Monroe County municipalities: the highest-value parcels in
            each of twelve New York State property classes, from apartments (411) and office buildings (464) to warehouses (449),
            manufacturing (710), shopping centers (452–454), hotels (414), downtown mixed-use (481) and parking garages (437).
          </p>
          <p>
            Every figure comes from the NYS Office of Real Property Tax Services open dataset of local assessment rolls, using the
            2025 and 2024 final rolls. Each property page links straight to its source record, so any number can be checked.
          </p>

          <h2>Coordinates</h2>
          <p>
            Rolls report parcel centroids in state-plane feet, not latitude and longitude, and the reference systems differ by
            assessor: the City of Rochester uses NAD83 New York West (EPSG:2262) and the towns use NAD27 New York West (EPSG:32017).
            The pipeline converts each system to WGS84 with PROJ and checks the results against known landmarks such as Paychex on
            Panorama Trail and Xerox's Webster campus.
          </p>

          <h2>Derived metrics</h2>
          <dl className="kv" style={{ gridTemplateColumns: "minmax(130px, max-content) 1fr", gap: "10px 18px" }}>
            <dt>Market value</dt><dd style={{ fontWeight: 400 }}>The roll's full market value: assessed value divided by the municipality's level of assessment, so values compare across towns.</dd>
            <dt>Land and improvements</dt><dd style={{ fontWeight: 400 }}>Land assessment equalized at the parcel's own ratio; improvements are the remainder.</dd>
            <dt>Improvement share</dt><dd style={{ fontWeight: 400 }}>Improvements as a share of total value. Under 60% flags a land-heavy parcel where redevelopment may be worth more than the building.</dd>
            <dt>YoY change</dt><dd style={{ fontWeight: 400 }}>2025 versus 2024 full market value for the same parcel ID. Class-level figures are value-weighted.</dd>
            <dt>Tax status</dt><dd style={{ fontWeight: 400 }}>County taxable value over total assessment: 98% or more is fully taxable, 1% or less is exempt or under a PILOT.</dd>
            <dt>Owner type</dt><dd style={{ fontWeight: 400 }}>Classified from the owner-of-record name by rule (for example COMIDA, LLC/LP, Inc, government, university or hospital). It's an inference and can misread holding entities.</dd>
            <dt>Submarket</dt><dd style={{ fontWeight: 400 }}>CBD is within a mile of the Four Corners; other city parcels are City of Rochester. Towns are grouped Southeast, South, West, North and East, following broker submarket conventions.</dd>
          </dl>
        </section>

        <section>
          <h2>Underwriting model</h2>
          <p>
            Each property has an annual levered discounted cash flow laid out like an ARGUS Enterprise cash flow report: potential
            gross income, vacancy and credit loss, effective gross income, operating expenses, NOI, debt service and cash flow
            before tax, with a reversion at exit priced on the following year's NOI.
          </p>
          <p>
            Income drives value, as in ARGUS: potential gross income less vacancy less operating expenses gives NOI, so a vacancy or
            expense shock flows straight through to returns. Assessment rolls don't publish rent rolls, so the defaults treat full
            market value as the purchase price, take stabilized NOI as that value times a market cap rate, and back out gross income
            and dollar expenses from the property type's vacancy and expense ratio. The outputs are levered and unlevered IRR, equity
            multiple, cash-on-cash, DSCR, debt yield, breakeven occupancy, and a price-by-exit-cap IRR sensitivity grid. Vacancy
            defaults are Rochester-specific broker figures; see <Link href="/market/">Market</Link>.
          </p>
          <p>
            Every property's model downloads as an Excel workbook built with live formulas and named inputs. It was verified by
            recalculating test workbooks in a spreadsheet engine and matching every output to the site's model.
          </p>

          <h2>Property taxes</h2>
          <p>
            Each parcel's tax estimate applies the latest published full-value rates for its county, town and school district (NYS
            Office of the State Comptroller). City of Rochester parcels use the city's higher non-homestead rates, which is what
            commercial property pays. Estimates exclude special districts (fire, sewer, library) and village taxes, so actual town
            bills run higher. For PILOT and exempt parcels, the model's tax step-up input adds the gap between full and current
            taxes from a chosen year, which turns exemption risk into a dollar and IRR figure.
          </p>

          <h2>Limitations</h2>
          <ul>
            <li>Full market value is the assessor's estimate. It can lag transactions, and it's often negotiated for PILOT properties.</li>
            <li>Income is implied from value, not observed. A property with a real rent roll should be underwritten from that.</li>
            <li>The state classifies by property code, so specialized assets such as student housing get generic apartment assumptions. The case study shows how to adjust.</li>
            <li>Tax estimates use the latest published rates and exclude special districts; PILOT payment schedules aren't public in the roll.</li>
            <li>Some large campuses span several parcels, so a single parcel may understate a whole facility.</li>
            <li>Lot size is only computed where the roll reports both frontage and depth; irregular lots show as not reported.</li>
            <li>Aerial imagery is centered on the roll's parcel centroid, which can sit off the building on large or irregular lots.</li>
          </ul>

          <h2>Build</h2>
          <p>
            A Python pipeline (pyproj) cleans the roll extracts and writes a JSON dataset. The site is a statically exported
            Next.js and TypeScript app with Leaflet maps, deployed to GitHub Pages by GitHub Actions. Screening and
            underwriting run in the browser. The AI analyst calls Google's Gemini API through a small Cloudflare Worker that
            holds the API key, accepts requests only from this site and answers only from this dataset. Economic series come
            from FRED.
          </p>
          <p><a href={`${BASE}/data/properties.csv`}>Download the full dataset (CSV)</a></p>

          <h2>Sources</h2>
          <ul>
            {SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
