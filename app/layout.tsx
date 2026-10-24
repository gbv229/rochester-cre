import type { Metadata } from "next";
import "./globals.css";
import Nav from "../components/Nav";

export const metadata: Metadata = {
  title: { default: "RochesterCRE — Monroe County commercial real estate", template: "%s · RochesterCRE" },
  description:
    "Screen, map and underwrite 222 of Monroe County's most valuable commercial properties using NYS assessment-roll data and Rochester market fundamentals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="footer">
          <div className="wrap">
            <nav className="footer-links" aria-label="Footer">
              <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/methodology/`}>Methodology</a>
              <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/about/`}>About</a>
              <a href="https://www.linkedin.com/in/gagevanquekelberg" target="_blank" rel="noreferrer">LinkedIn</a>
              <a href="https://github.com/gbv229/rochester-cre" target="_blank" rel="noreferrer">GitHub</a>
            </nav>
            Built by Gage Van Quekelberg. Property data: NYS Office of Real Property Tax Services, Monroe County 2024 and 2025
            final assessment rolls. Underwriting outputs are modeled estimates, not appraisals or offers. Aerial imagery © Esri,
            Maxar, Earthstar Geographics. Basemap © Esri, HERE, Garmin, OpenStreetMap contributors.
          </div>
        </footer>
      </body>
    </html>
  );
}
