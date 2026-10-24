"""
RochesterCRE data pipeline.

Source: NYS Office of Real Property Tax Services, "Property Assessment Data from
Local Assessment Rolls" (data.ny.gov dataset 7vem-aaz7), Monroe County,
2025 and 2024 final rolls.

Steps
  1. Parse raw roll extracts (pipe-delimited).
  2. Convert state-plane grid coordinates to WGS84. The City of Rochester
     reports NAD83 NY West (US ft, EPSG:2262); the towns report NAD27 NY West
     (EPSG:32017).
  3. Derive analytics: land/improvement split, assessment YoY, tax status,
     lot size, submarket, distance to CBD, owner type, screening flags.
  4. Write data/properties.json (site) and public/data/properties.csv (download).
"""
from __future__ import annotations

import csv
import json
import math
import re
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(__file__).resolve().parent / "raw"

CITY = Transformer.from_crs(2262, 4326, always_xy=True)
TOWN = Transformer.from_crs(32017, 4326, always_xy=True)
FOUR_CORNERS = (43.15565, -77.61133)  # Main St & Exchange/State, downtown Rochester

# NYS ORPTS property class codes -> platform taxonomy
CLASSES = {
    "411": ("Multifamily", "Apartments"),
    "464": ("Office", "Office building"),
    "465": ("Office", "Professional / medical office"),
    "449": ("Industrial", "Warehouse / distribution"),
    "710": ("Industrial", "Manufacturing"),
    "714": ("Industrial", "Light industrial / flex"),
    "452": ("Retail", "Neighborhood shopping center"),
    "453": ("Retail", "Large retail / big box"),
    "454": ("Retail", "Grocery-anchored / supermarket"),
    "414": ("Hospitality", "Hotel"),
    "481": ("Mixed-use", "Downtown row / mixed-use"),
    "437": ("Parking", "Parking garage"),
}

SUBMARKETS = {
    "Brighton": "Southeast", "Pittsford": "Southeast", "Perinton": "Southeast",
    "Penfield": "Southeast", "East Rochester": "Southeast",
    "Henrietta": "South", "Rush": "South",
    "Gates": "West", "Chili": "West", "Ogden": "West", "Sweden": "West", "Riga": "West",
    "Greece": "North", "Irondequoit": "North",
    "Webster": "East",
}

SUFFIX = {"Rd": "Rd", "St": "St", "Ave": "Ave", "Blvd": "Blvd", "Dr": "Dr", "Ln": "Ln",
          "Pl": "Pl", "Trl": "Trl", "Pkwy": "Pkwy", "Hwy": "Hwy", "Cir": "Cir", "Run": "Run",
          "Way": "Way", "Xing": "Xing"}


def num(v: str) -> float | None:
    v = (v or "").strip()
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def haversine_mi(a, b) -> float:
    r = 3958.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def owner_type(name: str) -> str:
    n = name.lower()
    if "comida" in n:
        return "IDA lease (COMIDA)"
    if re.search(r"\b(city of|county of|town/village|town of|village of|urban renewal|reg mkt auth)\b", n):
        return "Government"
    if re.search(r"universit|college|hospital|housing dev|hsg dev|foundation|senior|community|grhs|rochester general|nurses", n):
        return "Institutional / non-profit"
    if re.search(r"\b(llc|l\.l\.c|lp|l\.p\.|llp)\b|,llc|\bllc\.", n) or "llc" in n:
        return "Private LLC / LP"
    if re.search(r"\b(inc|corp|corporation|company|co\.?)\b", n):
        return "Corporate"
    return "Private / other"


def slug(print_key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", print_key.lower()).strip("-")


# City of Rochester 2024-25 NON-HOMESTEAD rates per $1,000 of assessed value (cityofrochester.gov/tax-rates).
# Commercial parcels in the city pay these, not the blended full-value rate. County combined includes Pure Waters.
CITY_NONHOMESTEAD = {"county": 8.450048, "municipal": 9.040, "school": 15.710}


def load_tax_rates() -> dict[tuple[str, str], dict[str, float]]:
    out = {}
    for line in (RAW / "tax_rates_fy2025.psv").read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        muni, school, c, m, sch = line.split("|")
        out[(muni, school)] = {"county": float(c), "municipal": float(m), "school": float(sch)}
    return out


def load_2024() -> dict[str, float]:
    out = {}
    for line in (RAW / "fmv_2024.psv").read_text().splitlines():
        if "|" in line:
            k, v = line.split("|")
            out[k.strip()] = float(v)
    return out


def load_office_taxable() -> dict[str, float]:
    out = {}
    for line in (RAW / "office_taxable_2025.psv").read_text().splitlines():
        if "|" in line:
            k, v = line.split("|")
            out[k.strip()] = float(v)
    return out


def main() -> None:
    prior = load_2024()
    office_tax = load_office_taxable()
    rates = load_tax_rates()
    seen: set[str] = set()
    props = []

    for line in (RAW / "assessment_2025.psv").read_text().splitlines():
        f = line.split("|")
        if len(f) != 16:
            raise SystemExit(f"bad row ({len(f)} fields): {line}")
        (pk, muni, cls, hnum, street, suff, fmv, land_av, total_av, taxable,
         front, depth, ge, gn, owner, school) = [x.strip() for x in f]
        if pk in seen:
            continue
        seen.add(pk)

        fmv_v, land_v, tot_v = num(fmv), num(land_av), num(total_av)
        tax_v = num(taxable)
        if tax_v is None and pk in office_tax:
            tax_v = office_tax[pk]

        # Equalize land to full market value using the parcel's own ratio
        eq = (fmv_v / tot_v) if tot_v else 1.0
        land_fmv = (land_v or 0) * eq
        impr_fmv = max(fmv_v - land_fmv, 0)

        # Coordinates
        e, n = num(ge), num(gn)
        lat = lon = None
        if e and n and e > 100000 and n > 900000:
            tr = CITY if muni == "Rochester" else TOWN
            lon, lat = tr.transform(e, n)
            if not (42.9 < lat < 43.4 and -78.1 < lon < -77.3):
                lat = lon = None

        cat, sub = CLASSES[cls]
        address = " ".join(x for x in [hnum, street, SUFFIX.get(suff, suff)] if x)
        address = address.replace("Jefferson Road", "Jefferson Rd")
        if not hnum:
            address = f"{street} {SUFFIX.get(suff, suff)}".strip() + " (parcel)"

        fr, dp = num(front) or 0, num(depth) or 0
        lot_acres = round(fr * dp / 43560, 2) if fr > 0 and dp > 0 else None

        p24 = prior.get(pk)
        yoy = round((fmv_v / p24 - 1) * 100, 2) if p24 else None

        if tax_v is None:
            tax_status, taxable_pct = "Unknown", None
        else:
            taxable_pct = round(tax_v / tot_v * 100, 1) if tot_v else 0
            tax_status = ("Fully taxable" if taxable_pct >= 98
                          else "Fully exempt / PILOT" if taxable_pct <= 1
                          else "Partially exempt")

        if muni == "Rochester":
            dist = haversine_mi((lat, lon), FOUR_CORNERS) if lat else None
            submarket = "CBD" if dist is not None and dist <= 1.0 else "City of Rochester"
        else:
            submarket = SUBMARKETS.get(muni, "Other")
        dist = round(haversine_mi((lat, lon), FOUR_CORNERS), 2) if lat else None

        # Estimated property tax if the parcel were fully taxable.
        if muni == "Rochester":
            r = CITY_NONHOMESTEAD
            tax_base, tax_basis = tot_v, "City of Rochester non-homestead rates on assessed value, 2024-25"
        else:
            r = rates.get((muni, school))
            tax_base, tax_basis = fmv_v, f"{muni} / {school} school district full-value rates, FY2025"
        if r is None:
            raise SystemExit(f"no tax rate for {muni} / {school}")
        rate_total = r["county"] + r["municipal"] + r["school"]
        est_tax_full = tax_base * rate_total / 1000
        est_tax_current = est_tax_full * (taxable_pct / 100) if taxable_pct is not None else None
        eff_rate = est_tax_full / fmv_v * 100
        tax_prior = (p24 * eff_rate / 100) if p24 else None

        impr_ratio = round(impr_fmv / fmv_v * 100, 1) if fmv_v else None
        flags = []
        if impr_ratio is not None and impr_ratio < 60:
            flags.append("Land-heavy (redevelopment angle)")
        if yoy is not None and yoy <= -5:
            flags.append("Assessment down 5%+ YoY")
        if yoy is not None and yoy >= 10:
            flags.append("Assessment up 10%+ YoY")
        if tax_status == "Fully exempt / PILOT" and "comida" in owner.lower():
            flags.append("IDA PILOT structure")
        if lot_acres and lot_acres >= 10:
            flags.append("10+ acre site")

        props.append({
            "id": slug(pk),
            "printKey": pk,
            "address": address,
            "municipality": muni,
            "city": "Rochester" if muni == "Rochester" else muni,
            "schoolDistrict": school,
            "submarket": submarket,
            "classCode": cls,
            "category": cat,
            "subtype": sub,
            "owner": re.sub(r"\s+", " ", owner),
            "ownerType": owner_type(owner),
            "marketValue": round(fmv_v),
            "marketValue2024": round(p24) if p24 else None,
            "yoyPct": yoy,
            "landValue": round(land_fmv),
            "improvementValue": round(impr_fmv),
            "improvementRatio": impr_ratio,
            "assessedTotal": round(tot_v) if tot_v else None,
            "equalizationRatio": round(1 / eq * 100, 2) if eq else None,
            "countyTaxable": round(tax_v) if tax_v is not None else None,
            "taxablePct": taxable_pct,
            "taxStatus": tax_status,
            "frontageFt": fr or None,
            "depthFt": dp or None,
            "lotAcres": lot_acres,
            "valuePerAcre": round(fmv_v / lot_acres) if lot_acres else None,
            "lat": round(lat, 6) if lat else None,
            "lon": round(lon, 6) if lon else None,
            "distanceToCbdMi": dist,
            "taxRates": {k: round(v, 4) for k, v in r.items()},
            "taxRateTotal": round(rate_total, 4),
            "taxBasis": tax_basis,
            "effectiveTaxRate": round(eff_rate, 3),
            "estTaxFull": round(est_tax_full),
            "estTaxCurrent": round(est_tax_current) if est_tax_current is not None else None,
            "estTaxPrior": round(tax_prior) if tax_prior else None,
            "flags": flags,
        })

    props.sort(key=lambda p: -p["marketValue"])
    for i, p in enumerate(props, 1):
        p["rank"] = i

    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "properties.json").write_text(json.dumps(props, indent=1))
    (ROOT / "public" / "data").mkdir(parents=True, exist_ok=True)
    cols = [k for k in props[0] if k not in ("flags", "taxRates")] + ["flags"]
    with open(ROOT / "public" / "data" / "properties.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for p in props:
            w.writerow({**{k: v for k, v in p.items() if k != "taxRates"}, "flags": "; ".join(p["flags"])})

    missing = [p["printKey"] for p in props if p["lat"] is None]
    total = sum(p["marketValue"] for p in props)
    print(f"{len(props)} properties, ${total/1e9:.2f}B market value, {len(missing)} without coords: {missing}")
    by = {}
    for p in props:
        by[p["category"]] = by.get(p["category"], 0) + 1
    print(by)
    print("with YoY:", sum(1 for p in props if p["yoyPct"] is not None))


if __name__ == "__main__":
    main()
