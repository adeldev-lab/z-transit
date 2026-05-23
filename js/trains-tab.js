// =============================================================================
// trains-tab.js – Renders the dedicated Trains tab with real GTFS timetables
// =============================================================================
// Shows departures from relevant train stations (S5, S6, RE4, RE5, R21, R23)
// grouped by station, with direction filter and next-train highlighting.
// =============================================================================

import { TRAIN_ROUTES, TRAIN_STATIONS, TRAIN_DEPARTURES } from "../data/trains.js";
import { minsToHHMM, getDayType, escapeHtml } from "./utils.js";
import { patchDOM } from "./dom-utils.js";
import { openMap } from "./map.js";

const TRAIN_DESTINATIONS = {
  to_milano: {
    S5: "Treviglio",
    S6: "Treviglio",
    RE_4: "Milano Centrale",
    RE4: "Milano Centrale",
    RE_5: "Milano Porta Garibaldi",
    RE5: "Milano Porta Garibaldi",
    R21: "Milano Porta Garibaldi",
    R23: "Milano Centrale",
  },
  from_milano: {
    S5: "Varese FS",
    S6: "Novara",
    RE_4: "Domodossola",
    RE4: "Domodossola",
    RE_5: "Porto Ceresio",
    RE5: "Porto Ceresio",
    R21: "Luino",
    R23: "Domodossola",
  }
};

let lastArgs = null;

const PIN_SVG = `<svg class="pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

const ROUTE_STATIONS_SEQ = {
  to_milano: {
    S5: ["BS_FS", "LG_FS", "CN_FS", "PB_FS", "VZ_FS", "RH_FS"],
    S6: ["PG_FS", "RH_FS"],
    RE_4: ["BS_FS", "RH_FS"],
    RE_5: ["BS_FS", "LG_FS", "RH_FS"],
    R21: ["LG_FS", "CN_FS", "PB_FS", "RH_FS"],
    R23: ["BS_FS", "LG_FS", "PB_FS", "RH_FS"],
  },
  from_milano: {
    S5: ["RH_FS", "VZ_FS", "PB_FS", "CN_FS", "LG_FS", "BS_FS"],
    S6: ["RH_FS", "PG_FS"],
    RE_4: ["RH_FS", "BS_FS"],
    RE_5: ["RH_FS", "LG_FS", "BS_FS"],
    R21: ["RH_FS", "PB_FS", "CN_FS", "LG_FS"],
    R23: ["RH_FS", "PB_FS", "LG_FS", "BS_FS"],
  }
};

export function getTrainTripStops(routeId, direction, dayType, startMin, activeStation) {
  const seq = ROUTE_STATIONS_SEQ[direction]?.[routeId] || [];
  const stops = [];
  
  if (seq.length === 0) return [];
  
  if (direction === "to_milano") {
    const idx = seq.indexOf(activeStation);
    if (idx === -1) return [];
    
    let currentMin = startMin;
    stops.push({ code: activeStation, name: TRAIN_STATIONS[activeStation]?.name || activeStation, min: currentMin, isTrainStation: true });
    
    for (let i = idx + 1; i < seq.length; i++) {
      const prevStation = seq[i - 1];
      const nextStation = seq[i];
      const nextDeps = TRAIN_DEPARTURES[nextStation]?.[routeId]?.[`${dayType}_to_milano`] || [];
      const matchingMin = nextDeps.find(m => m > currentMin && m <= currentMin + 10);
      if (matchingMin !== undefined) {
        currentMin = matchingMin;
      } else {
        currentMin += 5; 
      }
      stops.push({ code: nextStation, name: TRAIN_STATIONS[nextStation]?.name || nextStation, min: currentMin, isTrainStation: true });
    }
    
    let rhoMin = currentMin;
    if (routeId === "S5" || routeId === "S6") {
      stops.push({ name: "Milano Certosa", min: rhoMin + 6 });
      stops.push({ name: "Milano Villapizzone", min: rhoMin + 9 });
      stops.push({ name: "Milano Lancetti", min: rhoMin + 13 });
      stops.push({ name: "Milano Porta Garibaldi Passante", min: rhoMin + 15 });
      stops.push({ name: "Milano Repubblica", min: rhoMin + 17 });
      stops.push({ name: "Milano Porta Venezia", min: rhoMin + 19 });
      stops.push({ name: "Milano Dateo", min: rhoMin + 21 });
      stops.push({ name: "Milano Porta Vittoria", min: rhoMin + 23 });
      stops.push({ name: "Milano Forlanini", min: rhoMin + 26 });
    } else {
      if (routeId === "RE_4" || routeId === "R23") {
        stops.push({ name: "Milano Porta Garibaldi Superficie", min: rhoMin + 14 });
        stops.push({ name: "Milano Centrale", min: rhoMin + 20 });
      } else {
        stops.push({ name: "Milano Porta Garibaldi Superficie", min: rhoMin + 15 });
      }
    }
  } else {
    const idx = seq.indexOf(activeStation);
    if (idx === -1) return [];
    
    const targetSeq = seq.slice(0, idx + 1);
    const times = new Array(targetSeq.length);
    times[idx] = startMin;
    
    for (let i = idx - 1; i >= 0; i--) {
      const currentStation = targetSeq[i];
      const nextStation = targetSeq[i + 1];
      const nextTime = times[i + 1];
      const currentDeps = TRAIN_DEPARTURES[currentStation]?.[routeId]?.[`${dayType}_from_milano`] || [];
      const matchingMin = [...currentDeps].reverse().find(m => m < nextTime && m >= nextTime - 10);
      if (matchingMin !== undefined) {
        times[i] = matchingMin;
      } else {
        times[i] = nextTime - 5;
      }
    }
    
    const rhoMin = times[0];
    
    if (routeId === "S5" || routeId === "S6") {
      stops.unshift({ name: "Milano Certosa", min: rhoMin - 6 });
      stops.unshift({ name: "Milano Villapizzone", min: rhoMin - 9 });
      stops.unshift({ name: "Milano Lancetti", min: rhoMin - 13 });
      stops.unshift({ name: "Milano Porta Garibaldi Passante", min: rhoMin - 15 });
      stops.unshift({ name: "Milano Repubblica", min: rhoMin - 17 });
      stops.unshift({ name: "Milano Porta Venezia", min: rhoMin - 19 });
    } else {
      if (routeId === "RE_4" || routeId === "R23") {
        stops.unshift({ name: "Milano Porta Garibaldi Superficie", min: rhoMin - 14 });
        stops.unshift({ name: "Milano Centrale", min: rhoMin - 20 });
      } else {
        stops.unshift({ name: "Milano Porta Garibaldi Superficie", min: rhoMin - 15 });
      }
    }
    
    for (let i = 0; i < targetSeq.length; i++) {
      stops.push({
        code: targetSeq[i],
        name: TRAIN_STATIONS[targetSeq[i]]?.name || targetSeq[i],
        min: times[i],
        isTrainStation: true
      });
    }
  }
  
  return stops;
}

// Stations relevant per focus city
const CITY_STATIONS = {
  BT: ["CN_FS", "PB_FS", "LG_FS"],
  VC: ["CN_FS", "PB_FS", "LG_FS"],
  DG: ["LG_FS", "CN_FS", "PB_FS"],
  AC: ["LG_FS", "PB_FS", "BS_FS"],
  CZ: ["PB_FS", "CN_FS", "VZ_FS"],
  LG: ["LG_FS", "CN_FS", "PB_FS", "BS_FS"],
  PB: ["PB_FS", "CN_FS", "LG_FS", "VZ_FS"],
  BS: ["BS_FS", "LG_FS", "CN_FS"],
};

// Default station order (all)
const ALL_STATIONS = ["CN_FS", "PB_FS", "LG_FS", "BS_FS", "PG_FS", "RH_FS", "VZ_FS"];

export function renderTrainsTab(state, cfg, saveFn) {
  const actualSaveFn = saveFn || lastArgs?.saveFn;
  lastArgs = { state, cfg, saveFn: actualSaveFn };
  const container = document.getElementById("trains-content");
  if (!container) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = getDayType(now, cfg);
  const focusCity = state.settings?.focusCity || cfg.defaults?.focusCity || "BT";
  const direction = state.trainsDirection || "to_milano";

  // Get stations for this city (or all if user toggled)
  const cityStations = CITY_STATIONS[focusCity] || ALL_STATIONS;
  const showAllStations = !!state.trainsShowAllStations;
  const visibleStations = showAllStations ? ALL_STATIONS : cityStations;
  const activeStation = state.trainsStation || cityStations[0] || "CN_FS";

  const trainReachMinutes = state.settings?.stationReachMinutes?.[activeStation] || 0;

  let html = `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">🚆 Orari Treni</p>
          <h2 style="display: flex; align-items: center; gap: 8px;">
            <span>${escapeHtml(TRAIN_STATIONS[activeStation]?.name || activeStation)} FS</span>
            <button type="button" class="map-trigger dep-stop-pin" data-stop-code="${activeStation}" title="Vedi sulla mappa" aria-label="Apri mappa stazione" style="background: none; border: none; padding: 4px; cursor: pointer; color: var(--accent); display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;">
              ${PIN_SVG}
            </button>
          </h2>
          <p>Partenze in tempo reale da GTFS Trenord</p>
          <div class="inline-reach-config" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--muted);">
            <span>Minuti per raggiungere la stazione:</span>
            <input type="number" min="0" max="60" data-station-inline-reach="${activeStation}" value="${Number(trainReachMinutes)}" style="width: 55px; background: rgba(var(--bg-rgb), 0.3); border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px; color: var(--foreground); font-size: 0.85rem; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--muted); opacity: 0.8;">(0 per disattivare)</span>
          </div>
        </div>
      </div>
      <div class="line-tabs line-tabs-scroll">
        ${visibleStations.map(code => {
          const station = TRAIN_STATIONS[code];
          const isOutside = !cityStations.includes(code);
          return `<button type="button" data-train-station="${code}" class="${code === activeStation ? "active" : ""}${isOutside ? " line-outside" : ""}" title="${station?.name || code}">${station?.name || code}</button>`;
        }).join("")}
      </div>
      <button type="button" class="text-btn line-scope-toggle" data-toggle-all-stations>
        ${showAllStations
          ? `← Solo ${cfg.activeCityConfig?.name || "la mia città"} (${cityStations.length})`
          : `Mostra tutte le stazioni (${ALL_STATIONS.length}) →`}
      </button>
      <div class="segmented wide" data-trains-direction>
        <button type="button" data-tdir="to_milano" class="${direction === "to_milano" ? "active" : ""}">→ Milano</button>
        <button type="button" data-tdir="from_milano" class="${direction === "from_milano" ? "active" : ""}">← Da Milano</button>
      </div>
    </section>`;

  // Get departures for this station
  const stationData = TRAIN_DEPARTURES[activeStation];
  if (!stationData) {
    html += `<div class="empty-state">Nessun dato disponibile per questa stazione.</div>`;
    patchDOM(container, html, { onAfterPatch: () => bindTrainEvents(container) });
    return;
  }

  // Collect all departures for this station/direction/dayType
  const departures = [];
  for (const [routeId, schedules] of Object.entries(stationData)) {
    const key = `${dayType}_${direction}`;
    const times = schedules[key] || [];
    const routeInfo = TRAIN_ROUTES[routeId] || { name: routeId, color: "#666" };
    for (const min of times) {
      departures.push({ min, routeId, routeInfo });
    }
  }

  // Sort by time
  departures.sort((a, b) => a.min - b.min);

  if (departures.length === 0) {
    html += `<div class="empty-state">Nessuna partenza ${direction === "to_milano" ? "verso Milano" : "da Milano"} per ${dayType === "weekday" ? "oggi (feriale)" : dayType === "saturday" ? "sabato" : "domenica/festivo"}.</div>`;
    patchDOM(container, html, { onAfterPatch: () => bindTrainEvents(container) });
    return;
  }

  // Find next departure
  const nextIdx = departures.findIndex(d => d.min >= currentMin);

  // Render upcoming departures (next 5)
  const upcoming = departures.filter(d => d.min >= currentMin).slice(0, 5);
  if (upcoming.length > 0) {
    html += `
      <div class="section-title" style="margin-top: 8px;">🚆 Prossime partenze</div>
      <div class="train-upcoming">`;
    for (const dep of upcoming) {
      const wait = dep.min - currentMin;
      const urgencyClass = wait <= 5 ? "urgency-rush" : wait <= 15 ? "urgency-tight" : "urgency-calm";
      const dest = TRAIN_DESTINATIONS[direction]?.[dep.routeId] || "";
      const destHtml = dest ? `<span class="train-dest" style="font-size: 0.8rem; color: var(--muted); margin-left: 8px;">per ${escapeHtml(dest)}</span>` : "";
      
      let reachHtml = "";
      if (trainReachMinutes > 0) {
        const reachMin = dep.min - trainReachMinutes;
        reachHtml = `<div class="train-suggested" style="font-size: 0.72rem; color: var(--quiet); margin-top: 2px;">
          Parti alle: <strong style="color: var(--accent); font-weight: 700;">${minsToHHMM(reachMin)}</strong>
        </div>`;
      }

      html += `<div class="train-departure-card" style="flex-wrap: wrap; gap: 8px 12px;">
        <span class="train-line-badge" style="background: ${dep.routeInfo.color}; color: #fff;">${escapeHtml(dep.routeInfo.name)}</span>
        <div style="display: flex; flex-direction: column; justify-content: center;">
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <strong class="train-time">${minsToHHMM(dep.min)}</strong>
            ${destHtml}
          </div>
          ${reachHtml}
        </div>
        <span class="train-wait ${urgencyClass}">tra ${wait} min</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Render full timetable
  const depCountLabel = `${departures.length} partenze ${direction === "to_milano" ? "→ Milano" : "← da Milano"}`;
  html += `
    <div class="section-title" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <span>📅 Tabellone completo</span>
      <span style="font-size: 0.72rem; font-weight: 500; text-transform: none; color: var(--muted);">${depCountLabel}</span>
    </div>
    <div class="table-card"><div class="table-scroll">
      <table class="timetable train-timetable">
        <thead><tr><th>Orario</th><th>Linea</th><th>Attesa</th><th>Fermate</th></tr></thead>
        <tbody>`;

  for (let i = 0; i < departures.length; i++) {
    const dep = departures[i];
    const isPast = dep.min < currentMin;
    const isCurrent = i === nextIdx;
    const wait = dep.min - currentMin;
    const isExpanded = state.expandedTrains && state.expandedTrains.has(i);

    const dest = TRAIN_DESTINATIONS[direction]?.[dep.routeId] || "";
    const destHtml = dest ? `<div style="font-size: 0.72rem; color: var(--muted); margin-top: 2px;">per ${escapeHtml(dest)}</div>` : "";

    let reachHtml = "";
    if (trainReachMinutes > 0 && !isPast) {
      const reachMin = dep.min - trainReachMinutes;
      reachHtml = `<div style="font-size: 0.7rem; color: var(--quiet); font-weight: 500; margin-top: 2px; white-space: nowrap;">Parti: <strong style="color: var(--accent);">${minsToHHMM(reachMin)}</strong></div>`;
    }

    html += `<tr class="${isPast ? "past" : ""} ${isCurrent ? "current" : ""}">
      <td>
        <strong>${minsToHHMM(dep.min)}</strong>
        ${reachHtml}
      </td>
      <td>
        <span class="train-line-badge-sm" style="background: ${dep.routeInfo.color}; color: #fff;">${escapeHtml(dep.routeInfo.name)}</span>
        ${destHtml}
      </td>
      <td>${isPast ? `<span class="muted">${Math.abs(wait)} min fa</span>` : `<span>${wait} min</span>`}</td>
      <td>
        <button type="button" class="text-btn train-expand-btn" data-train-index="${i}" style="font-size: 0.75rem; padding: 2px 6px; display: inline-flex; align-items: center; gap: 2px;">
          ${isExpanded ? "▲ Nascondi" : "▼ Fermate"}
        </button>
      </td>
    </tr>`;

    if (isExpanded) {
      const stops = getTrainTripStops(dep.routeId, direction, dayType, dep.min, activeStation);
      let timelineHtml = "";
      if (stops.length > 0) {
        let foundUpcoming = false;
        timelineHtml = stops.map(s => {
          const isStopPast = s.min < currentMin;
          let statusClass = "";
          if (isStopPast) {
            statusClass = "past";
          } else if (!foundUpcoming) {
            statusClass = "upcoming";
            foundUpcoming = true;
          }
          
          const hasPin = s.isTrainStation;
          const stopEl = hasPin
            ? `<small class="map-trigger" data-stop-code="${s.code}" style="cursor:pointer" title="${escapeHtml(s.name)} - Vedi sulla mappa">${escapeHtml(s.name)} ${PIN_SVG}</small>`
            : `<small title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</small>`;
            
          return `<div class="timeline-node ${statusClass}">
            <span></span>
            <strong>${minsToHHMM(s.min)}</strong>
            ${stopEl}
          </div>`;
        }).join("");
      } else {
        timelineHtml = `<div class="empty-mini">Impossibile caricare il dettaglio delle fermate.</div>`;
      }
      
      html += `<tr class="train-details-row">
        <td colspan="4" class="train-details-cell">
          <div class="timeline" style="margin-top: 4px; padding-left: 8px;">
            ${timelineHtml}
          </div>
        </td>
      </tr>`;
    }
  }

  html += `</tbody></table></div></div>`;

  // Station links
  const stationInfo = TRAIN_STATIONS[activeStation];
  if (stationInfo) {
    const rfiUrl = `https://iechub.rfi.it/ArriviPartenze/ArrivalsDepartures/Monitor?placeId=&stationName=${encodeURIComponent(stationInfo.name)}`;
    html += `<div class="app-footer">
      <a href="${escapeHtml(rfiUrl)}" target="_blank" rel="noopener" style="color: var(--accent);">🔴 Tabellone RFI tempo reale – ${escapeHtml(stationInfo.name)}</a>
    </div>`;
  }

  patchDOM(container, html, { onAfterPatch: () => bindTrainEvents(container) });
}

function bindTrainEvents(container) {
  const { state, cfg, saveFn } = lastArgs;

  // Inline reach minutes config change
  const inlineInput = container.querySelector("[data-station-inline-reach]");
  if (inlineInput && !inlineInput.__has_change) {
    inlineInput.__has_change = true;
    inlineInput.addEventListener("change", () => {
      const station = inlineInput.dataset.stationInlineReach;
      const min = Number(inlineInput.min || 0);
      const max = Number(inlineInput.max || 60);
      const value = Math.max(min, Math.min(max, Number(inlineInput.value || 0)));
      inlineInput.value = value;

      if (!state.settings) state.settings = {};
      if (!state.settings.stationReachMinutes) state.settings.stationReachMinutes = {};
      state.settings.stationReachMinutes[station] = value;

      if (saveFn) {
        saveFn({ stationReachMinutes: state.settings.stationReachMinutes });
      } else {
        renderTrainsTab(state, cfg);
      }
    });
  }

  // Station tabs
  container.querySelectorAll("[data-train-station]").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", () => {
      state.trainsStation = btn.dataset.trainStation;
      renderTrainsTab(state, cfg);
    });
  });

  // Direction toggle
  container.querySelectorAll("[data-tdir]").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", () => {
      state.trainsDirection = btn.dataset.tdir;
      renderTrainsTab(state, cfg);
    });
  });

  // Toggle "Show all stations"
  const toggleBtn = container.querySelector("[data-toggle-all-stations]");
  if (toggleBtn && !toggleBtn.__has_click) {
    toggleBtn.__has_click = true;
    toggleBtn.addEventListener("click", () => {
      state.trainsShowAllStations = !state.trainsShowAllStations;
      renderTrainsTab(state, cfg);
    });
  }

  // Train stop expand toggle
  container.querySelectorAll(".train-expand-btn").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.trainIndex, 10);
      if (!state.expandedTrains) {
        state.expandedTrains = new Set();
      }
      if (state.expandedTrains.has(idx)) {
        state.expandedTrains.delete(idx);
      } else {
        state.expandedTrains.add(idx);
      }
      renderTrainsTab(state, cfg);
    });
  });

  // Map triggers
  container.querySelectorAll(".map-trigger").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMap(btn.dataset.stopCode);
    });
  });
}
