// =============================================================================
// gtfs-reader.mjs – Reads and indexes GTFS data for the 6 target routes
// =============================================================================

import { parseCsv } from "./parse-csv.mjs";

// Route IDs in the Movibus GTFS feed → our line IDs
export const ROUTE_MAP = {
  H210: "Z625",
  H211: "Z627",
  H214: "Z642",
  H216: "Z644",
  H218: "Z647",
  H220: "Z649"
};

// Service ID prefix → app day type
export const SERVICE_DAY_MAP = {
  FR5: "weekday",
  FI5: "weekday",
  SC5: "weekday",   // school-only weekday
  SAB: "saturday",
  SIS: "saturday",  // school-period saturday
  FES: "sunday"
};

/**
 * Read all relevant GTFS data and return indexed structures.
 * @param {string} gtfsDir - Path to the unzipped GTFS folder
 */
export function readGtfs(gtfsDir) {
  console.log("[GTFS] Reading routes...");
  const routes = parseCsv(gtfsDir, "routes.txt");

  console.log("[GTFS] Reading trips...");
  const allTrips = parseCsv(gtfsDir, "trips.txt");

  console.log("[GTFS] Reading stop_times...");
  const allStopTimes = parseCsv(gtfsDir, "stop_times.txt");

  console.log("[GTFS] Reading stops...");
  const allStops = parseCsv(gtfsDir, "stops.txt");

  console.log("[GTFS] Reading calendar_dates...");
  const calendarDates = parseCsv(gtfsDir, "calendar_dates.txt");

  console.log("[GTFS] Reading feed_info...");
  let feedInfo = null;
  try { feedInfo = parseCsv(gtfsDir, "feed_info.txt")[0]; } catch (e) { /* optional */ }

  // Filter trips to our 6 routes only
  const targetRouteIds = new Set(Object.keys(ROUTE_MAP));
  const trips = allTrips.filter(t => targetRouteIds.has(t.route_id));
  const tripIds = new Set(trips.map(t => t.trip_id));

  // Filter stop_times to our trips only
  console.log("[GTFS] Filtering stop_times to target routes...");
  const stopTimes = allStopTimes.filter(st => tripIds.has(st.trip_id));

  // Index stops by stop_id
  const stopsById = new Map();
  for (const s of allStops) {
    stopsById.set(s.stop_id, s);
  }

  // Index stop_times by trip_id
  const stopTimesByTrip = new Map();
  for (const st of stopTimes) {
    if (!stopTimesByTrip.has(st.trip_id)) stopTimesByTrip.set(st.trip_id, []);
    stopTimesByTrip.get(st.trip_id).push(st);
  }
  // Sort each trip's stop_times by stop_sequence
  for (const [, arr] of stopTimesByTrip) {
    arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  }

  // Index calendar_dates by service_id
  const calendarByService = new Map();
  for (const cd of calendarDates) {
    if (!calendarByService.has(cd.service_id)) calendarByService.set(cd.service_id, []);
    calendarByService.get(cd.service_id).push(cd);
  }

  console.log(`[GTFS] Loaded: ${trips.length} trips, ${stopTimes.length} stop_times, ${stopsById.size} stops`);

  return {
    routes,
    trips,
    stopTimes,
    stopsById,
    stopTimesByTrip,
    calendarByService,
    feedInfo
  };
}

/**
 * Determine the app day type from a GTFS service_id.
 * @param {string} serviceId - e.g. "FR5_20260107_0"
 * @returns {{ dayType: string, validity: string }}
 */
export function classifyService(serviceId) {
  const prefix = serviceId.split("_")[0];
  const dayType = SERVICE_DAY_MAP[prefix] || "weekday";
  return { dayType, validity: prefix };
}

/**
 * Parse a GTFS time string (HH:MM:SS) to minutes from midnight.
 * GTFS allows times > 24:00:00 for trips crossing midnight.
 * @param {string} timeStr - e.g. "05:30:00" or "25:10:00"
 * @returns {number} minutes from midnight
 */
export function parseGtfsTime(timeStr) {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}
