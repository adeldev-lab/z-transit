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

    // Extract the trip number (corsa) from trip_short_name
    const tripId = trip.trip_short_name ? Number(trip.trip_short_name) : null;

    // Build the stops object: { stopCode: minutesFromMidnight, ... }
    const stops = {};
    for (const st of stopTimesArr) {
      const stopRow = stopsById.get(st.stop_id);
      const stopCode = stopRow?.stop_code || st.stop_id;
      const minutes = parseGtfsTime(st.departure_time);
      stops[stopCode] = minutes;
    }

    const tripObj = { tripId, stops, validity };

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
 * Determine the flags array based on validity prefix.
 * - SC5 → ["SC5"]
 * - Other (FR5, FI5, SAB, SIS, FES) → []
 * Note: "short" and "last" flags require manual review and are not auto-detected.
 * @param {string} validity - The service prefix (e.g. "SC5", "FR5")
 * @returns {string[]}
 */
function buildFlags(validity) {
  if (validity === "SC5") return ["SC5"];
  return [];
}

/**
 * Format a line data object as a JavaScript export string.
 * Uses the same style as the hand-written data files:
 *   - Unquoted object keys for trip properties
 *   - Single quotes for string values
 *   - Double quotes for stop codes inside stops object
 *   - flags populated based on validity
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
        .map(([code, min]) => `"${code}": ${min}`)
        .join(", ");
      const flags = buildFlags(trip.validity);
      const flagsStr = flags.length > 0
        ? `[${flags.map(f => `"${f}"`).join(", ")}]`
        : `[]`;
      const tripIdPart = trip.tripId != null ? `tripId: ${trip.tripId}, ` : "";
      js += `    { ${tripIdPart}stops: { ${stopsStr} }, validity: '${trip.validity}', flags: ${flagsStr}, note: '' },\n`;
    }
    js += `  ],\n`;
  }

  js += `};\n`;
  return js;
}
