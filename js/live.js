import {
  minsToHHMM,
  getDayType,
  getUrgencyState,
  getUrgencyClass,
  getReachabilityState,
  getConnectionState,
  getActiveTrips,
  getRecentlyDeparted,
  isGlobalInactive,
  isLineDisrupted,
  hasServiceToday,
  formatWait,
  getScheduleKey,
  unique,
  escapeHtml
} from "./utils.js";

import { calcNextTrain, buildCanegrateBlock } from "./trains.js";
import { getStopName, STOP_NAMES } from "./line-config.js";
import { openMap } from "./map.js";
import { STOP_COORDINATES } from "./map-data.js";
import { patchDOM } from "./dom-utils.js";
import { renderStrikeBanner, dismissAlert } from "./alerts.js";

// Cities ordered outward from Busto Garolfo for the stop filter dropdown
const FILTER_CITY_ORDER = [
  { prefix: "BT", label: "Busto Garolfo" },
  { prefix: "VC", label: "Villa Cortese" },
  { prefix: "DG", label: "Dairago" },
  { prefix: "AC", label: "Arconate" },
  { prefix: "OC", label: "Olcella" },
  { prefix: "SG", label: "S. Giorgio su Legnano" },
  { prefix: "LG", label: "Legnano" },
  { prefix: "PB", label: "Parabiago" },
  { prefix: "BS", label: "Busto Arsizio" },
  { prefix: "CZ", label: "Casorezzo" },
  { prefix: "OS", label: "Ossona" },
  { prefix: "AL", label: "Arluno" },
  { prefix: "RG", label: "Rogorotto" },
  { prefix: "MN", label: "Mantegazza" },
  { prefix: "PG", label: "Pregnana Milanese" },
  { prefix: "CD", label: "Cornaredo" },
  { prefix: "VH", label: "Vighignolo" },
  { prefix: "MD", label: "Milano (Molino Dorino)" },
  { prefix: "MG", label: "Magenta" },
  { prefix: "CB", label: "Corbetta" },
  { prefix: "TI", label: "S. Stefano Ticino" },
  { prefix: "IN", label: "Inveruno" },
  { prefix: "CG", label: "Cuggiono" },
  { prefix: "BC", label: "Buscate" },
  { prefix: "CT", label: "Castano Primo" }
];

let lastArgs = null;

export function renderLive(state, lineData, lineConfig, cfg, saveSettings) {
  lastArgs = { state, lineData, lineConfig, cfg, saveSettings };
  const container = document.getElementById("live-content");
  if (!container) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = getDayType(now, cfg);
  const direction = state.settings.liveDirection || cfg.defaults.liveDirection || "outbound";
  const allLines = cfg.lineOrder || Object.keys(lineConfig);
  // If the user completed onboarding and selected specific lines, filter to those.
  // Empty activeLines or skipped onboarding → show all lines (original behavior).
  const userActiveLines = state.settings?.userProfile?.activeLines;
  const lineOrder = (Array.isArray(userActiveLines) && userActiveLines.length > 0 && !state.settings?.userProfile?.skipped)
    ? allLines.filter(id => userActiveLines.includes(id))
    : allLines;
  const title = direction === "return" ? "Ritorno verso Busto Garolfo" : "Andata da Busto Garolfo";
  const subtitle = direction === "return"
    ? "Da Repubblica, Molino Dorino, Pregnana FS e altri interscambi supportati."
    : "Fermate preferite con fallback automatico per ogni linea.";

  const stopFilter = state.liveStopFilter || null;
  const lineFilter = state.liveLineFilter || null;

  let html = `
    <section class="hero-panel">
      <div>
        <p class="section-eyebrow">${escapeHtml(cfg.homeProfile.address)}</p>
        <h2>${title}</h2>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="segmented" data-live-direction>
        <button type="button" data-dir="outbound" class="${direction === "outbound" ? "active" : ""}">Andata</button>
        <button type="button" data-dir="return" class="${direction === "return" ? "active" : ""}">Ritorno</button>
      </div>
    </section>`;

  html += renderFilterBar(lineConfig, cfg, stopFilter, lineFilter);

  // Strike banner (only active strikes, not general notices)
  html += renderStrikeBanner();

  if (isGlobalInactive(now, cfg)) {
    html += `<div class="banner banner-danger">Servizio sospeso: ${escapeHtml(cfg.globalInactivity.note)}</div>`;
  }

  const cards = [];
  for (const lineId of lineOrder) {
    if (!lineConfig[lineId]?.showInLive) continue;
    if (lineFilter && lineFilter !== lineId) continue;
    const hasService = hasServiceToday(lineId, dayType, lineConfig, lineData, now, cfg);
    const disrupted = isLineDisrupted(lineId, now, cfg);
    if (!hasService && !disrupted) continue;
    try {
      const card = direction === "return"
        ? buildReturnCard(lineId, state, lineData, lineConfig, cfg, currentMin, dayType, disrupted, stopFilter)
        : buildOutboundCard(lineId, state, lineData, lineConfig, cfg, currentMin, dayType, disrupted, stopFilter);
      if (card) {
        if (stopFilter && !card.hasTrips) continue;
        cards.push(card);
      }
    } catch (cardError) {
      console.error(`[Trasporti] Errore nel calcolo della card ${lineId}:`, cardError);
    }
  }

  if (cards.length === 0) {
    const msg = (stopFilter || lineFilter)
      ? "Nessuna corsa trovata con i filtri attivi."
      : "Nessuna corsa utile trovata per questa modalità.";
    html += `<div class="empty-state">${msg}</div>`;
  } else {
    cards.sort(compareCardsByDeparture);
    if (!stopFilter) {
      const hero = cards.find(card => card.lineId === "Z649" && card.hasTrips);
      if (hero) {
        try {
          html += renderFeaturedCard(hero, direction, cfg, currentMin, state);
        } catch (e) {
          console.error("[Trasporti] Errore nel render della featured card:", e);
        }
      }
    }
    html += `<div class="section-title">${stopFilter ? `Partenze da ${escapeHtml(getStopName(stopFilter))}` : "Linee attive"}</div>`;
    html += cards.map(card => {
      try {
        return renderLineCard(card, direction, cfg, currentMin, state);
      } catch (e) {
        console.error(`[Trasporti] Errore nel render card ${card.lineId}:`, e);
        return `<div class="empty-mini" style="border-color: rgba(239,68,68,0.3); color: #fecaca;">Errore nel caricamento di ${card.lineId}</div>`;
      }
    }).join("");
  }

  if (!stopFilter) {
    try {
      html += renderRecentlyDepartedBlock(state, lineData, lineConfig, cfg, currentMin, dayType, direction);
    } catch (e) {
      console.error("[Trasporti] Errore nel render recenti:", e);
    }
  }
  try {
    html += renderCanegrateBlock(state, currentMin, cfg);
  } catch (e) {
    console.error("[Trasporti] Errore nel render Canegrate:", e);
  }
  html += `<div class="app-footer">Dati aggiornati al ${escapeHtml(cfg.lastUpdate)}. Coincidenze treno/metro stimate.</div>`;

  patchDOM(container, html, { onAfterPatch: () => bindLiveEvents(container) });
}

function renderFilterBar(lineConfig, cfg, stopFilter, lineFilter) {
  const lineOrder = cfg.lineOrder || Object.keys(lineConfig);
  const inputValue = stopFilter ? getStopName(stopFilter) : "";

  // Build line pills
  const linePills = [
    `<button type="button" data-line-filter="" class="${!lineFilter ? "active" : ""}">Tutte</button>`,
    ...lineOrder.map(id =>
      `<button type="button" data-line-filter="${id}" class="${lineFilter === id ? "active" : ""}">${id}</button>`
    )
  ].join("");

  // Active filter indicator
  let activeInfo = "";
  if (stopFilter || lineFilter) {
    const parts = [];
    if (stopFilter) parts.push(`📍 <strong title="${escapeHtml(getStopName(stopFilter))} [${stopFilter}]">${escapeHtml(getStopName(stopFilter))}</strong>`);
    if (lineFilter) parts.push(`🚌 <strong>${lineFilter}</strong>`);
    activeInfo = `<div class="filter-active-info">
      ${parts.join(" · ")}
      <button type="button" class="text-btn" data-clear-filters>Azzera filtri</button>
    </div>`;
  }

  return `<section class="filter-bar">
    <div class="filter-group">
      <span class="filter-label">📍 Fermata</span>
      <div class="stop-search-wrapper">
        <input type="text" class="stop-search-input" data-stop-search
          placeholder="Cerca fermata..." autocomplete="off"
          value="${escapeHtml(inputValue)}">
        ${stopFilter ? '<button type="button" class="stop-search-clear" data-stop-search-clear>✕</button>' : ""}
        <div class="stop-search-results" data-stop-results></div>
      </div>
    </div>
    <div class="filter-group">
      <span class="filter-label">🚌 Linea</span>
      <div class="filter-pills">${linePills}</div>
    </div>
    ${activeInfo}
  </section>`;
}

function buildSearchResults(query) {
  if (!query || query.length < 1) return "";
  const q = query.toLowerCase();
  let html = "";
  for (const { prefix, label } of FILTER_CITY_ORDER) {
    const codes = Object.keys(STOP_NAMES)
      .filter(c => c.startsWith(prefix) && (STOP_NAMES[c].toLowerCase().includes(q) || c.toLowerCase().includes(q)))
      .sort();
    if (!codes.length) continue;
    html += `<div class="search-group-label">${escapeHtml(label)}</div>`;
    for (const code of codes) {
      html += `<button type="button" class="search-result-item" data-stop-pick="${code}">${escapeHtml(STOP_NAMES[code])}</button>`;
    }
  }
  return html || `<div class="search-no-results">Nessuna fermata trovata</div>`;
}

function getUserFavorite(state, cfg, lineId, direction) {
  return state.settings?.favoriteStops?.[lineId]?.[direction] || cfg.favoriteStops?.[lineId]?.[direction] || null;
}

function getProfile(cfg, lineId) {
  return cfg.stopProfiles?.[lineId] || {};
}

function compareCardsByDeparture(a, b) {
  const aMin = a.trip?._depMin ?? Number.POSITIVE_INFINITY;
  const bMin = b.trip?._depMin ?? Number.POSITIVE_INFINITY;
  if (aMin !== bMin) return aMin - bMin;
  return a.lineId.localeCompare(b.lineId);
}

function buildOutboundCard(lineId, state, lineData, lineConfig, cfg, currentMin, dayType, disrupted, stopFilter) {
  const config = lineConfig[lineId];
  const profile = getProfile(cfg, lineId);
  const scheduleKey = getScheduleKey(lineId, dayType, "outbound");
  let trips = lineData[lineId]?.[scheduleKey] || [];

  // When stop filter is active, only keep trips that pass through the selected stop
  if (stopFilter) {
    trips = trips.filter(t => t.stops?.[stopFilter] !== undefined && t.stops?.[stopFilter] !== null);
  }

  const preferred = stopFilter || getUserFavorite(state, cfg, lineId, "outbound");
  const fallbacks = stopFilter ? [] : (profile.outboundHomeStops || config.referenceStops || []);
  const nextTrips = getActiveTrips(trips, currentMin, 3, preferred, fallbacks);
  const trip = nextTrips[0] || null;
  const compactStops = getConfiguredStops(state, cfg, lineId, "compactStops", "outbound", profile.compactStops?.outbound || config.referenceStops || []);
  const detailStops = getConfiguredStops(state, cfg, lineId, "detailStops", "outbound", profile.detailStops?.outbound || compactStops);

  return {
    lineId, config, direction: "outbound",
    hasTrips: nextTrips.length > 0, disrupted,
    validities: unique(trips.map(t => t.validity)),
    nextTrips, trip,
    fromStop: trip?._depStop || preferred || fallbacks[0],
    toStop: compactStops.at(-1),
    compactStops, detailStops, scheduleKey
  };
}

function buildReturnCard(lineId, state, lineData, lineConfig, cfg, currentMin, dayType, disrupted, stopFilter) {
  const config = lineConfig[lineId];
  const profile = getProfile(cfg, lineId);
  const scheduleKey = getScheduleKey(lineId, dayType, "return");
  let trips = lineData[lineId]?.[scheduleKey] || [];

  if (stopFilter) {
    trips = trips.filter(t => t.stops?.[stopFilter] !== undefined && t.stops?.[stopFilter] !== null);
  }

  const interchanges = profile.returnInterchanges || [];
  const preferredInterchange = stopFilter || state.settings?.returnInterchanges?.[lineId] || interchanges[0] || null;
  const nextTrips = getActiveTrips(trips, currentMin, 3, preferredInterchange, stopFilter ? [] : interchanges);
  const trip = nextTrips[0] || null;
  const homeStops = [getUserFavorite(state, cfg, lineId, "return"), ...(profile.returnHomeStops || [])].filter(Boolean);
  const compactStops = getConfiguredStops(state, cfg, lineId, "compactStops", "return", profile.compactStops?.return || homeStops);
  const detailStops = getConfiguredStops(state, cfg, lineId, "detailStops", "return", profile.detailStops?.return || [preferredInterchange, ...homeStops]);
  const arrival = trip ? chooseArrivalAfter(trip, homeStops, trip._depMin) : null;

  return {
    lineId, config, direction: "return",
    hasTrips: nextTrips.length > 0, disrupted,
    validities: unique(trips.map(t => t.validity)),
    nextTrips, trip,
    fromStop: trip?._depStop || preferredInterchange,
    toStop: arrival?.stopCode || homeStops[0],
    compactStops, detailStops, scheduleKey,
    returnOrigins: profile.returnConnectionOrigins || [],
    arrival
  };
}

function getConfiguredStops(state, cfg, lineId, kind, direction, defaults) {
  const custom = state.settings?.visibleStops?.[lineId]?.[kind]?.[direction];
  return custom?.length ? custom : defaults;
}

function chooseArrivalAfter(trip, candidates, afterMin) {
  for (const code of candidates) {
    const minutes = trip.stops?.[code];
    if (minutes !== undefined && minutes !== null && minutes >= afterMin) return { stopCode: code, minutes };
  }
  return null;
}

function renderFeaturedCard(card, direction, cfg, currentMin, state) {
  const trip = card.trip;
  const wait = trip._depMin - currentMin;
  const walkMin = Number(state.settings?.walkRossini || cfg.defaults.walkRossini || 0);
  const busState = getUrgencyState(wait);
  const reachability = direction === "outbound" ? getReachabilityState(wait, walkMin) : busState;
  const urgency = busState.css === "missed" ? busState : reachability;
  const primaryStops = renderStopChips(trip, card.compactStops, "large");
  const destination = direction === 'return' ? getStopName(card.toStop) : card.config.destination;
  const fromStopName = getStopName(card.fromStop);
  const hasMapPin = card.fromStop && card.fromStop.startsWith('BT') && typeof STOP_COORDINATES !== 'undefined' && !!STOP_COORDINATES[card.fromStop];
  const pinHtml = hasMapPin
    ? `<button type="button" class="map-trigger dep-stop-pin" data-stop-code="${card.fromStop}" title="Vedi sulla mappa" aria-label="Apri mappa fermata">📍</button>`
    : '';

  const depStopHtml = `
    <div class="dep-stop-row" style="padding-left: 0; padding-right: 0; padding-top: 8px;">
      <span class="dep-stop-label">PARTENZA DA</span>
      <span class="dep-stop-name">${escapeHtml(fromStopName)}${pinHtml}</span>
      <span class="dep-stop-dest">→ ${escapeHtml(destination)}</span>
    </div>
  `;

  const depHHMM = minsToHHMM(trip._depMin);
  const leaveCountdown = wait - walkMin;
  const leaveAtHHMM = minsToHHMM(trip._depMin - walkMin);

  const walkBlock = direction === 'outbound' ? `
      <div class="time-block walk">
        <div class="time-block-label walk">Uscire di casa</div>
        <h2 style="color: var(--accent); margin: 0; font-size: clamp(2rem, 9vw, 3.5rem);">tra ${leaveCountdown} min</h2>
        <span class="time-block-pill walk">a piedi</span>
        <div class="time-block-detail">Uscire alle ${leaveAtHHMM} &middot; ${walkMin} min a piedi</div>
      </div>
  ` : '';

  return `<section class="featured-card ${urgency.css}">
    <div class="featured-top">
      <span class="line-pill">${card.lineId}</span>
      <span class="status-pill ${urgency.css}">${urgency.label}</span>
    </div>
    ${depStopHtml}
    <div class="time-info-row" style="border-top: none;">
      <div class="time-block bus">
        <div class="time-block-label bus">Orario Bus</div>
        <h2 style="margin: 0;">${depHHMM}</h2>
        <span class="time-block-pill bus">tra ${wait} min</span>
      </div>
      ${walkBlock}
    </div>
    ${primaryStops}
    ${direction === "outbound" && card.lineId === "Z649" ? renderZ649DestinationEstimates(trip, cfg) : ""}
  </section>`;
}

function renderLineCard(card, direction, cfg, currentMin, state) {
  const id = `live-${card.lineId}`;
  const isExpanded = false;
  const trip = card.trip;
  const walkMin = Number(state?.settings?.walkRossini ?? cfg.defaults.walkRossini ?? 0);
  const wait = trip ? trip._depMin - currentMin : null;
  const urgencyClass = trip ? getUrgencyClass(wait) : "urgency-missed";
  const compact = trip ? renderStopChips(trip, card.compactStops) : "";
  const nextDisplay = trip ? `${minsToHHMM(trip._depMin)} · ${formatWait(wait)}` : "Nessun bus";
  const routeLabel = direction === "return"
    ? `${getStopName(card.fromStop)} -> ${getStopName(card.toStop)}`
    : `${getStopName(card.fromStop)} -> ${card.config.destination}`;
  const fallback = trip?._usedFallback ? `<span class="notice-inline">fermata alternativa</span>` : "";

  return `<article class="line-card ${isExpanded ? "expanded" : ""}" data-card="${id}">
    <button class="line-card-header" type="button" data-toggle-card="${id}">
      <div class="line-main">
        <span class="line-pill">${card.lineId}</span>
        <div>
          <h3>${escapeHtml(routeLabel)}</h3>
          <p>${fallback}${renderValidity(card.validities)}</p>
        </div>
      </div>
      <div class="line-meta">
        <strong>${nextDisplay}</strong>
        <span class="urgency-dot ${urgencyClass}"></span>
    </button>
    ${renderTimeInfoRow(trip, wait, walkMin, direction, card.fromStop, direction === 'return' ? getStopName(card.toStop) : card.config.destination)}
    ${compact}
    <div class="line-card-body">
      ${card.disrupted ? renderDisruption(card.lineId, cfg) : ""}
      ${trip ? renderTripDetails(card, cfg, currentMin) : `<div class="empty-mini">Nessuna corsa nelle prossime ore.</div>`}
      ${renderUpcomingTrips(card)}
    </div>
  </article>`;
}

function renderTimeInfoRow(trip, wait, walkMin, direction, fromStop, destination) {
  if (!trip) return "";
  const depHHMM = minsToHHMM(trip._depMin);
  const leaveCountdown = wait - walkMin;
  const leaveAtHHMM = minsToHHMM(trip._depMin - walkMin);

  const fromStopName = getStopName(fromStop);
  const hasMapPin = fromStop && fromStop.startsWith('BT') && typeof STOP_COORDINATES !== 'undefined' && !!STOP_COORDINATES[fromStop];
  const pinHtml = hasMapPin
    ? `<button type="button" class="map-trigger dep-stop-pin" data-stop-code="${fromStop}" title="Vedi sulla mappa" aria-label="Apri mappa fermata">📍</button>`
    : '';

  return `
    <div class="dep-stop-row">
      <span class="dep-stop-label">PARTENZA DA</span>
      <span class="dep-stop-name">${escapeHtml(fromStopName)}${pinHtml}</span>
      <span class="dep-stop-dest">→ ${escapeHtml(destination)}</span>
    </div>
    <div class="time-info-row">
      <div class="time-block bus">
        <div class="time-block-label bus">Orario Bus</div>
        <div class="time-block-value bus">${depHHMM}</div>
        <span class="time-block-pill bus">tra ${wait} min</span>
      </div>
      ${direction === 'outbound' ? `
      <div class="time-block walk">
        <div class="time-block-label walk">Uscire di casa</div>
        <div class="time-block-value walk">tra ${leaveCountdown} min</div>
        <span class="time-block-pill walk">a piedi</span>
        <div class="time-block-detail">Uscire alle ${leaveAtHHMM} &middot; ${walkMin} min a piedi</div>
      </div>` : ''}
    </div>
  `;
}

function renderValidity(validities) {
  if (!validities.length) return "";
  return validities.map(v => `<span class="validity-badge">${escapeHtml(v)}</span>`).join("");
}

function renderDisruption(lineId, cfg) {
  const d = cfg.serviceDisruptions?.[lineId]?.[0];
  return `<div class="banner banner-warning">Possibile sospensione fino al ${escapeHtml(d?.to || "?")}: ${escapeHtml(d?.note || "")}</div>`;
}

function renderStopChips(trip, stops, size = "") {
  const chips = (stops || [])
    .map(code => {
      const mins = trip.stops?.[code];
      const hasPin = STOP_COORDINATES?.[code];
      const stopEl = hasPin
        ? `<small class="map-trigger" data-stop-code="${code}" style="cursor:pointer" title="${escapeHtml(getStopName(code))} [${code}] - Vedi sulla mappa">${escapeHtml(getStopName(code))} 📍</small>`
        : `<small title="${escapeHtml(getStopName(code))} [${code}]">${escapeHtml(getStopName(code))}</small>`;
      return `<span class="stop-chip ${size}">
        ${stopEl}
        <strong>${mins !== undefined && mins !== null ? minsToHHMM(mins) : "-"}</strong>
      </span>`;
    })
    .join("");
  return chips ? `<div class="stop-chip-row">${chips}</div>` : "";
}

function renderTripDetails(card, cfg, currentMin) {
  const trip = card.trip;
  const timeline = card.detailStops
    .map(code => ({ code, minutes: trip.stops?.[code] }))
    .filter(s => s.minutes !== undefined && s.minutes !== null)
    .map(s => {
      const hasPin = STOP_COORDINATES?.[s.code];
      const stopEl = hasPin
        ? `<small class="map-trigger" data-stop-code="${s.code}" style="cursor:pointer" title="${escapeHtml(getStopName(s.code))} [${s.code}] - Vedi sulla mappa">${escapeHtml(getStopName(s.code))} 📍</small>`
        : `<small title="${escapeHtml(getStopName(s.code))} [${s.code}]">${escapeHtml(getStopName(s.code))}</small>`;
      return `<div class="timeline-node">
        <span></span>
        <strong>${minsToHHMM(s.minutes)}</strong>
        ${stopEl}
      </div>`;
    })
    .join("");

  const connections = renderConnections(card, cfg, currentMin);
  return `<div class="timeline">${timeline}</div>${connections}`;
}

function getM1FrequencyLabel(arrMin, cfg) {
  const m1 = cfg.m1Frequency;
  if (!m1) return "ogni ~5 min";
  const isPeak = (m1.peakHours || []).some(([from, to]) => arrMin >= from && arrMin <= to);
  return isPeak ? `ogni ~${m1.peakMin} min` : `ogni ~${m1.offPeakMin} min`;
}

function renderStationLink(slotKey, cfg) {
  const link = cfg.stationLinks?.[slotKey];
  if (!link) return "";
  return ` <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" class="station-link" title="Orari tempo reale ${escapeHtml(link.label)}">🔴 LIVE</a>`;
}

function renderConnections(card, cfg, currentMin) {
  const trip = card.trip;

  // ── RETURN: show how to reach the bus from various origins ──
  if (card.direction === "return") {
    const origins = card.returnOrigins
      .map(origin => {
        const busAtInterchange = trip.stops?.[origin.interchangeStop];
        if (busAtInterchange === undefined || busAtInterchange === null) return "";
        const leaveOrigin = busAtInterchange - origin.minutesToInterchange;
        // Connection quality based on how much time until user must leave
        const marginMin = leaveOrigin - currentMin;
        let connState;
        if (marginMin < 0) connState = { label: "perso", css: "missed" };
        else if (marginMin < 5) connState = { label: "stretta", css: "tight" };
        else if (marginMin <= 15) connState = { label: "buona", css: "good" };
        else connState = { label: "comoda", css: "calm" };
        return `<div class="connection-row">
          <span>${escapeHtml(origin.label)} → ${escapeHtml(getStopName(origin.interchangeStop))}</span>
          <strong>parti ${minsToHHMM(leaveOrigin)} → bus ${minsToHHMM(busAtInterchange)}</strong>
          <em class="${connState.css}">${connState.label}</em>
        </div>`;
      })
      .filter(Boolean)
      .join("");

    // Add station links for return interchanges
    let stationLinks = "";
    const seenLinks = new Set();
    for (const origin of card.returnOrigins || []) {
      const interchange = cfg.interchanges?.[origin.interchangeStop];
      if (interchange?.trainSlot && !seenLinks.has(interchange.trainSlot)) {
        seenLinks.add(interchange.trainSlot);
        const linkHtml = renderStationLink(interchange.trainSlot, cfg);
        if (linkHtml) stationLinks += linkHtml;
      }
    }

    return origins
      ? `<div class="connection-box"><h4>Coincidenze stimate${stationLinks}</h4>${origins}</div>`
      : "";
  }

  // ── OUTBOUND: show train/metro connections at destination stops ──
  const rows = [];
  const seen = new Set();
  // Check BOTH detail and compact stops for connections (deduplicated)
  const connectionStops = [...new Set([...(card.detailStops || []), ...(card.compactStops || [])])];

  for (const code of connectionStops) {
    const arrMin = trip.stops?.[code];
    const interchange = cfg.interchanges?.[code];
    if (arrMin === undefined || arrMin === null || !interchange) continue;
    if (seen.has(interchange.label)) continue;
    seen.add(interchange.label);

    if (interchange.trainSlot) {
      // Primary train connection (S5)
      const train = calcNextTrain(interchange.trainSlot, arrMin)[0];
      if (train) {
        const state = getConnectionState(train.waitMin, cfg);
        rows.push(`<div class="connection-row">
          <span>${escapeHtml(interchange.label)} · ${escapeHtml(train.line)}${train.note ? ` <small>${escapeHtml(train.note)}</small>` : ""}</span>
          <strong>${minsToHHMM(train.departureMin)} (+${train.waitMin} min)</strong>
          <em class="${state.css}">${state.label}</em>
        </div>`);
      }
      // Secondary train connection (RE) if available
      if (interchange.trainSlotRE) {
        const trainRE = calcNextTrain(interchange.trainSlotRE, arrMin)[0];
        if (trainRE) {
          const stateRE = getConnectionState(trainRE.waitMin, cfg);
          rows.push(`<div class="connection-row">
            <span>${escapeHtml(interchange.label)} · ${escapeHtml(trainRE.line)}${trainRE.note ? ` <small>${escapeHtml(trainRE.note)}</small>` : ""}</span>
            <strong>${minsToHHMM(trainRE.departureMin)} (+${trainRE.waitMin} min)</strong>
            <em class="${stateRE.css}">${stateRE.label}</em>
          </div>`);
        }
      }
    } else if (interchange.type === "M1") {
      rows.push(`<div class="connection-row">
        <span>${escapeHtml(interchange.label)}</span>
        <strong>M1</strong>
      </div>`);
    }
  }

  if (!rows.length) return "";

  // Collect station links for outbound connections
  let stationLinks = "";
  const seenLinks = new Set();
  for (const code of connectionStops) {
    const interchange = cfg.interchanges?.[code];
    if (!interchange) continue;
    if (interchange.trainSlot && !seenLinks.has(interchange.trainSlot)) {
      seenLinks.add(interchange.trainSlot);
      stationLinks += renderStationLink(interchange.trainSlot, cfg);
    }
  }

  return `<div class="connection-box"><h4>Coincidenze stimate${stationLinks}</h4>${rows.join("")}</div>`;
}

function renderZ649DestinationEstimates(trip, cfg) {
  const pg = trip.stops?.PG102;
  const md = trip.stops?.MD111;
  const parts = [];
  if (pg !== undefined) {
    const rep = cfg.s5s6_destinations.find(d => d.name === "Repubblica");
    if (rep) {
      const nextTrains = calcNextTrain("PG102", pg, 1);
      if (nextTrains.length > 0) {
        const train = nextTrains[0];
        parts.push(`Repubblica via Pregnana ~${minsToHHMM(train.departureMin + rep.minutesFromPregnana)}`);
      } else {
        parts.push(`Repubblica via Pregnana ~${minsToHHMM(pg + rep.minutesFromPregnana)}`);
      }
    }
  }
  if (md !== undefined) {
    const repM1 = cfg.m1_destinations.find(d => d.id === "repubblica");
    if (repM1) parts.push(`Repubblica via M1 ~${minsToHHMM(md + repM1.minutesFromMolino)}`);
  }
  if (!parts.length) parts.push("Repubblica: questa corsa non mostra una coincidenza utile");
  return `<div class="destination-estimates">${parts.map(escapeHtml).join(" · ")}</div>`;
}

function renderUpcomingTrips(card) {
  if (card.nextTrips.length <= 1) return "";
  return `<div class="next-list">
    <h4>Prossime corse</h4>
    ${card.nextTrips.slice(1).map(t => `<div>
      <span>${minsToHHMM(t._depMin)} da ${escapeHtml(getStopName(t._depStop))}</span>
      <strong>${escapeHtml(t.validity || "")}</strong>
    </div>`).join("")}
  </div>`;
}

function renderRecentlyDepartedBlock(state, lineData, lineConfig, cfg, currentMin, dayType, direction) {
  const recent = [];
  for (const lineId of cfg.lineOrder || []) {
    const profile = getProfile(cfg, lineId);
    const key = getScheduleKey(lineId, dayType, direction);
    const preferred = direction === "return"
      ? profile.returnInterchanges?.[0]
      : getUserFavorite(state, cfg, lineId, "outbound");
    const fallbacks = direction === "return" ? profile.returnInterchanges : profile.outboundHomeStops;
    const departed = getRecentlyDeparted(lineData[lineId]?.[key] || [], currentMin, 30, preferred, fallbacks);
    departed.forEach(t => recent.push({ lineId, depMin: t._depMin, stop: t._depStop, ago: currentMin - t._depMin }));
  }

  // Aggiungi treno Canegrate perso (per l'auto) ma non ancora partito in stazione
  const driveMin = Number(state.settings?.driveCanegrate || cfg.defaults.driveCanegrate);
  const canegrateBlock = buildCanegrateBlock(driveMin, currentMin);
  if (canegrateBlock.justMissedCarTrain) {
    const t = canegrateBlock.justMissedCarTrain;
    recent.push({
      lineId: t.line,
      depMin: t.departureMin,
      stop: "canegrate_fs",
      ago: currentMin - t.departureMin,
      customText: `${minsToHHMM(t.departureMin)} (in stazione tra ${t.departureMin - currentMin} min)`
    });
  }

  recent.sort((a, b) => a.ago - b.ago);
  if (!recent.length) return "";
  return `<section class="recent-section">
    <h3>Partiti di recente</h3>
    ${recent.slice(0, 5).map(r => `<div class="recent-item">
      <span>${r.lineId} · ${r.stop === "canegrate_fs" ? "Canegrate FS" : escapeHtml(getStopName(r.stop))}</span>
      <strong>${r.customText ? r.customText : `${r.ago} min fa`}</strong>
    </div>`).join("")}
  </section>`;
}

function renderCanegrateBlock(state, currentMin, cfg) {
  const driveMin = Number(state.settings?.driveCanegrate || cfg.defaults.driveCanegrate);
  const block = buildCanegrateBlock(driveMin, currentMin);
  const trains = block.trains;
  
  if (!trains.length) return "";

  const firstTrain = trains[0];
  const wait = block.canLeaveIn;
  const urgency = getUrgencyState(wait);
  
  const stationUrl = cfg.canegrate.stationUrl;
  const liveLink = stationUrl ? ` <a href="${escapeHtml(stationUrl)}" target="_blank" rel="noopener" class="station-link" title="Orari tempo reale Canegrate FS">🔴 LIVE</a>` : "";

  const trainChips = trains.slice(0, 2).map(t => `<span class="stop-chip large">
    <small>${escapeHtml(t.line)} da Canegrate</small>
    <strong>${minsToHHMM(t.departureMin)}</strong>
  </span>`).join("");

  const depHHMM = minsToHHMM(firstTrain.departureMin);
  const leaveAtHHMM = minsToHHMM(firstTrain.departureMin - driveMin);

  return `<section class="featured-card ${urgency.css}">
    <div class="featured-top">
      <span class="line-pill" style="background: #3b82f6; color: #fff;">${escapeHtml(firstTrain.line)}</span>
      <span class="status-pill ${urgency.css}">${urgency.label}</span>
    </div>
    <p style="margin-top: 8px; margin-bottom: 4px;">Alternativa Canegrate FS${liveLink}</p>
    <div class="time-info-row" style="border-top: none;">
      <div class="time-block bus">
        <div class="time-block-label bus">Orario Treno</div>
        <h2 style="margin: 0; font-size: 3.5rem;">${depHHMM}</h2>
        <span class="time-block-pill bus">tra ${firstTrain.departureMin - currentMin} min</span>
      </div>
      <div class="time-block walk">
        <div class="time-block-label walk">Uscire di casa</div>
        <h2 style="color: var(--accent); margin: 0; font-size: 2.8rem;">tra ${wait} min</h2>
        <span class="time-block-pill walk">in auto</span>
        <div class="time-block-detail">Uscire alle ${leaveAtHHMM} &middot; in auto ${driveMin} min</div>
      </div>
    </div>
    <div class="stop-chip-row">
      ${trainChips}
    </div>
  </section>`;
}

function bindLiveEvents(container) {
  // Map triggers
  container.querySelectorAll(".map-trigger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMap(btn.dataset.stopCode);
    });
  });

  // Direction toggle
  container.querySelectorAll("[data-dir]").forEach(button => {
    if (button.closest("[data-timetable-direction]")) return;
    button.addEventListener("click", () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      saveSettings({ liveDirection: button.dataset.dir });
    });
  });

  // Card expand/collapse
  container.querySelectorAll("[data-toggle-card]").forEach(button => {
    button.addEventListener("click", () => {
      const card = container.querySelector(`[data-card="${button.dataset.toggleCard}"]`);
      card?.classList.toggle("expanded");
    });
  });

  // Stop search input
  const searchInput = container.querySelector("[data-stop-search]");
  const resultsBox = container.querySelector("[data-stop-results]");
  if (searchInput && resultsBox) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim();
      if (q.length >= 1) {
        resultsBox.innerHTML = buildSearchResults(q);
        resultsBox.classList.add("open");
        // Bind pick events on results
        resultsBox.querySelectorAll("[data-stop-pick]").forEach(btn => {
          btn.addEventListener("click", () => {
            const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
            state.liveStopFilter = btn.dataset.stopPick;
            renderLive(state, lineData, lineConfig, cfg, saveSettings);
          });
        });
      } else {
        resultsBox.innerHTML = "";
        resultsBox.classList.remove("open");
      }
    });
    searchInput.addEventListener("focus", () => {
      if (!searchInput.value && !lastArgs.state.liveStopFilter) {
        // Show all stops on focus when empty
        resultsBox.innerHTML = buildSearchResults(" ");
        resultsBox.classList.add("open");
        resultsBox.querySelectorAll("[data-stop-pick]").forEach(btn => {
          btn.addEventListener("click", () => {
            const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
            state.liveStopFilter = btn.dataset.stopPick;
            renderLive(state, lineData, lineConfig, cfg, saveSettings);
          });
        });
      } else if (searchInput.value) {
        // If has a selected stop, clear text to allow new search
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
    });
    // Close results on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".stop-search-wrapper")) {
        resultsBox.classList.remove("open");
      }
    }, { once: true });
  }

  // Clear stop search
  container.querySelector("[data-stop-search-clear]")?.addEventListener("click", () => {
    const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
    state.liveStopFilter = null;
    renderLive(state, lineData, lineConfig, cfg, saveSettings);
  });

  // Line filter pills
  container.querySelectorAll("[data-line-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      state.liveLineFilter = button.dataset.lineFilter || null;
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    });
  });

  // Clear all filters
  container.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
    state.liveStopFilter = null;
    state.liveLineFilter = null;
    renderLive(state, lineData, lineConfig, cfg, saveSettings);
  });

  // Dismiss strike alert banners
  container.querySelectorAll("[data-dismiss-alert]").forEach(btn => {
    btn.addEventListener("click", () => {
      dismissAlert(btn.dataset.dismissAlert);
      const banner = btn.closest(".alert-strike-banner");
      if (banner) banner.remove();
    });
  });
}
