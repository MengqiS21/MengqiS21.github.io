import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = path.join(rootDir, "assets/data/visitor-window.json");
const goatcounterBaseUrl = (process.env.GOATCOUNTER_BASE_URL || "").trim().replace(/\/$/, "");
const apiKey = (process.env.GOATCOUNTER_API_KEY || "").trim();
const statsStart = "2000-01-01T00:00:00Z";
const pollDelayMs = 2000;
const maxPollAttempts = 60;

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

function buildStatsUrl(pathname) {
  const url = new URL(`${goatcounterBaseUrl}${pathname}`);
  url.searchParams.set("start", statsStart);
  url.searchParams.set("end", new Date().toISOString());
  return url.toString();
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

async function readExistingData() {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.countryTotals = parsed.countryTotals || {};
    return parsed;
  } catch {
    return emptyData();
  }
}

function normalizeHeaders(headerRow) {
  return headerRow.map((header, index) => {
    if (index === 0) {
      return "Path";
    }

    return header;
  });
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function buildCountrySummary(countryTotals) {
  return Object.entries(countryTotals)
    .sort((left, right) => right[1] - left[1])
    .map(([code, views]) => ({
      code,
      views,
      name: countryNames.of(code) || code
    }));
}

function buildBuckets(countries) {
  const buckets = [];

  countries.forEach((country) => {
    const bucket = bucketMap.get(country.code);
    if (bucket && !buckets.includes(bucket)) {
      buckets.push(bucket);
    }
  });

  return buckets;
}

async function writeOutput(output) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function syncFromStats() {
  const totalResponse = await goatcounterFetch(buildStatsUrl("/api/v0/stats/total"));
  const totalStats = await totalResponse.json();

  return Number(totalStats.total || 0);
}

async function syncLocationsFromExport(existingData) {
  const exportRequestBody = existingData.lastHitId ? { start_from_hit_id: existingData.lastHitId } : {};
  const exportStartResponse = await goatcounterFetch(`${goatcounterBaseUrl}/api/v0/export`, {
    method: "POST",
    body: JSON.stringify(exportRequestBody)
  });
  const exportStart = await exportStartResponse.json();

  let exportInfo = exportStart;
  let attempts = 0;

  while (!exportInfo.finished_at && attempts < maxPollAttempts) {
    await sleep(pollDelayMs);
    attempts += 1;

    const exportInfoResponse = await goatcounterFetch(`${goatcounterBaseUrl}/api/v0/export/${exportStart.id}`);
    exportInfo = await exportInfoResponse.json();
  }

  if (!exportInfo.finished_at) {
    throw new Error("Timed out while waiting for GoatCounter export to finish.");
  }

  const downloadResponse = await goatcounterFetch(`${goatcounterBaseUrl}/api/v0/export/${exportStart.id}/download`);
  const downloadBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  const csv = downloadBuffer[0] === 0x1f && downloadBuffer[1] === 0x8b
    ? gunzipSync(downloadBuffer).toString("utf8")
    : downloadBuffer.toString("utf8");
  const rows = parseCsv(csv);

  if (!rows.length) {
    return {
      countryTotals: existingData.countryTotals || {},
      lastHitId: existingData.lastHitId || null
    };
  }

  const [rawHeader, ...rawDataRows] = rows;
  const headers = normalizeHeaders(rawHeader);
  const locationIndex = headers.indexOf("Location");
  const botIndex = headers.indexOf("Bot");
  const eventIndex = headers.indexOf("Event");

  if (locationIndex === -1 || botIndex === -1 || eventIndex === -1) {
    throw new Error("GoatCounter export format changed; required columns are missing.");
  }

  const countryTotals = { ...(existingData.countryTotals || {}) };

  rawDataRows.forEach((row) => {
    if (row.length < headers.length) {
      return;
    }

    if (row[botIndex] !== "0" || row[eventIndex] !== "false") {
      return;
    }

    const rawLocation = (row[locationIndex] || "").trim().toUpperCase();
    const countryCode = rawLocation.slice(0, 2);

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return;
    }

    countryTotals[countryCode] = Number(countryTotals[countryCode] || 0) + 1;
  });

  return {
    countryTotals,
    lastHitId: exportInfo.last_hit_id || existingData.lastHitId || null
  };
}

async function main() {
  if (!goatcounterBaseUrl || !apiKey) {
    console.log("Skipping visitor sync because GoatCounter secrets are not configured.");
    return;
  }

  const existingData = await readExistingData();
  const totalViews = await syncFromStats();
  let locationData = {
    countryTotals: existingData.countryTotals || {},
    lastHitId: existingData.lastHitId || null
  };

  try {
    locationData = await syncLocationsFromExport(existingData);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("only be done once an hour")) {
      throw error;
    }

    console.log("Export API is rate-limited; keeping existing location data.");
  }

  const sortedCountries = buildCountrySummary(locationData.countryTotals);
  const topCountries = sortedCountries.slice(0, 5);
  const topBuckets = buildBuckets(topCountries).slice(0, 3);
  const activeBuckets = buildBuckets(sortedCountries);
  const output = {
    source: "goatcounter",
    generatedAt: new Date().toISOString(),
    lastHitId: locationData.lastHitId,
    totalViews,
    countryCount: sortedCountries.length,
    topCountries,
    activeBuckets,
    topBuckets,
    countryTotals: locationData.countryTotals,
    summary: sortedCountries.length
      ? `Seen from ${sortedCountries.length} countries.`
      : totalViews > 0
        ? `${totalViews} total views recorded.`
        : "Awaiting first visitor sync."
  };

  await writeOutput(output);
  console.log(`Updated visitor window data with ${output.totalViews} views across ${output.countryCount} countries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
