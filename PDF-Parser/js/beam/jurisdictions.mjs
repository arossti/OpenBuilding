// jurisdictions.mjs
// Country / province lookup tables + assembly-row jurisdiction inference and
// matching. Used by the PROJECT tab dropdowns and by every assembly tab that
// filters its picker by location (Concrete EPDs being the primary case).
//
// Data model — values stored in StateManager are the human-readable label
// strings (e.g. "Canada", "British Columbia"). Internal compares are
// case-insensitive against label OR 2-letter code, so a sample JSON saying
// "Vermont" or "VT" both work; "British Columbia" or "BC" both work.

export const COUNTRIES = [
  { value: "Canada", label: "Canada" },
  { value: "United States", label: "United States" }
];

// Order roughly matches population — most-likely picks first.
export const CA_PROVINCES = [
  { value: "Ontario", code: "ON" },
  { value: "Quebec", code: "QC" },
  { value: "British Columbia", code: "BC" },
  { value: "Alberta", code: "AB" },
  { value: "Manitoba", code: "MB" },
  { value: "Saskatchewan", code: "SK" },
  { value: "Nova Scotia", code: "NS" },
  { value: "New Brunswick", code: "NB" },
  { value: "Newfoundland and Labrador", code: "NL" },
  { value: "Prince Edward Island", code: "PE" },
  { value: "Northwest Territories", code: "NT" },
  { value: "Yukon", code: "YT" },
  { value: "Nunavut", code: "NU" }
];

// US states — recorded for project metadata only. EPD filter does not act
// on US state because BEAM workbook concrete EPDs are not state-tagged.
export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming"
].map((v) => ({ value: v }));

export function provinceOptions(country) {
  if (country === "Canada") return CA_PROVINCES;
  if (country === "United States") return US_STATES;
  return [];
}

// Map CA province label OR 2-letter code -> canonical label.
const PROVINCE_LABEL = (() => {
  const m = new Map();
  for (const p of CA_PROVINCES) {
    m.set(p.value.toLowerCase(), p.value);
    m.set(p.code.toLowerCase(), p.value);
  }
  return m;
})();

export function normalizeProvince(input) {
  if (!input) return null;
  return PROVINCE_LABEL.get(String(input).toLowerCase().trim()) || null;
}

// Provider keyword -> array of CA province labels.
// "CA-wide" sentinel = matches every CA province (any CRMCA/NRMCA-style avg).
// Order matters: longest/most-specific keys first so substring matches don't
// short-circuit on a parent.
const CA_PROVIDER_PROVINCES = [
  ["Ontario Concrete RMCAO", ["Ontario"]],
  [
    "Atlantic Concrete Association",
    ["New Brunswick", "Nova Scotia", "Prince Edward Island", "Newfoundland and Labrador"]
  ],
  ["Concrete Alberta", ["Alberta"]],
  ["Concrete Manitoba", ["Manitoba"]],
  ["Concrete Sask", ["Saskatchewan"]],
  ["Concrete BC", ["British Columbia"]],
  ["RMCAO", ["Ontario"]],
  ["ABQ", ["Quebec"]],
  ["CRMCA", "CA-wide"]
];

// Tags that appear in subgroup banner column A (e.g. "CONCRETE – ... – CANADA").
const SUB_BANNER_TAGS = [
  { match: /\bCANADIAN\b|\b–\s*CANADA\b/i, countries: ["CA"] },
  { match: /\bUS BAR SIZES\b|\b–\s*USA?\b/i, countries: ["US"] },
  { match: /\bN\.?\s*AMERICA\b/i, countries: ["US", "CA"] }
];

// Tags inside a material-name [bracket] (e.g. "[Industry Avg | US & CA]").
function bracketCountries(materialName) {
  const m = (materialName || "").match(/\[[^|\]]+\|\s*([^\]]+)\]/);
  if (!m) return null;
  const reg = m[1].trim().toUpperCase();
  if (/\bUS\b.*\bCA\b|\bCA\b.*\bUS\b/.test(reg)) return ["US", "CA"];
  if (reg === "CA") return ["CA"];
  if (reg === "US") return ["US"];
  if (/N\.?\s*AMERICA/.test(reg)) return ["US", "CA"];
  if (reg === "EU" || reg === "GLOBAL") return ["EU"];
  return null;
}

// Returns { countries: ["CA"]|["US"]|["US","CA"]|["EU"]|null,
//           provinces: ["Ontario"]|"CA-wide"|null }
//
// `countries: null` means jurisdiction-agnostic — always shown by any filter.
// `countries: ["EU"]` means foreign — hidden by both CA and US filters.
export function inferJurisdiction(subgroupName, materialName) {
  const countriesSet = new Set();

  for (const tag of SUB_BANNER_TAGS) {
    if (tag.match.test(subgroupName || "")) {
      for (const c of tag.countries) countriesSet.add(c);
    }
  }
  const bracket = bracketCountries(materialName);
  if (bracket) for (const c of bracket) countriesSet.add(c);

  const countries = countriesSet.size ? [...countriesSet] : null;

  let provinces = null;
  if (countries && countries.includes("CA")) {
    for (const [keyword, provs] of CA_PROVIDER_PROVINCES) {
      if ((materialName || "").includes(keyword)) {
        provinces = provs;
        break;
      }
    }
    if (!provinces) provinces = "CA-wide";
  }

  return { countries, provinces };
}

// Filter rule. Returns true if the row should be shown.
//
// - No filter selected → show all
// - Untagged row (countries=null) → show all (jurisdiction-agnostic items
//   like generic rebar, ground screws, vinyl)
// - Country mismatch → hide (EU rows always hidden when CA or US selected)
// - Country match + Canada province selected: only show "CA-wide" providers
//   plus rows whose providers list includes the selected province.
//   US has no state-level filter, so any province argument is ignored when
//   the selected country is US.
export function matchesFilter(jur, filterCountry, filterProvince) {
  if (!filterCountry) return true;
  if (!jur.countries) return true;
  if (!jur.countries.includes(country2(filterCountry))) return false;
  if (country2(filterCountry) !== "CA") return true;

  const province = normalizeProvince(filterProvince);
  if (!province) return true;
  if (!jur.provinces) return true;
  if (jur.provinces === "CA-wide") return true;
  if (Array.isArray(jur.provinces)) return jur.provinces.includes(province);
  return true;
}

function country2(label) {
  if (!label) return null;
  const l = String(label).toLowerCase().trim();
  if (l === "ca" || l === "canada") return "CA";
  if (l === "us" || l === "usa" || l === "united states") return "US";
  return null;
}
