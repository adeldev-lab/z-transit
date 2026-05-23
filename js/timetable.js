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

export function renderTimetable(state, lineData, lineConfig, cfg, saveSettings) {
  lastArgs = { state, lineData, lineConfig, cfg, saveSettings };
  const container = document.getElementById("timetable-content");
  if (!container) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = state.timetableDayType || getDayType(now, cfg);
  const baseDirection = state.timetableDirection || "outbound";
  const direction = state.settings?.invertDirections
    ? (baseDirection === "outbound" ? "return" : "outbound")
    : baseDirection;

  // Calculate customized/followed lines active in the focus city, matching renderLive in live.js.
  // This ensures the custom visible lines are synchronized between the LIVE and TIMETABLE tabs.
  const focusCity = state.settings?.focusCity || cfg.defaults?.focusCity || 'BT';
  const followedForCity = state.settings?.followedLinesByCity?.[focusCity];
  const userActiveLines = state.settings?.userProfile?.activeLines;
  const cityLines = cfg.lineOrder || Object.keys(lineConfig);

  let activeLineOrder;
  const hasCustomLines = Array.isArray(followedForCity) || (Array.isArray(userActiveLines) && userActiveLines.length > 0 && !state.settings?.userProfile?.skipped && focusCity === (state.settings?.userProfile?.focusCity || 'BT'));

  let defaultActiveLineOrder;
  if (Array.isArray(followedForCity)) {
    defaultActiveLineOrder = followedForCity.filter(id => lineConfig[id]);
  } else if (Array.isArray(userActiveLines) && userActiveLines.length > 0 
             && !state.settings?.userProfile?.skipped
             && focusCity === (state.settings?.userProfile?.focusCity || 'BT')) {
    defaultActiveLineOrder = cityLines.filter(id => userActiveLines.includes(id));
  } else {
    defaultActiveLineOrder = cityLines;
  }

  if (state.timetableShowAllLines) {
    activeLineOrder = Object.keys(lineConfig).sort();
  } else {
    activeLineOrder = defaultActiveLineOrder;
  }

  const cityOrCustomLinesCount = defaultActiveLineOrder.length;

  const activeLine = state.timetableLine || activeLineOrder?.[0] || cfg.lineOrder?.[0] || "Z649";
  const config = lineConfig[activeLine];

  if (!config) {
    patchDOM(container, `<div class="empty-state">Seleziona una linea</div>`);
    return;
  }

  // If line data hasn't been loaded yet, show a loading message
  if (!lineData[activeLine]) {
    patchDOM(container, `<div class="empty-state">Dati della linea ${escapeHtml(activeLine)} non ancora caricati. Prova a cambiare città nelle Impostazioni.</div>`);
    return;
  }

  const scheduleKey = getScheduleKey(activeLine, dayType, direction);
  const trips = [...(lineData[activeLine]?.[scheduleKey] || [])];

  // Initialize timetableTempStops if in edit mode and not yet set
  if (state.timetableEditMode && !state.timetableTempStops) {
    const currentStops = state.settings?.timetableStops?.[activeLine]?.[scheduleKey]
      || state.settings?.timetableStops?.[activeLine]?.[direction]
      || getVisibleStops(state, cfg, activeLine, scheduleKey, direction, config.referenceStops || []);
    state.timetableTempStops = [...currentStops];
  }

  let stops;
  if (state.timetableEditMode) {
    const allStopsForDir = [];
    const dayTypes = ["weekday", "saturday", "sunday"];
    for (const dt of dayTypes) {
      const key = getScheduleKey(activeLine, dt, direction);
      const dtTrips = lineData[activeLine]?.[key] || [];
      for (const trip of dtTrips) {
        for (const stopCode of Object.keys(trip.stops || {})) {
          if (!allStopsForDir.includes(stopCode)) {
            allStopsForDir.push(stopCode);
          }
        }
      }
    }
    stops = allStopsForDir;
  } else if (state.showAllStops) {
    stops = getAllStopsOrdered(trips);
  } else {
    stops = getVisibleStops(state, cfg, activeLine, scheduleKey, direction, config.referenceStops || []);
  }

  // "Hide empty stops" banner and filtering logic (only active when not editing and not showing all stops)
  let emptyStopsBanner = "";
  if (!state.timetableEditMode && !state.showAllStops && trips.length > 0 && stops.length > 0) {
    const emptyStops = stops.filter(code => {
      return trips.every(trip => trip.stops?.[code] === undefined || trip.stops?.[code] === null);
    });
    
    if (emptyStops.length > 0) {
      if (!state.showEmptyStops) {
        stops = stops.filter(code => !emptyStops.includes(code));
        emptyStopsBanner = `
          <div class="empty-stops-indicator" style="margin: 10px 0; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--line); border-radius: var(--radius); font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: var(--muted);"><span style="margin-right: 4px;">🛈</span><strong>${emptyStops.length}</strong> ${emptyStops.length === 1 ? 'colonna vuota nascosta' : 'colonne vuote nascoste'} (senza corse oggi)</span>
            <button type="button" class="text-btn" id="toggle-empty-stops" style="font-weight: 700; color: var(--accent); font-size: 0.8rem; background: none; border: none; cursor: pointer; padding: 0;">Mostra tutto</button>
          </div>
        `;
      } else {
        emptyStopsBanner = `
          <div class="empty-stops-indicator" style="margin: 10px 0; padding: 10px 14px; background: rgba(var(--accent-rgb), 0.05); border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: var(--radius); font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="color: var(--accent);"><span style="margin-right: 4px;">🛈</span>Mostrate <strong>${emptyStops.length}</strong> ${emptyStops.length === 1 ? 'colonna vuota' : 'colonne vuote'}</span>
            <button type="button" class="text-btn" id="toggle-empty-stops" style="font-weight: 700; color: var(--accent); font-size: 0.8rem; background: none; border: none; cursor: pointer; padding: 0;">Nascondi vuote</button>
          </div>
        `;
      }
    }
  }

  const referenceStops = getReferenceStops(state, cfg, activeLine, direction, stops);
  const sortedTrips = trips
    .map(trip => ({ ...trip, _refMin: getReferenceTime(trip, referenceStops) }))
    .sort((a, b) => (a._refMin ?? Number.POSITIVE_INFINITY) - (b._refMin ?? Number.POSITIVE_INFINITY));

  // Edit Button HTML
  const editButtonHtml = state.showAllStops
    ? ""
    : (state.timetableEditMode
        ? `
          <button type="button" class="btn-premium" id="save-timetable-stops" style="background: rgba(52,211,153,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.3); font-weight: 700;">Salva ✓</button>
          <button type="button" class="btn-premium" id="cancel-timetable-stops" style="background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.3); font-weight: 700;">Annulla ×</button>
        `
        : `
          <button type="button" class="btn-premium" id="edit-timetable-stops" title="Personalizza colonne fermate per questa direzione">✏️ Modifica Fermate</button>
        `
      );

  let html = `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Orari linea</p>
          <h2>${escapeHtml(config.label)}</h2>
          <p>${escapeHtml(config.notes || "")}</p>
        </div>
      </div>
      <div class="line-tabs line-tabs-scroll">
        ${activeLineOrder
          .filter(lineId => lineConfig[lineId])
          .map(lineId => {
            const isOutsideCity = !((cfg.lineOrder || []).includes(lineId));
            return `<button type="button" data-line="${lineId}" class="${lineId === activeLine ? "active" : ""}${isOutsideCity ? " line-outside" : ""}" title="${escapeHtml(lineConfig[lineId]?.label || lineId)}">${lineId}</button>`;
          }).join("")}
        <button type="button" class="btn-premium ${state.showAllStops ? "active" : ""}" id="toggle-all-stops">
          ${state.showAllStops ? "Solo preferite" : "Tutte le fermate"}
        </button>
      </div>
      <button type="button" class="text-btn line-scope-toggle" data-toggle-timetable-all-lines>
        ${state.timetableShowAllLines
          ? `← Solo ${hasCustomLines ? "linee personalizzate" : (cfg.activeCityConfig?.name || "la mia città")} (${cityOrCustomLinesCount})`
          : `Mostra tutte le linee (${Object.keys(lineConfig).length}) →`}
      </button>
      <div class="filter-row">
        ${["weekday", "saturday", "sunday"].map(dt => {
          const key = getScheduleKey(activeLine, dt, direction);
          const disabled = !(lineData[activeLine]?.[key]?.length);
          return `<button type="button" data-day="${dt}" class="${dayType === dt ? "active" : ""}" ${disabled ? "disabled" : ""}>${getDayTypeLabel(dt)}</button>`;
        }).join("")}
        ${editButtonHtml}
      </div>
      <div class="segmented wide" data-timetable-direction>
        <button type="button" data-dir="outbound" class="${baseDirection === "outbound" ? "active" : ""}">Andata</button>
        <button type="button" data-dir="return" class="${baseDirection === "return" ? "active" : ""}">Ritorno</button>
      </div>
    </section>`;

  if (!trips.length && !state.timetableEditMode) {
    html += `<div class="empty-state">Nessun orario per ${getDayTypeLabel(dayType).toLowerCase()} in questa direzione.</div>`;
    patchDOM(container, html, { onAfterPatch: () => bindEvents(container, saveSettings) });
    return;
  }

  html += emptyStopsBanner;

  html += `<div class="table-card">
    <div class="table-scroll">
      <table class="timetable">
        <thead>
          <tr>
            <th>Corsa</th>
            ${stops.map(code => {
              const hasCoords = !!STOP_COORDINATES[code];
              const label = escapeHtml(shortStop(code));
              
              if (state.timetableEditMode) {
                const isSelected = state.timetableTempStops.includes(code);
                const badge = isSelected
                  ? `<span class="stop-edit-badge remove" title="Nascondi questa fermata">−</span>`
                  : `<span class="stop-edit-badge add" title="Mostra questa fermata">+</span>`;
                const colClass = isSelected ? "edit-col" : "edit-col hidden-col";
                return `<th title="${escapeHtml(getStopName(code))} [${code}]" class="${colClass}" data-edit-stop-code="${code}">${label}${badge}</th>`;
              }
              
              const hasCoordsClass = hasCoords ? "stop-link" : "";
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
        const displayValue = value !== undefined && value !== null ? minsToHHMM(value) : "-";
        
        if (state.timetableEditMode) {
          const isSelected = state.timetableTempStops.includes(code);
          const colClass = isSelected ? "edit-cell" : "edit-cell hidden-col";
          return `<td class="${colClass}">${displayValue}</td>`;
        }
        return `<td>${displayValue}</td>`;
      }).join("")}
      <td>${renderConnectionCell(trip, config)}</td>
    </tr>`;
  });

  const feedValidityStr = cfg.feedValidity
    ? `Orari validi dal ${formatFeedDate(cfg.feedValidity.from)} al ${formatFeedDate(cfg.feedValidity.to)}`
    : "";

  html += `</tbody></table></div></div>
    <div class="app-footer">Fermate visibili personalizzabili in Impostazioni.</div>
    ${feedValidityStr ? `<div class="app-footer feed-validity">${escapeHtml(feedValidityStr)}</div>` : ""}`;

  patchDOM(container, html, { onAfterPatch: () => bindEvents(container, saveSettings) });
}

function getVisibleStops(state, cfg, lineId, scheduleKey, direction, fallback) {
  const fromSettings = state.settings?.timetableStops?.[lineId]?.[scheduleKey]
    || state.settings?.timetableStops?.[lineId]?.[direction];
  if (fromSettings?.length) return fromSettings;
  const defaults = cfg.stopProfiles?.[lineId]?.timetableStops?.[scheduleKey]
    || cfg.stopProfiles?.[lineId]?.timetableStops?.[direction]
    || cfg.displayStopsOverrides?.[lineId]?.[scheduleKey]
    || cfg.displayStopsOverrides?.[lineId]?.[direction]
    || fallback;
  // If the user has a favorite stop that differs from the first column,
  // substitute it so the timetable reflects their chosen departure point.
  const userFav = state.settings?.favoriteStops?.[lineId]?.[direction];
  const cfgFav = cfg.favoriteStops?.[lineId]?.[direction];
  if (userFav && userFav !== cfgFav && defaults?.length > 0) {
    const result = [...defaults];
    // Replace the config's default home stop (first column) with the user's choice
    if (cfgFav && result.includes(cfgFav) && !result.includes(userFav)) {
      result[result.indexOf(cfgFav)] = userFav;
    } else if (!result.includes(userFav)) {
      result[0] = userFav;
    }
    return result;
  }
  return defaults;
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
  let name = getStopName(code)
    .replace(/^Busto G\.\s*/, "")
    .replace(/^Busto A\.\s*/, "B.A. ")
    .replace(/^Pregnana\s*/, "Pregn. ")
    .replace(/^Villa Cortese\s*/, "V.C. ")
    .replace(/^Villa C\.\s*/, "V.C. ")
    .replace(/^Castano P\.\s*/, "Cast. ")
    .replace(/^Milano\s*/, "MI ")
    .replace(/^Legnano\s*/, "Legn. ")
    .replace(/^Parabiago\s*/, "Parab. ")
    .replace(/^S\. Giorgio\s*/, "S.G. ")
    .replace(/^S\. Stefano\s*/, "S.St. ")
    .replace(/^Vighignolo\s*/, "Vigh. ")
    .replace(/^Settimo\s*/, "Sett. ")
    .replace(/^Rho\s*/, "Rho ")
    .replace(/^Nerviano\s*/, "Nerv. ")
    .replace(/^Cornaredo\s*/, "Corn. ")
    .replace(/^Magenta\s*/, "Mag. ")
    .replace(/^Corbetta\s*/, "Corb. ")
    .replace(/^Vittuone\s*/, "Vitt. ")
    .replace(/^Sedriano\s*/, "Sedr. ")
    .replace(/^Bareggio\s*/, "Bar. ")
    .replace(/^Canegrate\s*/, "Can. ")
    .replace(/^Cerro M\.\s*/, "Cerro ")
    .replace(/^Lainate\s*/, "Lain. ")
    .replace(/^Origgio\s*/, "Orig. ")
    .replace(/^Pogliano\s*/, "Pogl. ")
    .replace(/^Pero\s*/, "Pero ")
    .replace(/^Inveruno\s*/, "Inv. ")
    .replace(/^Cuggiono\s*/, "Cugg. ")
    .replace(/^Turbigo\s*/, "Turb. ")
    .replace(/^Bernate T\.\s*/, "Bern. ")
    .replace(/^Marcallo\s*/, "Marc. ")
    .replace(/^S\.V\. Olona\s*/, "SVO ")
    .replace(/^Vanzago\s*/, "Vanz. ")
    .replace(/^Arluno\s*/, "Arl. ")
    .replace(/^Ossona\s*/, "Oss. ")
    .replace(/^Casorezzo\s*/, "Cas. ")
    .replace(/^Dairago\s*/, "Dair. ")
    .replace(/^Arconate\s*/, "Arc. ");

  const CITY_ABBREVIATIONS = {
    BT: { canonical: "B.G.", patterns: ["B.G.", "BG", "Busto Garolfo", "Busto G."] },
    OC: { canonical: "B.G.", patterns: ["B.G.", "BG", "Busto Garolfo", "Busto G.", "Olcella"] },
    VC: { canonical: "V.C.", patterns: ["V.C.", "VC", "Villa Cortese", "Villa C."] },
    DG: { canonical: "Dair.", patterns: ["Dair.", "DG", "Dairago"] },
    AC: { canonical: "Arc.", patterns: ["Arc.", "AC", "Arconate"] },
    CZ: { canonical: "Cas.", patterns: ["Cas.", "CZ", "Casorezzo"] },
    LG: { canonical: "Legn.", patterns: ["Legn.", "LG", "Legnano"] },
    PB: { canonical: "Parab.", patterns: ["Parab.", "PB", "Parabiago"] },
    VP: { canonical: "Parab.", patterns: ["Parab.", "VP", "Parabiago"] },
    VS: { canonical: "Parab.", patterns: ["Parab.", "VS", "Parabiago"] },
    BS: { canonical: "B.A.", patterns: ["B.A.", "BS", "Busto Arsizio", "Busto A."] },
    AL: { canonical: "Arl.", patterns: ["Arl.", "AL", "Arluno"] },
    RG: { canonical: "Arl.", patterns: ["Arl.", "RG", "Arluno", "Rogorotto"] },
    BA: { canonical: "Bar.", patterns: ["Bar.", "BA", "Bareggio"] },
    BC: { canonical: "Bus.", patterns: ["Bus.", "BC", "Buscate"] },
    BE: { canonical: "Bern.", patterns: ["Bern.", "BE", "Bernate"] },
    BF: { canonical: "Boff.", patterns: ["Boff.", "BF", "Boffalora"] },
    BI: { canonical: "Magn.", patterns: ["Magn.", "BI", "Magnago"] },
    MM: { canonical: "Magn.", patterns: ["Magn.", "MM", "Magnago"] },
    BR: { canonical: "Lain.", patterns: ["Lain.", "BR", "Lainate", "Barbaiana"] },
    LN: { canonical: "Lain.", patterns: ["Lain.", "LN", "Lainate"] },
    CB: { canonical: "Corb.", patterns: ["Corb.", "CB", "Corbetta"] },
    CD: { canonical: "Corn.", patterns: ["Corn.", "CD", "Cornaredo"] },
    CG: { canonical: "Cugg.", patterns: ["Cugg.", "CG", "Cuggiono"] },
    CL: { canonical: "Cerro", patterns: ["Cerro", "CL", "Cerro Maggiore", "Cantalupo"] },
    CR: { canonical: "Cerro", patterns: ["Cerro", "CR", "Cerro Maggiore"] },
    CN: { canonical: "Can.", patterns: ["Can.", "CN", "Canegrate"] },
    CT: { canonical: "Cast.", patterns: ["Cast.", "CT", "Castano"] },
    GB: { canonical: "Nerv.", patterns: ["Nerv.", "GB", "Nerviano", "Garbatola"] },
    NR: { canonical: "Nerv.", patterns: ["Nerv.", "NR", "Nerviano"] },
    SI: { canonical: "Nerv.", patterns: ["Nerv.", "SI", "Nerviano", "S. Ilario"] },
    VL: { canonical: "Nerv.", patterns: ["Nerv.", "VL", "Nerviano"] },
    IN: { canonical: "Inv.", patterns: ["Inv.", "IN", "Inveruno"] },
    MC: { canonical: "Marc.", patterns: ["Marc.", "MC", "Marcallo"] },
    MD: { canonical: "MI", patterns: ["MI", "MD", "Milano", "Molino Dorino"] },
    ML: { canonical: "MI", patterns: ["MI", "ML", "Milano"] },
    MG: { canonical: "Mag.", patterns: ["Mag.", "MG", "Magenta"] },
    MN: { canonical: "Vanz.", patterns: ["Vanz.", "MN", "Vanzago", "Mantegazza"] },
    VZ: { canonical: "Vanz.", patterns: ["Vanz.", "VZ", "Vanzago"] },
    MS: { canonical: "Mesero", patterns: ["Mesero", "MS"] },
    NS: { canonical: "Nosate", patterns: ["Nosate", "NS"] },
    OR: { canonical: "Orig.", patterns: ["Orig.", "OR", "Origgio"] },
    OS: { canonical: "Oss.", patterns: ["Oss.", "OS", "Ossona"] },
    PG: { canonical: "Pregn.", patterns: ["Pregn.", "PG", "Pregnana"] },
    PM: { canonical: "Pogl.", patterns: ["Pogl.", "PM", "Pogliano"] },
    PR: { canonical: "Pero", patterns: ["Pero", "PR"] },
    RB: { canonical: "Rob.", patterns: ["Rob.", "RB", "Robecchetto"] },
    RH: { canonical: "Rho", patterns: ["Rho", "RH"] },
    SD: { canonical: "Sedr.", patterns: ["Sedr.", "SD", "Sedriano"] },
    SG: { canonical: "S.G.", patterns: ["S.G.", "SG", "S. Giorgio"] },
    SV: { canonical: "SVO", patterns: ["SVO", "SV", "S.V. Olona"] },
    TB: { canonical: "Turb.", patterns: ["Turb.", "TB", "Turbigo"] },
    TI: { canonical: "S.St.", patterns: ["S.St.", "TI", "S. Stefano"] },
    TM: { canonical: "Sett.", patterns: ["Sett.", "TM", "Settimo"] },
    VH: { canonical: "Vigh.", patterns: ["Vigh.", "VH", "Vighignolo"] },
    VT: { canonical: "Vitt.", patterns: ["Vitt.", "VT", "Vittuone"] },
    VN: { canonical: "Vanzag.", patterns: ["Vanzag.", "VN", "Vanzaghello"] }
  };

  if (code && typeof code === "string") {
    const prefix = code.substring(0, 2).toUpperCase();
    const cityInfo = CITY_ABBREVIATIONS[prefix];
    if (cityInfo) {
      const lowerName = name.toLowerCase();
      const alreadyHasAcronym = cityInfo.patterns.some(pattern => {
        const lowerPattern = pattern.toLowerCase();
        return lowerName.startsWith(lowerPattern) || lowerName.includes(lowerPattern);
      });

      if (!alreadyHasAcronym) {
        name = `${cityInfo.canonical} ${name}`;
      }
    }
  }

  return name;
}

function bindEvents(container, saveSettingsParam) {
  const { state, lineData, lineConfig, cfg, saveSettings: lastSaveSettings } = lastArgs;
  const saveSettings = saveSettingsParam || lastSaveSettings;
  container.querySelectorAll("[data-line]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", async () => {
      const lineId = button.dataset.line;
      // Lazy-load line data if not already loaded
      if (!lineData[lineId] && lineConfig[lineId]) {
        try {
          const { loadSingleLine } = await import("./line-registry.js");
          const data = await loadSingleLine(lineId);
          if (data) lineData[lineId] = data;
        } catch (e) {
          console.error(`[Trasporti] Errore caricamento ${lineId}:`, e);
        }
      }
      state.timetableLine = lineId;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  });
  container.querySelectorAll("[data-day]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.timetableDayType = button.dataset.day;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  });
  container.querySelectorAll("[data-timetable-direction] [data-dir]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.timetableDirection = button.dataset.dir;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  });
  container.querySelectorAll("th.stop-link[data-stop-code]").forEach(th => {
    if (th.__has_map_click) return;
    th.__has_map_click = true;
    th.addEventListener("click", (e) => {
      if (state.timetableEditMode) return;
      openMap(th.dataset.stopCode);
    });
  });
  const premiumBtn = container.querySelector("#toggle-all-stops");
  if (premiumBtn && !premiumBtn.__has_click) {
    premiumBtn.__has_click = true;
    premiumBtn.addEventListener("click", () => {
      state.showAllStops = !state.showAllStops;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Toggle "Show all lines" in timetable
  const toggleAllLinesBtn = container.querySelector("[data-toggle-timetable-all-lines]");
  if (toggleAllLinesBtn && !toggleAllLinesBtn.__has_click) {
    toggleAllLinesBtn.__has_click = true;
    toggleAllLinesBtn.addEventListener("click", async () => {
      state.timetableShowAllLines = !state.timetableShowAllLines;
      if (state.timetableShowAllLines) {
        // Load all lines on demand
        try {
          const { loadLines, getCachedLineData } = await import("./line-registry.js");
          await loadLines(Object.keys(lineConfig));
          Object.assign(lineData, getCachedLineData());
        } catch (e) {
          console.error("[Trasporti] Errore caricamento tutte le linee:", e);
        }
      }
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Modifica (Edit Mode) button click
  const editBtn = container.querySelector("#edit-timetable-stops");
  if (editBtn && !editBtn.__has_click) {
    editBtn.__has_click = true;
    editBtn.addEventListener("click", () => {
      const activeLine = state.timetableLine || cfg.lineOrder?.[0] || "Z649";
      const dayType = state.timetableDayType || getDayType(new Date(), cfg);
      const baseDirection = state.timetableDirection || "outbound";
      const direction = state.settings?.invertDirections
        ? (baseDirection === "outbound" ? "return" : "outbound")
        : baseDirection;
      const scheduleKey = getScheduleKey(activeLine, dayType, direction);
      
      const currentStops = state.settings?.timetableStops?.[activeLine]?.[scheduleKey]
        || state.settings?.timetableStops?.[activeLine]?.[direction]
        || getVisibleStops(state, cfg, activeLine, scheduleKey, direction, lineConfig[activeLine]?.referenceStops || []);
      
      state.timetableTempStops = [...currentStops];
      state.timetableEditMode = true;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Cancel button click
  const cancelBtn = container.querySelector("#cancel-timetable-stops");
  if (cancelBtn && !cancelBtn.__has_click) {
    cancelBtn.__has_click = true;
    cancelBtn.addEventListener("click", () => {
      state.timetableEditMode = false;
      delete state.timetableTempStops;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Save button click
  const saveBtn = container.querySelector("#save-timetable-stops");
  if (saveBtn && !saveBtn.__has_click) {
    saveBtn.__has_click = true;
    saveBtn.addEventListener("click", () => {
      const timetableStops = structuredClone(state.settings.timetableStops || {});
      const activeLine = state.timetableLine || cfg.lineOrder?.[0] || "Z649";
      const baseDirection = state.timetableDirection || "outbound";
      const direction = state.settings?.invertDirections
        ? (baseDirection === "outbound" ? "return" : "outbound")
        : baseDirection;
      if (!timetableStops[activeLine]) {
        timetableStops[activeLine] = {};
      }
      // Apply to all dayTypes for the active direction
      for (const dt of ["weekday", "saturday", "sunday"]) {
        const key = getScheduleKey(activeLine, dt, direction);
        timetableStops[activeLine][key] = [...state.timetableTempStops];
      }
      
      // Update state before saveSettings so that the reactive render is triggered on non-edit mode!
      state.timetableEditMode = false;
      delete state.timetableTempStops;

      if (saveSettings) {
        saveSettings({ timetableStops });
      } else {
        renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
      }
    });
  }

  container.querySelectorAll("th.edit-col[data-edit-stop-code]").forEach(th => {
    if (th.__has_edit_click) return;
    th.__has_edit_click = true;
    th.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.stopImmediatePropagation();
      const code = th.dataset.editStopCode;
      const idx = state.timetableTempStops.indexOf(code);
      if (idx > -1) {
        if (state.timetableTempStops.length <= 1) {
          alert("La tabella deve contenere almeno una fermata visibile.");
          return;
        }
        state.timetableTempStops.splice(idx, 1);
      } else {
        state.timetableTempStops.push(code);
      }
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
    });
  });

  // Toggle empty stops banner click
  const toggleEmptyStopsBtn = container.querySelector("#toggle-empty-stops");
  if (toggleEmptyStopsBtn && !toggleEmptyStopsBtn.__has_click) {
    toggleEmptyStopsBtn.__has_click = true;
    toggleEmptyStopsBtn.addEventListener("click", () => {
      state.showEmptyStops = !state.showEmptyStops;
      renderTimetable(state, lineData, lineConfig, cfg, saveSettings);
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

/**
 * Format a feed validity date (YYYY-MM-DD) to a readable Italian string.
 * e.g. "2026-03-02" → "2 marzo 2026"
 */
function formatFeedDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  } catch (e) {
    return dateStr;
  }
}
