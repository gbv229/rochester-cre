import CountyMap from "../../components/CountyMap";
import { properties, CATEGORIES, CATEGORY_COLOR } from "../../lib/data";

export const metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div>
      <div className="wrap" style={{ padding: "20px 24px 12px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1>Map</h1>
          <p className="muted small" style={{ margin: 0 }}>Every tracked parcel, sized by market value. Switch to aerial imagery from the layer control; click a marker to open the property.</p>
        </div>
        <div className="legend">
          {CATEGORIES.map((c) => <span key={c}><i className="dot" style={{ background: CATEGORY_COLOR[c] }} />{c}</span>)}
        </div>
      </div>
      <div style={{ height: "calc(100vh - 150px)", minHeight: 480, borderTop: "1px solid var(--rule)" }}>
        <CountyMap points={properties} scrollWheelZoom />
      </div>
    </div>
  );
}
