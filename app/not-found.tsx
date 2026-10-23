import Link from "next/link";
export default function NotFound() {
  return (
    <div className="wrap section">
      <h1>That page isn't in the county records</h1>
      <p className="muted">The link may point to a parcel that's no longer tracked. Search for it in the screener instead.</p>
      <Link className="btn primary" href="/properties/">Open the screener</Link>
    </div>
  );
}
