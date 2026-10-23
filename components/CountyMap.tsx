"use client";
import dynamic from "next/dynamic";

// Leaflet touches `window`, so it loads only in the browser.
const CountyMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", background: "#e9edf0" }} />,
});
export default CountyMap;
