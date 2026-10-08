#!/usr/bin/env python3
"""
New homeowners in Maricopa County, straight from the county's own records.

    python3 tools/new-homeowners.py

Writes new-homeowners-30.csv, -60.csv and -90.csv next to itself. Nobody has to
open a website, log in, or fill out a records request.

WHERE THE DATA COMES FROM
    Maricopa County Assessor publishes a free "Sales Affidavits" bulk file,
    built from the deeds recorded with the County Recorder. It carries the
    parcel, the deed date, the sale price, the property address, and the name
    and mailing address of the buyer. It is refreshed weekly.

    Assessor's page:  https://www.mcassessor.maricopa.gov/page/data_sales/
    The file itself:  hosted on the county's ArcGIS open data portal, ID below.

    No key, no account, no fee. Just a 60 MB download.

WHAT COUNTS AS A NEW HOMEOWNER
    Of ~900,000 rows, only a small slice is a family that just moved into a
    house. The filters below are what separate them, and each one is there for
    a reason that was checked against the real data rather than assumed:

      deed date in range   also throws out corrupt rows; the raw file contains
                           deed dates as far out as 2099
      property type B or C single family, condo and townhouse. Drops vacant
                           land, commercial, apartment blocks, mobile homes
      deed type WD or SD   warranty and special warranty deeds, the ordinary
                           way a house is sold. Drops quit claims, which are
                           usually divorces and transfers between relatives
      occupancy flag A     the county's owner-occupied marker. Measured against
                           the data: 47.8% of flag A buyers give the property
                           itself as their mailing address, against 2.9% for
                           flag B and 4.9% for flag C. A is the one that means
                           somebody actually lives there
      not an institution   strips LPs, LLCs, REITs and bulk landlords. One
                           buyer in the last 90 days took three houses on the
                           same day at the same price

    Family trusts are kept. Plenty of ordinary owners hold their home in one.

RECORDING LAG, READ THIS BEFORE TRUSTING THE 30 DAY FILE
    A sale reaches this file only once the deed is recorded and keyed, which
    takes weeks. The last 30 days will always look far thinner than a third of
    the last 90, because the most recent weeks are still filling in. The 60 and
    90 day files are the honest ones. The script prints the gap each run.
"""

import csv, datetime, io, os, re, ssl, sys, urllib.request, zipfile

ITEM_ID = 'f3484c72a938497286adc4e5de7e9963'          # Assessor "Sales Affidavits"
SOURCE = 'https://www.arcgis.com/sharing/rest/content/items/%s/data' % ITEM_ID
INFO = 'https://www.arcgis.com/sharing/rest/content/items/%s?f=json' % ITEM_ID

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
WINDOWS = (30, 60, 90)

RESIDENTIAL = {'B', 'C'}                  # single family, condo/townhouse
SALE_DEEDS = {'WD', 'SD'}                 # warranty, special warranty
OWNER_OCCUPIED = 'A'

# Buyers that are companies rather than people. Trust is deliberately absent.
INSTITUTIONAL = re.compile(
    r'\b(LLC|L\.L\.C|LP|L\.P|LLP|INC|CORP|CORPORATION|COMPANY|CO|HOLDINGS?|'
    r'PARTNERS?|PARTNERSHIP|CAPITAL|FUND|REIT|BORROWER|PROPERTIES|'
    r'INVESTMENTS?|VENTURES?|GROUP|HOMES|BUILDERS?|CONSTRUCTION|DEVELOPMENT|'
    r'BANK|MORTGAGE|LENDING|ASSOCIATION|ENTERPRISES?)\b')

# Leave as None for the whole county, or list the zip prefixes you serve.
ZIP_PREFIXES = None        # e.g. ['850', '851', '852', '853']


def tidy(v):
    return re.sub(r'\s+', ' ', (v or '').strip())


def titlecase(v):
    """SMITH JOHN A/MARY -> Smith John A/Mary.

    The county separates co-owners with a slash and writes everything in caps,
    so the slash has to be treated as a word break or the second owner comes
    out lowercase."""
    def word(w):
        return w if (len(w) <= 3 and w.isupper() and not w.isalpha()) else w.capitalize()
    parts = []
    for chunk in re.split(r'(/|&)', tidy(v)):
        parts.append(chunk if chunk in ('/', '&') else ' '.join(word(w) for w in chunk.split(' ')))
    return ''.join(parts)


def fetch():
    """Download the county file, reusing today's copy if it is already here."""
    os.makedirs(CACHE, exist_ok=True)
    stamp = datetime.date.today().strftime('%Y%m%d')
    path = os.path.join(CACHE, 'sales-affidavits-%s.zip' % stamp)
    if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
        print('Using the copy already downloaded today (%s MB)'
              % round(os.path.getsize(path) / 1048576))
        return path

    for old in os.listdir(CACHE):                     # keep only the newest
        if old.startswith('sales-affidavits-'):
            os.remove(os.path.join(CACHE, old))

    ctx = ssl.create_default_context()
    try:
        import json
        with urllib.request.urlopen(INFO, timeout=60, context=ctx) as r:
            meta = json.load(r)
        when = datetime.datetime.fromtimestamp(meta['modified'] / 1000)
        print('County file last updated %s' % when.strftime('%d %B %Y'))
    except Exception:
        pass

    print('Downloading from the county (about 60 MB)...')
    req = urllib.request.Request(SOURCE, headers={'User-Agent': 'usawaterco-newhomeowners/1.0'})
    with urllib.request.urlopen(req, timeout=600, context=ctx) as r, open(path, 'wb') as fh:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
    print('Downloaded %s MB' % round(os.path.getsize(path) / 1048576))
    return path


def rows(path):
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.txt'))
        with z.open(name) as raw:
            text = io.TextIOWrapper(raw, encoding='utf-8', errors='replace', newline='')
            for row in csv.DictReader(text, delimiter='|'):
                yield row


def main():
    path = fetch()
    today = datetime.date.today()
    oldest = today - datetime.timedelta(days=max(WINDOWS))

    kept, seen = [], set()
    total = dropped_date = dropped_type = dropped_deed = dropped_occ = dropped_inst = 0

    for row in rows(path):
        total += 1
        raw_date = tidy(row.get('DEEDDATE_MMDDYYYY'))
        if len(raw_date) != 8:
            dropped_date += 1
            continue
        try:
            sold = datetime.datetime.strptime(raw_date, '%m%d%Y').date()
        except ValueError:
            dropped_date += 1
            continue
        if not (oldest <= sold <= today):
            dropped_date += 1
            continue
        if tidy(row.get('PROPERTYTYPECODE')).upper() not in RESIDENTIAL:
            dropped_type += 1
            continue
        if tidy(row.get('DEEDTYPE')).upper() not in SALE_DEEDS:
            dropped_deed += 1
            continue
        if tidy(row.get('OWNEROCCUPANCYINDICATOR')).upper() != OWNER_OCCUPIED:
            dropped_occ += 1
            continue

        buyer = tidy(row.get('GRANTEEOWNERNAME')).upper()
        if INSTITUTIONAL.search(buyer):
            dropped_inst += 1
            continue

        situs = tidy(row.get('SITUSADDRESS'))
        zipc = tidy(row.get('SITUSZIP'))[:5]
        if not situs or not zipc:
            continue
        if ZIP_PREFIXES and zipc[:3] not in ZIP_PREFIXES:
            continue

        key = (tidy(row.get('PARCELNUMBER')).upper(), sold)
        if key in seen:                       # multi parcel sales repeat the row
            continue
        seen.add(key)

        price = tidy(row.get('SALEPRICE'))
        kept.append({
            'Sale date': sold.isoformat(),
            'Days ago': (today - sold).days,
            'Owner': titlecase(row.get('GRANTEEOWNERNAME')),
            'Property address': titlecase(situs),
            'Suite': tidy(row.get('SITUSSUITE')),
            'City': titlecase(row.get('SITUSCITY')),
            'Zip': zipc,
            'Sale price': ('$%s' % format(int(price), ',')) if price.isdigit() else '',
            'Mailing address': titlecase(row.get('GRANTEEADDRESSLINE1')),
            'Mailing city': titlecase(row.get('GRANTEECITY')),
            'Mailing state': tidy(row.get('GRANTEESTATE')),
            'Mailing zip': tidy(row.get('GRANTEEZIP'))[:5],
            'Moved in': 'Yes' if tidy(row.get('GRANTEEADDRESSLINE1')).upper() == situs.upper() else '',
            'Parcel': tidy(row.get('PARCELNUMBER')),
        })

    kept.sort(key=lambda r: r['Sale date'], reverse=True)
    cols = list(kept[0].keys()) if kept else []

    print('\nRead %s rows from the county file.' % format(total, ','))
    print('  outside the date window or unusable date   %s' % format(dropped_date, ','))
    print('  not a house, condo or townhouse            %s' % format(dropped_type, ','))
    print('  not a warranty deed sale                   %s' % format(dropped_deed, ','))
    print('  not flagged owner occupied                 %s' % format(dropped_occ, ','))
    print('  bought by a company rather than a person   %s' % format(dropped_inst, ','))

    print('\nNew homeowners')
    prev = 0
    for days in WINDOWS:
        sub = [r for r in kept if r['Days ago'] <= days]
        out = os.path.join(HERE, 'new-homeowners-%d.csv' % days)
        with open(out, 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(sub)
        print('  last %2d days  %6s  ->  %s' % (days, format(len(sub), ','), os.path.basename(out)))
        prev = len(sub)

    thirty = len([r for r in kept if r['Days ago'] <= 30])
    ninety = len(kept)
    if ninety and thirty < ninety / 4.5:
        print('\nNote: the last 30 days looks thin next to the last 90. That is the')
        print('recording lag, not a quiet month. A deed takes weeks to reach this')
        print('file, so the 60 and 90 day lists are the ones to work from.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
