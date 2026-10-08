#!/usr/bin/env python3
"""Turn the generated CSVs into one compact JSON file for the web viewer.

Rows go out as arrays rather than objects: the column names are repeated 8,500
times otherwise, which roughly triples the file for no benefit.
"""
import collections, csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
COLS = ['Sale date', 'Owner', 'Property address', 'City', 'Zip', 'Sale price', 'Moved in', 'Parcel']

src = os.path.join(HERE, 'new-homeowners-90.csv')
rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
data = [[r[c] for c in COLS] for r in rows]

prices = sorted(int(r['Sale price'].replace('$', '').replace(',', ''))
                for r in rows if r['Sale price'])
cities = collections.Counter(r['City'] for r in rows)

summary = {
    'total': len(rows),
    'cities': len(cities),
    'movedIn': sum(1 for r in rows if r['Moved in'] == 'Yes'),
    'medianPrice': prices[len(prices) // 2] if prices else 0,
    'from': min(r['Sale date'] for r in rows),
    'to': max(r['Sale date'] for r in rows),
    'topCities': cities.most_common(12),
}

out = os.path.join(HERE, 'viewer-data.json')
blob = json.dumps({'cols': COLS, 'rows': data, 'summary': summary}, separators=(',', ':'))
open(out, 'w', encoding='utf-8').write(blob)

print('rows        %s' % format(len(data), ','))
print('size        %.2f MB' % (len(blob.encode()) / 1048576))
print('cities      %d' % len(cities))
print('span        %s -> %s' % (summary['from'], summary['to']))
print('median      $%s' % format(summary['medianPrice'], ','))
print('moved in    %s' % format(summary['movedIn'], ','))
print('written     %s' % out)
