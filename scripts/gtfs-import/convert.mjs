#!/usr/bin/env node
// =============================================================================
// convert.mjs – Main GTFS → data/z*.js conversion script
// =============================================================================
// Usage: node scripts/gtfs-import/convert.mjs <path-to-gtfs-folder>
//
// Reads the GTFS feed and generates the 6 timetable files:
//   data/z625.js, data/z627.js, data/z642.js, data/z644.js, data/z647.js, data/z649.js
//
// Does NOT modify config.js, line-config.js, or any other project file.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readGtfs, ROUTE_MAP } from "./lib/gtfs-reader.mjs";
import { buildLineData, formatAsJsExport } from "./lib/trip-builder.mjs";

const gtfsDir = process.argv[2];
if (!gtfsDir) {
  console.error("Usage: node convert.mjs <path-to-gtfs-folder>");
  console.error("Example: node convert.mjs C:\\Users\\nasar\\Downloads\\2026-06-08_Movibus");
  process.exit(1);
}

const projectRoot = resolve(import.meta.dirname, "../..");
const dataDir = join(projectRoot, "data");

console.log(`\n🚌 GTFS → Trasporti Busto Garolfo Converter`);
console.log(`   GTFS source: ${gtfsDir}`);
console.log(`   Output dir:  ${dataDir}\n`);

// Read and index GTFS
const gtfs = readGtfs(gtfsDir);

// Process each route
const stats = [];

for (const [routeId, lineId] of Object.entries(ROUTE_MAP)) {
  console.log(`\n── ${lineId} (route ${routeId}) ──`);

  // Filter trips for this route
  const lineTrips = gtfs.trips.filter(t => t.route_id === routeId);
  console.log(`   Trips found: ${lineTrips.length}`);

  if (lineTrips.length === 0) {
    console.warn(`   ⚠️  No trips found for ${lineId}! Skipping.`);
    continue;
  }

  // Build the data structure
  const data = buildLineData(routeId, lineTrips, gtfs.stopTimesByTrip, gtfs.stopsById);

  // Report
  const keys = Object.keys(data);
  for (const key of keys) {
    console.log(`   ${key}: ${data[key].length} trips`);
  }

  // Write the JS file
  const jsContent = formatAsJsExport(lineId, data);
  const outPath = join(dataDir, `${lineId.toLowerCase()}.js`);
  writeFileSync(outPath, jsContent, "utf-8");
  console.log(`   ✅ Written: ${outPath}`);

  stats.push({ lineId, trips: lineTrips.length, sections: keys.length });
}

// Summary
console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Conversion complete!`);
console.log(`   Lines processed: ${stats.length}`);
console.log(`   Total trips: ${stats.reduce((s, x) => s + x.trips, 0)}`);
if (gtfs.feedInfo) {
  console.log(`   Feed valid: ${gtfs.feedInfo.feed_start_date || "?"} → ${gtfs.feedInfo.feed_end_date || "?"}`);
}

// Auto-update feedValidity in config.js
if (gtfs.feedInfo?.feed_start_date && gtfs.feedInfo?.feed_end_date) {
  const configPath = join(dataDir, "config.js");
  let configSrc = readFileSync(configPath, "utf-8");
  const fromDate = `${gtfs.feedInfo.feed_start_date.slice(0, 4)}-${gtfs.feedInfo.feed_start_date.slice(4, 6)}-${gtfs.feedInfo.feed_start_date.slice(6, 8)}`;
  const toDate = `${gtfs.feedInfo.feed_end_date.slice(0, 4)}-${gtfs.feedInfo.feed_end_date.slice(4, 6)}-${gtfs.feedInfo.feed_end_date.slice(6, 8)}`;
  const newValidity = `feedValidity: { from: "${fromDate}", to: "${toDate}" },`;

  if (configSrc.includes("feedValidity:")) {
    configSrc = configSrc.replace(/feedValidity:\s*\{[^}]*\},?/, newValidity);
  } else {
    // Insert after lastUpdate line
    configSrc = configSrc.replace(/(lastUpdate:\s*"[^"]*",?)/, `$1\n  ${newValidity}`);
  }
  writeFileSync(configPath, configSrc, "utf-8");
  console.log(`   ✅ Updated feedValidity in config.js: ${fromDate} → ${toDate}`);
}

console.log(`\n⚠️  Remember to:`);
console.log(`   1. Bump CACHE_NAME in sw.js`);
console.log(`   2. Update cfg.version and cfg.lastUpdate in data/config.js`);
console.log(`   3. Test the app locally before deploying`);
console.log(`${"═".repeat(50)}\n`);
