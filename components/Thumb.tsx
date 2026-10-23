"use client";
import { useState } from "react";
import { aerialUrl } from "../lib/data";

/** Aerial snapshot with graceful fallback if imagery is unavailable. */
export default function Thumb({ lat, lon, alt, w = 520, h = 325, span = 0.0026 }: { lat: number | null; lon: number | null; alt: string; w?: number; h?: number; span?: number }) {
  const [failed, setFailed] = useState(false);
  if (lat == null || lon == null || failed)
    return <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13 }}>No imagery</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={aerialUrl(lat, lon, w, h, span)} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
