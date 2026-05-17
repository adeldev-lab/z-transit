#!/usr/bin/env node
// =============================================================================
// update-calendar.mjs – Analyze GTFS calendar_dates and report service periods
// =============================================================================
// Usage: node scripts/gtfs-import/update-calendar.mjs <path-to-gtfs-folder>
//
// This script does NOT modify any project files. It prints:
//   - Feed validity period
//   - All dates where FES (Sunday/Holiday) service runs → holidays to add to config.js
//   - Service periods for each service_id → helps identify school suspensions
//   - Gaps in service → potential suspension periods
//
// You then manually update config.js holidays and serviceDisruptions.
// =============================================================================

import { resolve } from "node:path";
import { readGtfs, ROUTE_MAP, SERVICE_DAY_MAP } from "./lib/gtfs-reader.mjs";

const gtfsDir = process.argv[2];
if (!gtfsDir) {
  console.error("Usage: node update-calendar.mjs <path-to-gtfs-folder>");
  process.exit(1);
}

console.log(`\n📅 GTFS Calendar Analyzer`);
console.log(`   GTFS source: ${gtfsDir}\n`);

const gtfs = readGtfs(gtfsDir);

// Feed info
if (gtfs.feedInfo) {
  console.log(`── Feed Info ──`);
  console.log(`   Publisher: ${gtfs.feedInfo.feed_publisher_name || "?"}`);
  console.log(`   Start: ${gtfs.feedInfo.feed_start_date || "?"}`);
  console.log(`   End: ${gtfs.feedInfo.feed_end_date || "?"}`);
  console.log(`   Version: ${gtfs.feedInfo.feed_version || "?"}`);
  console.log();
}

// Collect all service_ids used by our routes
const targetRouteIds = new Set(Object.keys(ROUTE_MAP));
const usedServiceIds = new Set();
for (const trip of gtfs.trips) {
  if (targetRouteIds.has(trip.route_id)) {
    usedServiceIds.add(trip.service_id);
  }
}

console.log(`── Service IDs used by our routes ──`);
for (const sid of [...usedServiceIds].sort()) {
  const prefix = sid.split("_")[0];
  const dayType = SERVICE_DAY_MAP[prefix] || "unknown";
  const dates = gtfs.calendarByService.get(sid) || [];
  const activeDates = dates.filter(d => d.exception_type === "1").map(d => d.date).sort();
  const removedDates = dates.filter(d => d.exception_type === "2").map(d => d.date).sort();

  // Which routes use this service?
  const routes = [...new Set(
    gtfs.trips.filter(t => t.service_id === sid && targetRouteIds.has(t.route_id))
      .map(t => ROUTE_MAP[t.route_id])
  )].sort();

  console.log(`\n   ${sid}`);
  console.log(`     Type: ${prefix} → ${dayType}`);
  console.log(`     Routes: ${routes.join(", ")}`);
  console.log(`     Active dates: ${activeDates.length} (${activeDates[0] || "?"} → ${activeDates[activeDates.length - 1] || "?"})`);
  if (removedDates.length > 0) {
    console.log(`     Removed dates: ${removedDates.length}`);
  }
}

// Find FES (holiday) dates — these are the holidays to put in config.js
console.log(`\n\n── Holiday Dates (FES service active) ──`);
console.log(`   These are the dates where Sunday/Holiday service runs on a non-Sunday.`);
console.log(`   Add them to config.js holidays[] if not already there.\n`);

const fesDates = new Set();
for (const sid of usedServiceIds) {
  if (!sid.startsWith("FES")) continue;
  const dates = gtfs.calendarByService.get(sid) || [];
  for (const d of dates) {
    if (d.exception_type === "1") fesDates.add(d.date);
  }
}

// Filter to non-Sundays (actual holidays)
const sortedFesDates = [...fesDates].sort();
const holidays = [];
for (const dateStr of sortedFesDates) {
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  const date = new Date(y, m, d);
  const dow = date.getDay(); // 0=Sun
  const formatted = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayName = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][dow];
  if (dow !== 0) {
    holidays.push(formatted);
    console.log(`   ${formatted} (${dayName}) ← HOLIDAY`);
  }
}

console.log(`\n   Total non-Sunday FES dates: ${holidays.length}`);
console.log(`   config.js format:`);
console.log(`   holidays: [${holidays.map(h => `"${h}"`).join(", ")}]`);

// Analyze SC5 (school) service gaps
console.log(`\n\n── School Service (SC5) Analysis ──`);
console.log(`   SC5 services run only on school days. Gaps indicate vacation periods.\n`);

for (const sid of [...usedServiceIds].sort()) {
  if (!sid.startsWith("SC5")) continue;
  const dates = (gtfs.calendarByService.get(sid) || [])
    .filter(d => d.exception_type === "1")
    .map(d => d.date)
    .sort();

  if (dates.length === 0) continue;

  const routes = [...new Set(
    gtfs.trips.filter(t => t.service_id === sid && targetRouteIds.has(t.route_id))
      .map(t => ROUTE_MAP[t.route_id])
  )].sort();

  console.log(`   ${sid} (${routes.join(", ")})`);
  console.log(`     Active: ${formatDate(dates[0])} → ${formatDate(dates[dates.length - 1])}`);
  console.log(`     Total active days: ${dates.length}`);

  // Find gaps > 3 days (potential vacation periods)
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = parseDate(dates[i - 1]);
    const curr = parseDate(dates[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays > 4) { // More than a long weekend
      gaps.push({
        from: dates[i - 1],
        to: dates[i],
        days: Math.round(diffDays)
      });
    }
  }

  if (gaps.length > 0) {
    console.log(`     Gaps (potential vacations):`);
    for (const g of gaps) {
      console.log(`       ${formatDate(g.from)} → ${formatDate(g.to)} (${g.days} days)`);
    }
  }
  console.log();
}

// Summary for config.js
console.log(`\n── Summary for config.js ──`);
console.log(`\n   Feed expires: ${gtfs.feedInfo?.feed_end_date || "unknown"}`);
console.log(`   Download new feed before that date!`);
console.log(`\n   Suggested config.js updates:`);
console.log(`     lastUpdate: "${new Date().toISOString().slice(0, 10)}"`);
if (holidays.length > 0) {
  console.log(`     holidays: [${holidays.map(h => `"${h}"`).join(", ")}]`);
}
console.log(`\n   ⚠️  serviceDisruptions (summer suspensions) cannot be derived from GTFS`);
console.log(`      because the feed typically ends before summer. Verify manually with Movibus.\n`);

function formatDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function parseDate(yyyymmdd) {
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  return new Date(y, m, d);
}
