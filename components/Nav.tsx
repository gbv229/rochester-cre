"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/properties/", label: "Screener" },
  { href: "/map/", label: "Map" },
  { href: "/market/", label: "Market" },
  { href: "/analyst/", label: "AI analyst" },
  { href: "/methodology/", label: "Methodology" },
];

export default function Nav() {
  const path = usePathname() || "/";
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h.replace(/\/$/, "")));
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="RochesterCRE home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="1" y="1" width="24" height="24" rx="3" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path d="M1 15 L9 11 L15 16 L25 9" fill="none" stroke="#b9a3dc" strokeWidth="1.8" />
            <path d="M9 1 V25 M17 1 V25" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
          </svg>
          <span>RochesterCRE</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
