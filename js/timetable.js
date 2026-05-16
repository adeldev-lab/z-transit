import {
  minsToHHMM,
  getDayType,
  getDayTypeLabel,
  getScheduleKey,
  firstTime,
  escapeHtml
} from "./utils.js";
import { calcNextTrain } from "./trains.js";
import { getStopName } from "./line-config.js";
import { STOP_COORDINATES } from "./map-data.js";
import { openMap } from "./map.js";
import { patchDOM } from "./dom-utils.js";

let lastArgs = null;

export function renderTimetable(state, lineData, lineConfig, cfg) {
  lastArgs = { state, lineData, lineConfig, cfg };
  const container = document.getElementById("timetable-content");
  if (!container) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = state.timetableDayType || getDayType(now, cfg);
  const activeLine = state.timetableLine || cfg.lineOrder?.[0] || "Z649";
  const direction = state.timetableDirection || "outbound";
  const config = lineConfig[activeLine];

  if (!config) {
    patchDOM(container, `<div class="empty-state">Seleziona una linea</div>`);
    return;
  }

  const scheduleKey = getScheduleKey(activeLine, dayType, direction);
  const trips = [...(lineData[activeLine]?.[scheduleKey] || [])];

  let stops;
  if (state.showAllStops) {
    stops = getAllStopsOrdered(trips);
  } else {
    stops = getVisibleStops(state, cfg, activeLine, scheduleKey, direction, config.referenceStops || []);
  }

  const referenceStops = getReferenceStops(state, cfg, activeLine, direction, stops);
  const sortedTrips = trips
    .map(trip => ({ ...trip, _refMin: getReferenceTime(trip, referenceStops) }))
    .sort((a, b) => (a._refMin ?? Number.POSITIVE_INFINITY) - (b._refMin ?? Number.POSITIVE_INFINITY));

  let html = `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Orari linea</p>
          <h2>${escapeHtml(config.label)}</h2>
          <p>${escapeHtml(config.notes || "")}</p>
        </div>
      </div>
      <div class="line-tabs">
        ${(cfg.lineOrder || Object.keys(lineConfig)).map(lineId => `<button type="button" data-line="${lineId}" class="${lineId === activeLine ? "active" : ""}">${lineId}</button>`).join("")}
        <button type="button" class="btn-premium ${state.showAllStops ? "active" : ""}" id="toggle-all-stops">
          ${state.showAllStops ? "Solo le fermate preferite" : "Visualizza tutte le fermate"}
        </button>
      </div>
      <div class="filter-row">
        ${["weekday", "saturday", "sunday"].map(dt => {
    const key = getScheduleKey(activeLine, dt, direction);
    const disabled = !(lineData[activeLine]?.[key]?.length);
    return `<button type="button" data-day="${dt}" class="${dayType === dt ? "active" : ""}" ${disabled ? "disabled" : ""}>${getDayTypeLabel(dt)}</button>`;
  }).join("")}
      </div>
      <div class="segmented wide" data-timetable-direction>
        <button type="button" data-dir="outbound" class="${direction === "outbound" ? "active" : ""}">Andata</button>
        <button type="button" data-dir="return" class="${direction === "return" ? "active" : ""}">Ritorno</button>
      </div>
    </section>`;

  if (!trips.length) {
    html += `<div class="empty-state">Nessun orario per ${getDayTypeLabel(dayType).toLowerCase()} in questa direzione.</div>`;
    patchDOM(container, html, { onAfterPatch: () => bindEvents(container) });
    return;
  }

  html += `<div class="table-card">
    <div class="table-scroll">
      <table class="timetable">
        <thead>
          <tr>
            <th>Corsa</th>
            ${stops.map(code => {
    const hasCoords = !!STOP_COORDINATES[code];
    const label = escapeHtml(shortStop(code));
    return hasCoords
      ? `<th title="${escapeHtml(getStopName(code))} [${code}]" class="stop-link" data-stop-code="${code}">${label}</th>`
      : `<th title="${escapeHtml(getStopName(code))} [${code}]">${label}</th>`;
  }).join("")}
            <th>Conn.</th>
          </tr>
        </thead>
        <tbody>`;

  const nextIndex = sortedTrips.findIndex(t => (t._refMin ?? -1) >= currentMin);
  sortedTrips.forEach((trip, index) => {
    const isPast = (trip._refMin ?? 0) < currentMin;
    const isCurrent = index === nextIndex && !isPast;
    const isShort = trip.flags?.includes("short");
    html += `<tr class="${isPast ? "past" : ""} ${isCurrent ? "current" : ""} ${isShort ? "short" : ""}">
      <td>
        <strong>#${escapeHtml(trip.tripId || "?")}</strong>
        ${isShort ? `<span class="badge muted">breve</span>` : ""}
      </td>
      ${stops.map(code => {
      const value = trip.stops?.[code];
      return `<td>${value !== undefined && value !== null ? minsToHHMM(value) : "-"}</td>`;
    }).join("")}
      <td>${renderConnectionCell(trip, config)}</td>
    </tr>`;
  });

  html += `</tbody></table></div></div>
    <div class="app-footer">Fermate visibili personalizzabili in Impostazioni.</div>`;

  patchDOM(container, html, { onAfterPatch: () => bindEvents(container) });
}

function getVisibleStops(state, cfg, lineId, scheduleKey, direction, fallback) {
  const fromSettings = state.settings?.timetableStops?.[lineId]?.[scheduleKey]
    || state.settings?.timetableStops?.[lineId]?.[direction];
  if (fromSettings?.length) return fromSettings;
  return cfg.stopProfiles?.[lineId]?.timetableStops?.[scheduleKey]
    || cfg.stopProfiles?.[lineId]?.timetableStops?.[direction]
    || cfg.displayStopsOverrides?.[lineId]?.[scheduleKey]
    || cfg.displayStopsOverrides?.[lineId]?.[direction]
    || fallback;
}

function getReferenceStops(state, cfg, lineId, direction, visibleStops) {
  const profile = cfg.stopProfiles?.[lineId] || {};
  const preferred = state.settings?.favoriteStops?.[lineId]?.[direction] || cfg.favoriteStops?.[lineId]?.[direction];
  const directionCandidates = direction === "return"
    ? [state.settings?.returnInterchanges?.[lineId], ...(profile.returnInterchanges || []), preferred]
    : [preferred, ...(profile.outboundHomeStops || [])];
  return [
    ...directionCandidates.filter(code => visibleStops.includes(code)),
    ...visibleStops,
    ...directionCandidates
  ].filter(Boolean);
}

function getReferenceTime(trip, referenceStops) {
  for (const code of referenceStops) {
    const minutes = trip.stops?.[code];
    if (minutes !== undefined && minutes !== null) return minutes;
  }
  return firstTime(trip);
}

function renderConnectionCell(trip, config) {
  try {
    const parts = [];
    for (const [key, connCfg] of Object.entries(config.connections || {})) {
      // Use explicit stopCode if provided (e.g. BS090_RE maps to stop BS090)
      const stopCode = connCfg.stopCode || key;
      const arrMin = trip.stops?.[stopCode];
      if (arrMin === undefined || arrMin === null) continue;
      if (connCfg.slotKey) {
        const train = calcNextTrain(connCfg.slotKey, arrMin)[0];
        if (train) parts.push(`<span class="conn-mini">${escapeHtml(train.line)} ${minsToHHMM(train.departureMin)} <small>+${train.waitMin}′</small></span>`);
      } else if (connCfg.type !== "M1") {
        parts.push(`<span class="conn-mini">${escapeHtml(connCfg.type)} ${minsToHHMM(arrMin)}</span>`);
      }
    }
    return parts.length ? parts.join(" ") : "-";
  } catch (e) {
    console.error("[Trasporti] Errore nel calcolo connessioni:", e);
    return "-";
  }
}

function shortStop(code) {
  return getStopName(code)
    .replace(/^Busto G\.\s*/, "")
    .replace(/^Busto A\.\s*/, "B.A. ")
    .replace(/^Pregnana\s*/, "Pregn. ")
    .replace(/^Villa Cortese\s*/, "V.C. ")
    .replace(/^Castano P\.\s*/, "Cast. ")
    .replace(/^Milano\s*/, "")
    .replace(/^Legnano\s*/, "Legn. ")
    .replace(/^Parabiago\s*/, "Parab. ")
    .replace(/^S\. Giorgio\s*/, "S.G. ")
    .replace(/^S\. Stefano T\.\s*/, "S.St. ")
    .replace(/^Vighignolo\s*/, "Vigh. ");
}

function bindEvents(container) {
  const { state, lineData, lineConfig, cfg } = lastArgs;
  container.querySelectorAll("[data-line]").forEach(button => {
    button.addEventListener("click", () => {
      state.timetableLine = button.dataset.line;
      renderTimetable(state, lineData, lineConfig, cfg);
    });
  });
  container.querySelectorAll("[data-day]").forEach(button => {
    button.addEventListener("click", () => {
      state.timetableDayType = button.dataset.day;
      renderTimetable(state, lineData, lineConfig, cfg);
    });
  });
  container.querySelectorAll("[data-timetable-direction] [data-dir]").forEach(button => {
    button.addEventListener("click", () => {
      state.timetableDirection = button.dataset.dir;
      renderTimetable(state, lineData, lineConfig, cfg);
    });
  });
  container.querySelectorAll("th.stop-link[data-stop-code]").forEach(th => {
    th.addEventListener("click", () => openMap(th.dataset.stopCode));
  });
  const premiumBtn = container.querySelector("#toggle-all-stops");
  if (premiumBtn) {
    premiumBtn.addEventListener("click", () => {
      state.showAllStops = !state.showAllStops;
      renderTimetable(state, lineData, lineConfig, cfg);
    });
  }
}

/**
 * Merges all stops from all trips while trying to preserve their logical order.
 */
function getAllStopsOrdered(trips) {
  if (!trips.length) return [];
  const allStops = [];
  trips.forEach(trip => {
    const tripStops = Object.keys(trip.stops || {});
    let lastInsertedIdx = -1;
    tripStops.forEach(code => {
      const existingIdx = allStops.indexOf(code);
      if (existingIdx === -1) {
        // Stop not in list yet, insert it after the last one we found from this trip
        allStops.splice(lastInsertedIdx + 1, 0, code);
        lastInsertedIdx++;
      } else {
        // Stop exists, update lastInsertedIdx to maintain sequence
        lastInsertedIdx = existingIdx;
      }
    });
  });
  return allStops;
}
