# New homeowner lists, Maricopa County

```
python3 tools/new-homeowners.py
```

That is the whole process. It downloads the county file, filters it, and writes
`new-homeowners-30.csv`, `-60.csv` and `-90.csv` into this folder. Open them in
Excel or Numbers. Takes about two minutes, most of it the download.

Nobody needs an account, a login, a records request, or a paid data broker.

## Where the data comes from

Maricopa County Assessor publishes a free **Sales Affidavits** bulk file, built
from the deeds recorded with the County Recorder. It carries the parcel, the
deed date, the sale price, the property address, and the buyer's name and
mailing address. Refreshed weekly.

Assessor's own page: <https://www.mcassessor.maricopa.gov/page/data_sales/>

## Doing it by hand instead

1. Go to <https://www.mcassessor.maricopa.gov/page/data_sales/>
2. Under **Data Files**, find **Sales Affidavits** and click its download link
3. Unzip it. Inside is `Sales_Affidavits.txt`, a pipe delimited file of about
   900,000 rows and 256 MB
4. Open it in Excel: Data, From Text/CSV, set the delimiter to `|`.
   Excel caps out at 1,048,576 rows so it will just fit
5. Filter it down:
   - `DEEDDATE_MMDDYYYY` inside the date range you want
   - `PROPERTYTYPECODE` is `B` or `C`
   - `DEEDTYPE` is `WD` or `SD`
   - `OWNEROCCUPANCYINDICATOR` is `A`
   - delete rows where `GRANTEEOWNERNAME` contains LLC, LP, Inc, Corp,
     Properties, Homes, Capital, Fund, Borrower
6. Keep the columns you need: `GRANTEEOWNERNAME`, `SITUSADDRESS`, `SITUSCITY`,
   `SITUSZIP`, `DEEDDATE_MMDDYYYY`, `SALEPRICE`

The script does the same thing in two minutes and gets the date maths right
every time, which step 5 does not if you are dragging a filter by hand.

## What the filters mean

| Filter | Why |
|---|---|
| Date in range | Also drops corrupt rows. The raw file contains deed dates as far ahead as 2099 |
| Property type `B` or `C` | Single family, condo and townhouse. Drops vacant land, commercial, apartment blocks, mobile homes |
| Deed type `WD` or `SD` | Warranty and special warranty deeds, the normal way a house is sold. Drops quit claims, which are mostly divorces and transfers between relatives |
| Occupancy flag `A` | The county's owner-occupied marker. Checked against the data: 47.8% of flag `A` buyers give the property itself as their mailing address, against 2.9% for `B` and 4.9% for `C`. `A` is the one that means somebody lives there |
| Not a company | Strips LPs, LLCs, REITs and bulk landlords. One buyer in the last 90 days took three houses on the same day at the same price |

Family trusts are kept on purpose. Plenty of ordinary owners hold their home in
one, and dropping them would lose real customers.

## Read this before using the 30 day list

A sale only reaches this file once the deed is recorded and keyed, which takes
weeks. The last 30 days will always look far thinner than a third of the last
90 because the recent weeks are still filling in. **The 60 and 90 day lists are
the honest ones.** The script prints a warning when the gap shows up.

## Narrowing to your service area

Open the script and set `ZIP_PREFIXES` near the top:

```python
ZIP_PREFIXES = ['850', '851', '852', '853']   # Phoenix metro only
```

Leave it as `None` for the whole county.

## Before you contact anyone

These are public records and direct mail to them is ordinary practice. Phone
calls are not the same thing: cold calling a number you have appended from
another source runs into the National Do Not Call Registry and Arizona's own
rules. If the plan is to call rather than mail, check with Craig first.

## The lists are not committed

This repo is published at usawatercompany.com. The CSVs and the downloaded
county file are both in `.gitignore`, so a list of 8,500 names and home
addresses never ends up on the public internet. Keep it that way.
