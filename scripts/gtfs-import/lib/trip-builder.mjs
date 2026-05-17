// =============================================================================
// trip-builder.mjs – Builds app trip objects from GTFS stop_times
// =============================================================================

import { ROUTE_MAP, classifyService, parseGtfsTime } from "./gtfs-reader.mjs";

/**
 * Build all trip objects for a given line, grouped by schedule key.
 *
 * @param {string} routeId - GTFS route_id (e.g. "H220")
 * @param {object[]} trips - Filtered trips for this route
 * @param {Map} stopTimesByTrip - trip_id → sorted stop_times[]
 * @param {Map} stopsById - stop_id → stop row
 * @returns {object} { weekday_outbound: [...], weekday_return: [...], ... }
 */
export function buildLineData(routeId, trips, stopTimesByTrip, stopsById) {
  const result = {};

  for (const trip of trips) {
    const direction = trip.direction_id === "1" ? "return" : "outbound";
    const { dayType, validity } = classifyService(trip.service_id);
    const scheduleKey = `${dayType}_${direction}`;

    const stopTimesArr = stopTimesByTrip.get(trip.trip_id);
    if (!stopTimesArr || stopTimesArr.length === 0) continue;

    // Build the stops object: { stopCode: minutesFromMidnight, ... }
    const stops = {};
    for (const st of stopTimesArr) {
      const stopRow = stopsById.get(st.stop_id);
      const stopCode = stopRow?.stop_code || st.stop_id;
      const minutes = parseGtfsTime(st.departure_time);
      stops[stopCode] = minutes;
    }

    const tripObj = { stops, validity };

    if (!result[scheduleKey]) result[scheduleKey] = [];
    result[scheduleKey].push(tripObj);
  }

  // Sort trips within each schedule key by first stop time
  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => {
      const aFirst = Math.min(...Object.values(a.stops));
      const bFirst = Math.min(...Object.values(b.stops));
      return aFirst - bFirst;
    });
  }

  return result;
}

/**
 * Format a line data object as a JavaScript export string.
 * @param {string} lineId - e.g. "Z649"
 * @param {object} data - The schedule-keyed trip data
 * @returns {string} JavaScript source code
 */
export function formatAsJsExport(lineId, data) {
  const varName = `${lineId}_DATA`;
  const keys = Object.keys(data).sort();

  let js = `// Auto-generated from GTFS – do not edit manually\n`;
  js += `// Generated: ${new Date().toISOString()}\n\n`;
  js += `export const ${varName} = {\n`;

  for (const key of keys) {
    const trips = data[key];
    js += `  ${key}: [\n`;
    for (const trip of trips) {
      const stopsStr = Object.entries(trip.stops)
        .map(([code, min]) => `${code}: ${min}`)
        .join(", ");
      js += `    { stops: { ${stopsStr} }, validity: "${trip.validity}" },\n`;
    }
    js += `  ],\n`;
  }

  js += `};\n`;
  return js;
}
