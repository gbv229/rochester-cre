"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Property } from "../lib/data";
import { CATEGORY_COLOR, usdShort, BASE } from "../lib/data";

type Props = {
  points: Property[];
  focusId?: string;
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
  fitToPoints?: boolean;
};

function Fit({ points }: { points: Property[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = points.filter((p) => p.lat != null).map((p) => [p.lat!, p.lon!] as [number, number]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
    else if (pts.length === 1) map.setView(pts[0], 15);
  }, [points, map]);
  return null;
}

// Marker area scales with market value so the biggest assets read first.
const radius = (v: number) => Math.max(4, Math.min(22, Math.sqrt(v / 1e6) * 2.2));

export default function LeafletMap({ points, focusId, center = [43.14, -77.6], zoom = 10, scrollWheelZoom = false, fitToPoints }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} maxZoom={18} scrollWheelZoom={scrollWheelZoom} style={{ height: "100%", width: "100%" }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Streets">
          <LayerGroup>
            <TileLayer
              attribution="Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Aerial">
          <TileLayer
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {fitToPoints && <Fit points={points} />}
      {points
        .filter((p) => p.lat != null && p.lon != null)
        .map((p) => {
          const focus = p.id === focusId;
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat!, p.lon!]}
              radius={focus ? 12 : radius(p.marketValue)}
              pathOptions={{
                color: focus ? "#17212e" : "#ffffff",
                weight: focus ? 3 : 1,
                fillColor: CATEGORY_COLOR[p.category],
                fillOpacity: focus ? 1 : 0.78,
              }}
            >
              <Popup>
                <a href={`${BASE}/properties/${p.id}/`}>{p.address}</a>
                <br />
                {p.subtype}, {p.municipality}
                <br />
                {usdShort(p.marketValue)} market value
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
