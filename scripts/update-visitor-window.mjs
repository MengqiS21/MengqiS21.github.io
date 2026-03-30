import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = path.join(rootDir, "assets/data/visitor-window.json");
const goatcounterBaseUrl = (process.env.GOATCOUNTER_BASE_URL || "").trim().replace(/\/$/, "");
const apiKey = (process.env.GOATCOUNTER_API_KEY || "").trim();
const statsStart = "2000-01-01T00:00:00Z";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

const bucketMap = new Map([
  ["US", "northAmerica"],
  ["CA", "northAmerica"],
  ["MX", "northAmerica"],
  ["BR", "southAmerica"],
  ["AR", "southAmerica"],
  ["CL", "southAmerica"],
  ["CO", "southAmerica"],
  ["PE", "southAmerica"],
  ["UY", "southAmerica"],
  ["PY", "southAmerica"],
  ["GB", "europe"],
  ["IE", "europe"],
  ["FR", "europe"],
  ["DE", "europe"],
  ["NL", "europe"],
  ["BE", "europe"],
  ["LU", "europe"],
  ["ES", "europe"],
  ["PT", "europe"],
  ["IT", "europe"],
  ["CH", "europe"],
  ["AT", "europe"],
  ["PL", "europe"],
  ["SE", "europe"],
  ["NO", "europe"],
  ["DK", "europe"],
  ["FI", "europe"],
  ["CZ", "europe"],
  ["HU", "europe"],
  ["RO", "europe"],
  ["GR", "europe"],
  ["UA", "europe"],
  ["ZA", "africa"],
  ["NG", "africa"],
  ["KE", "africa"],
  ["EG", "africa"],
  ["MA", "africa"],
  ["GH", "africa"],
  ["TN", "africa"],
  ["DZ", "africa"],
  ["ET", "africa"],
  ["AE", "middleEast"],
  ["SA", "middleEast"],
  ["QA", "middleEast"],
  ["KW", "middleEast"],
  ["BH", "middleEast"],
  ["OM", "middleEast"],
  ["IL", "middleEast"],
  ["JO", "middleEast"],
  ["TR", "middleEast"],
  ["IN", "southAsia"],
  ["PK", "southAsia"],
  ["BD", "southAsia"],
  ["LK", "southAsia"],
  ["NP", "southAsia"],
  ["CN", "eastAsia"],
  ["HK", "eastAsia"],
  ["MO", "eastAsia"],
  ["TW", "eastAsia"],
  ["JP", "eastAsia"],
  ["KR", "eastAsia"],
  ["MN", "eastAsia"],
  ["SG", "southeastAsia"],
  ["MY", "southeastAsia"],
  ["ID", "southeastAsia"],
  ["PH", "southeastAsia"],
  ["TH", "southeastAsia"],
  ["VN", "southeastAsia"],
  ["KH", "southeastAsia"],
  ["LA", "southeastAsia"],
  ["MM", "southeastAsia"],
  ["AU", "oceania"],
  ["NZ", "oceania"]
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function goatcounterFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = body.error || JSON.stringify(body.errors || body);
    } catch {
      // ignore parse failures and keep the status detail
    }
    throw new Error(`GoatCounter request failed: ${detail}`);
  }

  return response;
}

function emptyData() {
  return {
    source: "goatcounter",
    generatedAt: null,
    lastHitId: null,
    totalViews: 0,
    countryCount: 0,
    topCountries: [],
    activeBuckets: [],
    topBuckets: [],
    countryTotals: {},
    summary: "Awaiting first visitor sync."
  };
}

function roundDownToHour(date) {
  const rounded = new Date(date);
  rounded.setUTCMinutes(0, 0, 0);
  return rounded.toISOString();
}

function buildStatsUrl(pathname) {
  const url = new URL(`${goatcounterBaseUrl}${pathname}`);
  url.searchParams.set("start", statsStart);
  url.searchParams.set("end", roundDownToHour(new Date()));
  return url.toString();
}

function buildCountryCodeLookup() {
  const lookup = new Map();

  bucketMap.forEach((_, code) => {
    const name = countryNames.of(code);
    if (name) {
      lookup.set(name.toLowerCase(), code);
    }
  });

  lookup.set("united states", "US");
  lookup.set("united states of america", "US");
  lookup.set("south korea", "KR");
  lookup.set("north korea", "KP");
  lookup.set("czechia", "CZ");
  lookup.set("czech republic", "CZ");
  lookup.set("taiwan", "TW");
  lookup.set("hong kong", "HK");
  lookup.set("macao", "MO");
  lookup.set("macau", "MO");

  return lookup;
}

const countryCodeLookup = buildCountryCodeLookup();

function toCountryEntry(stat) {
  const name = typeof stat.name === "string" ? stat.name.trim() : "";
  const views = Number(stat.count || 0);
  const code = countryCodeLookup.get(name.toLowerCase()) || null;

  return {
    code,
    views,
    name: name || code || "Unknown"
  };
}

function buildBuckets(topCountries) {
  const buckets = [];

  topCountries.forEach((country) => {
    if (!country.code) {
      return;
    }

    const bucket = bucketMap.get(country.code);
    if (bucket && !buckets.includes(bucket)) {
      buckets.push(bucket);
    }
  });

  return buckets;
}

async function main() {
  if (!goatcounterBaseUrl || !apiKey) {
    console.log("Skipping visitor sync because GoatCounter secrets are not configured.");
    return;
  }

  const [totalResponse, locationsResponse] = await Promise.all([
    goatcounterFetch(buildStatsUrl("/api/v0/stats/total")),
    goatcounterFetch(buildStatsUrl("/api/v0/stats/locations"))
  ]);
  const totalStats = await totalResponse.json();
  const locationStats = await locationsResponse.json();

  const totalViews = Number(totalStats.total || 0);
  const sortedCountries = Array.isArray(locationStats.stats)
    ? locationStats.stats
      .map(toCountryEntry)
      .filter((country) => country.views > 0)
      .sort((left, right) => right.views - left.views)
    : [];
  const topCountries = sortedCountries.slice(0, 5);
  const topBuckets = buildBuckets(topCountries).slice(0, 3);
  const activeBuckets = buildBuckets(sortedCountries);
  const countryTotals = sortedCountries.reduce((totals, country) => {
    if (country.code) {
      totals[country.code] = country.views;
    }
    return totals;
  }, {});

  const output = {
    source: "goatcounter",
    generatedAt: new Date().toISOString(),
    lastHitId: null,
    totalViews,
    countryCount: sortedCountries.length,
    topCountries,
    activeBuckets,
    topBuckets,
    countryTotals,
    summary: sortedCountries.length
      ? `Seen from ${sortedCountries.length} countries.`
      : "Awaiting first visitor sync."
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Updated visitor window data with ${totalViews} views across ${sortedCountries.length} countries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
