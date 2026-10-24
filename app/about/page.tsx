import Link from "next/link";
import { properties, usdShort } from "../../lib/data";

export const metadata = { title: "About", description: "Who built RochesterCRE and why." };

export default function About() {
  const total = properties.reduce((s, p) => s + p.marketValue, 0);
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 20 }}>
      <div className="split">
        <div>
          <h1>About</h1>
          <p>
            I'm Gage Van Quekelberg, a finance major with a real estate minor through the Goodman Center for Real Estate at Lehigh
            University, class of 2029. I grew up outside Rochester and built RochesterCRE to study my home market the way an
            acquisitions analyst would: start from public records, screen for what stands out, then underwrite it.
          </p>
          <p>
            The platform tracks {properties.length} of Monroe County's most valuable commercial parcels, {usdShort(total)} of assessed value,
            and pairs them with Rochester market data, a cash flow model laid out like ARGUS Enterprise, property tax estimates, and an AI
            analyst that answers from the dataset. Every figure links back to a public source.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0 28px" }}>
            <a className="btn primary" href="https://www.linkedin.com/in/gagevanquekelberg" target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="btn" href="https://github.com/gbv229/rochester-cre" target="_blank" rel="noreferrer">Source code on GitHub</a>
            <Link className="btn" href="/case-study/">Read the case study</Link>
          </div>

          <h2>What I'd point you to</h2>
          <ul style={{ paddingLeft: "1.1rem" }}>
            <li><Link href="/case-study/">The Province case study</Link>: an investment memo on student housing at RIT, from implied bed count to price.</li>
            <li><Link href="/properties/">The screener</Link>: filter by asset class, tax status, assessment trend and more, then open any property's model.</li>
            <li><Link href="/market/">Market analysis</Link>: the Rochester economy, cap-rate spreads to Treasuries, ownership and tax burden.</li>
            <li><Link href="/methodology/">Methodology</Link>: how the data was built, and where the model's limits are.</li>
          </ul>
        </div>

        <aside className="panel">
          <h2>Background</h2>
          <dl className="kv" style={{ gridTemplateColumns: "1fr", gap: "4px 0" }}>
            <dt>Education</dt>
            <dd style={{ marginBottom: 10 }}>Lehigh University, BS Business and Economics. Finance major, Real Estate minor (Goodman Center for Real Estate), class of 2029</dd>
            <dt>Certifications</dt>
            <dd style={{ marginBottom: 10 }}>ARGUS Enterprise certified; Bloomberg Market Concepts</dd>
            <dt>Investing</dt>
            <dd style={{ marginBottom: 10 }}>Analyst, Lehigh Investment Management Group (student-run portfolio)</dd>
            <dt>Built with</dt>
            <dd>Python (pyproj) data pipeline; Next.js and TypeScript; Leaflet maps; ExcelJS for the live-formula export; Google Gemini via a Cloudflare Worker; GitHub Actions and Pages</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
