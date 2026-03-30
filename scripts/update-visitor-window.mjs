import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = path.join(rootDir, "assets/data/visitor-window.json");
const goatcounterBaseUrl = (process.env.GOATCOUNTER_BASE_URL || "").trim().replace(/\/$/, "");
const apiKey = (process.env.GOATCOUNTER_API_KEY || "").trim();
const statsStart = "2000-01-01T00:00:00Z";

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

async function writeOutput(output) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function syncFromStats() {
  const totalResponse = await goatcounterFetch(buildStatsUrl("/api/v0/stats/total"));
  const totalStats = await totalResponse.json();

  const totalViews = Number(totalStats.total || 0);

  return {
    source: "goatcounter",
    generatedAt: new Date().toISOString(),
    lastHitId: null,
    totalViews,
    countryCount: 0,
    topCountries: [],
    activeBuckets: [],
    topBuckets: [],
    countryTotals: {},
    summary: totalViews > 0
      ? `${totalViews} total views recorded.`
      : "Awaiting first visitor sync."
  };
}

async function main() {
  if (!goatcounterBaseUrl || !apiKey) {
    console.log("Skipping visitor sync because GoatCounter secrets are not configured.");
    return;
  }
  const output = await syncFromStats();
  await writeOutput(output);
  console.log(`Updated visitor window data with ${output.totalViews} views across ${output.countryCount} countries.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
