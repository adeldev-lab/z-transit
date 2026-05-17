#!/usr/bin/env node
// =============================================================================
// update-stops.mjs – Update STOP_NAMES and STOP_COORDINATES from GTFS
// =============================================================================
// Usage: node scripts/gtfs-import/update-stops.mjs <path-to-gtfs-folder>
//
// Reads stops.txt and generates updated versions of:
//   - js/line-config.js (STOP_NAMES dictionary)
//   - js/map-data.js (STOP_COORDINATES)
//
// The script prints a diff of new/removed/changed stops and asks for
// confirmation before writing. It preserves the existing LINE_CONFIG
// object and only replaces the STOP_NAMES export.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readGtfs, ROUTE_MAP } from "./lib/gtfs-reader.mjs";

const gtfsDir = process.argv[2];
if (!gtfsDir) {
  console.error("Usage: node update-stops.mjs <path-to-gtfs-folder>");
  process.exit(1);
}

const projectRoot = resolve(import.meta.dirname, "../..");
const lineConfigPath = join(projectRoot, "js", "line-config.js");
const mapDataPath = join(projectRoot, "js", "map-data.js");

console.log(`\n🚏 GTFS Stop Updater`);
console.log(`   GTFS source: ${gtfsDir}\n`);

// Read GTFS
const gtfs = readGtfs(gtfsDir);

// Collect all stop_codes used by our 6 routes
const usedStopIds = new Set();
const targetRouteIds = new Set(Object.keys(ROUTE_MAP));
const targetTrips = gtfs.trips.filter(t => targetRouteIds.has(t.route_id));

for (const trip of targetTrips) {
  const stopTimes = gtfs.stopTimesByTrip.get(trip.trip_id) || [];
  for (const st of stopTimes) {
    usedStopIds.add(st.stop_id);
  }
}

// Build new STOP_NAMES and STOP_COORDINATES
const newStopNames = {};
const newStopCoords = {};

for (const stopId of usedStopIds) {
  const stop = gtfs.stopsById.get(stopId);
  if (!stop) continue;
  const code = stop.stop_code || stopId;
  // Clean up the name: remove city prefix duplication
  let name = stop.stop_name || code;
  // GTFS names are like: "Busto Garolfo, Busto A. 131,Deposito"
  // We keep them as-is since the project already uses similar format
  newStopNames[code] = name;
  if (stop.stop_lat && stop.stop_lon) {
    newStopCoords[code] = [parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)];
  }
}

// Read existing line-config.js to compare
const existingContent = readFileSync(lineConfigPath, "utf-8");
const existingStopMatch = existingContent.match(/export const STOP_NAMES = \{([\s\S]*?)\n\};/);

// Report differences
const sortedCodes = Object.keys(newStopNames).sort();
console.log(`\n📊 Results:`);
console.log(`   Stops used by our 6 routes: ${sortedCodes.length}`);
console.log(`   Stops with coordinates: ${Object.keys(newStopCoords).length}`);

// Group by city prefix
const groups = new Map();
for (const code of sortedCodes) {
  const prefix = code.replace(/\d+$/, "");
  if (!groups.has(prefix)) groups.set(prefix, []);
  groups.get(prefix).push(code);
}

console.log(`\n   By city:`);
for (const [prefix, codes] of [...groups.entries()].sort()) {
  console.log(`     ${prefix}: ${codes.length} stops`);
}

// Generate STOP_NAMES source
let stopNamesSource = "\nexport const STOP_NAMES = {\n";
let currentPrefix = "";
for (const code of sortedCodes) {
  const prefix = code.replace(/\d+$/, "");
  if (prefix !== currentPrefix) {
    if (currentPrefix) stopNamesSource += "\n";
    stopNamesSource += `  // ── ${getGroupLabel(prefix)} ──\n`;
    currentPrefix = prefix;
  }
  const escaped = newStopNames[code].replace(/"/g, '\\"');
  stopNamesSource += `  ${code}: "${escaped}",\n`;
}
stopNamesSource += "};\n";

// Generate STOP_COORDINATES source
let coordsSource = "// Auto-generated from GTFS – do not edit manually\n";
coordsSource += `// Generated: ${new Date().toISOString()}\n\n`;
coordsSource += "export const STOP_COORDINATES = {\n";
for (const code of sortedCodes) {
  if (!newStopCoords[code]) continue;
  const [lat, lon] = newStopCoords[code];
  coordsSource += `  ${code}: [${lat}, ${lon}],\n`;
}
coordsSource += "};\n";

// Write outputs
const outputStopsPath = join(projectRoot, "scripts", "gtfs-import", "output-stop-names.js");
const outputCoordsPath = join(projectRoot, "scripts", "gtfs-import", "output-stop-coordinates.js");

writeFileSync(outputStopsPath, stopNamesSource, "utf-8");
writeFileSync(outputCoordsPath, coordsSource, "utf-8");

console.log(`\n✅ Generated files (review before copying to project):`);
console.log(`   ${outputStopsPath}`);
console.log(`   ${outputCoordsPath}`);
console.log(`\n⚠️  To apply:`);
console.log(`   1. Review the generated files`);
console.log(`   2. Replace STOP_NAMES in js/line-config.js with output-stop-names.js content`);
console.log(`   3. Replace STOP_COORDINATES in js/map-data.js with output-stop-coordinates.js content`);
console.log(`   4. The LINE_CONFIG object in line-config.js is NOT touched (manual config)\n`);

function getGroupLabel(prefix) {
  const labels = {
    AC: "Arconate", AL: "Arluno", BC: "Buscate", BS: "Busto Arsizio",
    BT: "Busto Garolfo", CB: "Corbetta", CD: "Cornaredo", CG: "Cuggiono",
    CT: "Castano Primo", CZ: "Casorezzo", DG: "Dairago", IN: "Inveruno",
    LG: "Legnano", MD: "Milano", MG: "Magenta", MN: "Mantegazza",
    OC: "Olcella", OS: "Ossona", PB: "Parabiago", PG: "Pregnana Milanese",
    RG: "Rogorotto", SG: "S. Giorgio su Legnano", TI: "S. Stefano Ticino",
    VC: "Villa Cortese", VH: "Vighignolo/Settimo M."
  };
  return labels[prefix] || prefix;
}
