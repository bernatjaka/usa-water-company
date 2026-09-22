/*
  WATER DATA, one entry per market.

  ┌────────────────────────────────────────────────────────────────────┐
  │ THE "level" FIGURES BELOW ARE SAMPLE VALUES, FOR LAYOUT ONLY.      │
  │ Replace every one with the real number from the EWG Tap Water      │
  │ Database for the utility serving that metro before this goes in    │
  │ front of customers. Everything else in here is already correct.    │
  └────────────────────────────────────────────────────────────────────┘

  level      what the utility actually measured. PER UTILITY. Needs filling in.
  guideline  EWG Health Guideline. Published and stable, already correct.
  legal      federal legal limit. Published and stable, already correct.

  "times over" is always computed from level / guideline, never typed by hand,
  so the headline number can never drift from the figures beneath it.
*/
var WATER_DATA = {
  phoenix: {
    utility: 'City of Phoenix Water Services',
    source: 'EWG Tap Water Database',
    contaminants: [
      { name: 'Arsenic',                 level: 1.2,   guideline: 0.004, legal: 0.010, unit: 'ppb' },
      { name: 'Total trihalomethanes',   level: 18.0,  guideline: 0.15,  legal: 80,    unit: 'ppb' },
      { name: 'Haloacetic acids (HAA5)', level: 12.0,  guideline: 0.10,  legal: 60,    unit: 'ppb' },
      { name: 'Chromium (hexavalent)',   level: 0.09,  guideline: 0.02,  legal: null,  unit: 'ppb' },
      { name: 'Nitrate',                 level: 1.10,  guideline: 0.14,  legal: 10,    unit: 'ppm' },
      { name: 'Radium',                  level: 0.35,  guideline: 0.05,  legal: 5,     unit: 'pCi/L' }
    ]
  },
  'south-florida': {
    utility: 'Miami-Dade Water and Sewer Department',
    source: 'EWG Tap Water Database',
    contaminants: [
      { name: 'Total trihalomethanes',   level: 30.0,  guideline: 0.15,  legal: 80,    unit: 'ppb' },
      { name: 'Haloacetic acids (HAA5)', level: 14.0,  guideline: 0.10,  legal: 60,    unit: 'ppb' },
      { name: 'Chromium (hexavalent)',   level: 0.08,  guideline: 0.02,  legal: null,  unit: 'ppb' },
      { name: 'Radium',                  level: 0.30,  guideline: 0.05,  legal: 5,     unit: 'pCi/L' },
      { name: 'Arsenic',                 level: 0.80,  guideline: 0.004, legal: 0.010, unit: 'ppb' },
      { name: 'Nitrate',                 level: 0.90,  guideline: 0.14,  legal: 10,    unit: 'ppm' }
    ]
  },
  orlando: {
    utility: 'Orlando Utilities Commission',
    source: 'EWG Tap Water Database',
    contaminants: [
      { name: 'Total trihalomethanes',   level: 22.0,  guideline: 0.15,  legal: 80,    unit: 'ppb' },
      { name: 'Haloacetic acids (HAA5)', level: 11.0,  guideline: 0.10,  legal: 60,    unit: 'ppb' },
      { name: 'Radium',                  level: 0.42,  guideline: 0.05,  legal: 5,     unit: 'pCi/L' },
      { name: 'Arsenic',                 level: 0.60,  guideline: 0.004, legal: 0.010, unit: 'ppb' },
      { name: 'Chromium (hexavalent)',   level: 0.05,  guideline: 0.02,  legal: null,  unit: 'ppb' },
      { name: 'Nitrate',                 level: 0.70,  guideline: 0.14,  legal: 10,    unit: 'ppm' }
    ]
  }
};

/* How many results are shown before the rest is held back. */
var WATER_FREE_COUNT = 2;

function timesOver(c) {
  if (!c.guideline || !c.level) return 0;
  return c.level / c.guideline;
}
