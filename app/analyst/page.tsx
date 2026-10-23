import Analyst from "../../components/Analyst";
import { properties } from "../../lib/data";

export const metadata = { title: "AI analyst" };

const SUGGESTIONS = [
  "Which five apartment properties had the biggest assessment increases, and why might that be?",
  "Compare CBD and suburban office risk using the vacancy data.",
  "Which industrial parcels look land-heavy enough to be redevelopment candidates?",
  "How much tracked value sits under PILOT agreements, and who holds it?",
  "What does the cap rate spread to the 10-year Treasury say about pricing right now?",
  "Rank the submarkets by median assessment growth.",
];

export default function AnalystPage() {
  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <h1>AI analyst</h1>
      <p className="muted">
        A research assistant that has read all {properties.length} property records, the Rochester market data and the
        underwriting assumptions. Ask it to screen, compare, explain or run the numbers.
      </p>
      <Analyst suggestions={SUGGESTIONS} />
    </div>
  );
}
