#!/usr/bin/env python3
"""
Put a latitude and longitude on every row of the new homeowner lists.

    python3 tools/new-homeowners.py      # build the lists first
    python3 tools/add-coordinates.py     # then this

Adds Latitude and Longitude columns to new-homeowners-30/60/90.csv so the
viewer can plot them on a map.

WHY NOT A GEOCODER
    Geocoding 8,500 addresses through Mapbox or Google costs money, needs an
    API key, and guesses where a street number falls along a block. The county
    already publishes the exact point of every parcel, keyed by the same APN
    that is in our lists, so this is a lookup rather than an estimate. Free,
    no key, and it is the county's own answer for where the house is.

    Dataset: Parcel Points, 1.76 million parcels, refreshed weekly.
    https://www.mcassessor.maricopa.gov/page/data_sales/

WHAT THIS HAS TO DO
    The shapefile stores coordinates in State Plane Arizona Central FIPS 0202,
    in international feet, not in latitude and longitude. The inverse
    Transverse Mercator below converts them, using the exact parameters out of
    the file's own .prj. Checked against the dataset extent: it returns
    32.69..34.04 N and -113.33..-111.08 W, which is Maricopa County.

    No third party library is used or needed. The .shp and .dbf formats are
    both simple enough to read directly, which keeps this runnable on any Mac
    with Python and nothing installed.
"""

import csv, math, os, struct, ssl, sys, urllib.request, zipfile

ITEM_ID = 'dbf139379db946e1b10a2f15672c142d'          # Assessor "Parcel Points"
SOURCE = 'https://www.arcgis.com/sharing/rest/content/items/%s/data' % ITEM_ID

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
WINDOWS = (30, 60, 90)

# ---- NAD83(HARN) / State Plane Arizona Central FIPS 0202, International Feet
# Straight out of ParcelPoints.prj.
A = 6378137.0                       # GRS 1980 semi-major axis
INV_F = 298.257222101
K0 = 0.9999
LON0 = math.radians(-111.91666666666667)
LAT0 = math.radians(31.0)
FALSE_EASTING_FT = 700000.0
FT_TO_M = 0.3048                    # international foot, exactly

_f = 1 / INV_F
E2 = 2 * _f - _f * _f
EP2 = E2 / (1 - E2)
E1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
FE = FALSE_EASTING_FT * FT_TO_M


def _meridian_arc(phi):
    return A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi
                - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * math.sin(2 * phi)
                + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * math.sin(4 * phi)
                - (35 * E2 ** 3 / 3072) * math.sin(6 * phi))


M0 = _meridian_arc(LAT0)


def to_latlon(x_ft, y_ft):
    """State Plane feet -> (latitude, longitude) in degrees."""
    x = x_ft * FT_TO_M - FE
    y = y_ft * FT_TO_M
    mu = (M0 + y / K0) / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
    phi1 = (mu + (3 * E1 / 2 - 27 * E1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * E1 ** 2 / 16 - 55 * E1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * E1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * E1 ** 4 / 512) * math.sin(8 * mu))
    c1 = EP2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = A / math.sqrt(1 - E2 * math.sin(phi1) ** 2)
    r1 = A * (1 - E2) / (1 - E2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d * d / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6 / 720)
    lon = LON0 + (d
                  - (1 + 2 * t1 + c1) * d ** 3 / 6
                  + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5 / 120
                  ) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lon)


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, 'parcel-points.zip')
    if os.path.exists(path) and os.path.getsize(path) > 50_000_000:
        print('Using the parcel file already downloaded (%s MB)'
              % round(os.path.getsize(path) / 1048576))
        return path
    print('Downloading parcel points from the county (about 82 MB, one time)...')
    req = urllib.request.Request(SOURCE, headers={'User-Agent': 'usawaterco-newhomeowners/1.0'})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=900, context=ctx) as r, open(path, 'wb') as fh:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
    print('Downloaded %s MB' % round(os.path.getsize(path) / 1048576))
    return path


def wanted_apns():
    """Every parcel number across the three lists."""
    apns = set()
    for days in WINDOWS:
        p = os.path.join(HERE, 'new-homeowners-%d.csv' % days)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8-sig', newline='') as fh:
            for row in csv.DictReader(fh):
                a = (row.get('Parcel') or '').strip().upper().replace('-', '')
                if a:
                    apns.add(a)
    return apns


def build_index(zip_path, apns):
    """APN -> (lat, lon), reading only the parcels we actually need."""
    with zipfile.ZipFile(zip_path) as z:
        dbf_name = next(n for n in z.namelist() if n.lower().endswith('.dbf'))
        shp_name = next(n for n in z.namelist() if n.lower().endswith('.shp'))

        dbf = z.read(dbf_name)
        n_rec, hlen, rlen = struct.unpack('<IHH', dbf[4:12])

        # locate the APN column inside each fixed width record
        offset, apn_at, apn_len = 1, None, 0      # byte 0 of a record is the delete flag
        for i in range((hlen - 33) // 32):
            fd = dbf[32 + i * 32: 64 + i * 32]
            name = fd[:11].split(b'\0')[0].decode('latin-1')
            size = fd[16]
            if name.upper() == 'APN':
                apn_at, apn_len = offset, size
            offset += size
        if apn_at is None:
            raise SystemExit('No APN column in the parcel file')

        print('Scanning %s parcels for the %s in your lists...'
              % (format(n_rec, ','), format(len(apns), ',')))
        hits = {}
        for i in range(n_rec):
            base = hlen + i * rlen
            raw = dbf[base + apn_at: base + apn_at + apn_len]
            apn = raw.decode('latin-1').strip().upper().replace('-', '')
            if apn in apns and apn not in hits:
                hits[apn] = i

        # PointZ records are a fixed 44 bytes each, so the row index is the offset
        shp = z.read(shp_name)
        shape_type = struct.unpack('<i', shp[32:36])[0]
        if shape_type != 11:
            raise SystemExit('Expected PointZ geometry, found shape type %d' % shape_type)

        out = {}
        for apn, i in hits.items():
            at = 100 + i * 44 + 12          # 8 byte record header + 4 byte shape type
            x, y = struct.unpack('<2d', shp[at: at + 16])
            if x == 0 and y == 0:
                continue
            out[apn] = to_latlon(x, y)
        return out


def main():
    apns = wanted_apns()
    if not apns:
        raise SystemExit('No lists found. Run new-homeowners.py first.')

    index = build_index(fetch(), apns)
    print('Matched %s of %s parcels (%.1f%%)\n'
          % (format(len(index), ','), format(len(apns), ','), 100 * len(index) / len(apns)))

    for days in WINDOWS:
        p = os.path.join(HERE, 'new-homeowners-%d.csv' % days)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8-sig', newline='') as fh:
            rows = list(csv.DictReader(fh))
        cols = [c for c in rows[0].keys() if c not in ('Latitude', 'Longitude')]
        cols += ['Latitude', 'Longitude']
        placed = 0
        for r in rows:
            a = (r.get('Parcel') or '').strip().upper().replace('-', '')
            ll = index.get(a)
            r['Latitude'] = '%.6f' % ll[0] if ll else ''
            r['Longitude'] = '%.6f' % ll[1] if ll else ''
            if ll:
                placed += 1
        with open(p, 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)
        print('  last %2d days  %5s of %5s rows mapped  ->  %s'
              % (days, format(placed, ','), format(len(rows), ','), os.path.basename(p)))


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
