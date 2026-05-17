// =============================================================================
// parse-csv.mjs – Zero-dependency CSV parser for GTFS .txt files
// =============================================================================
// Handles quoted fields, embedded commas, and CRLF/LF line endings.
// Returns an array of objects keyed by the header row.
// =============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parse a GTFS .txt file into an array of row objects.
 * @param {string} gtfsDir - Path to the GTFS directory
 * @param {string} filename - e.g. "stops.txt", "trips.txt"
 * @returns {object[]} Array of row objects
 */
export function parseCsv(gtfsDir, filename) {
  const filepath = join(gtfsDir, filename);
  const raw = readFileSync(filepath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length < headers.length) continue; // skip malformed
    const obj = {};
    for (let h = 0; h < headers.length; h++) {
      obj[headers[h]] = values[h] || "";
    }
    rows.push(obj);
  }

  return rows;
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}
