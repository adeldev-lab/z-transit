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

import { calcNextTrain, buildCanegrateBlock, calcNextTrainFromGTFS, buildTrainStationBlock } from "./trains.js";
import { TRAIN_STATIONS, TRAIN_ROUTES } from "../data/trains.js";
import { getStopName, STOP_NAMES, RETURN_DESTINATIONS } from "./line-config.js";
import { openMap } from "./map.js";
import { STOP_COORDINATES } from "./map-data.js";
import { patchDOM } from "./dom-utils.js";
import { renderStrikeBanner, dismissAlert } from "./alerts.js";

// Cities ordered for the stop filter dropdown (all cities in the network)
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
  { prefix: "CN", label: "Canegrate" },
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
  { prefix: "CT", label: "Castano Primo" },
  { prefix: "RH", label: "Rho" },
  { prefix: "NR", label: "Nerviano" },
  { prefix: "SV", label: "S. Vittore Olona" },
  { prefix: "CR", label: "Cerro Maggiore" },
  { prefix: "CL", label: "Cantalupo" },
  { prefix: "LN", label: "Lainate" },
  { prefix: "OR", label: "Origgio" },
  { prefix: "PM", label: "Pogliano Milanese" },
  { prefix: "PR", label: "Pero" },
  { prefix: "VT", label: "Vittuone" },
  { prefix: "SD", label: "Sedriano" },
  { prefix: "BA", label: "Bareggio" },
  { prefix: "VZ", label: "Vanzago" },
  { prefix: "TB", label: "Turbigo" },
  { prefix: "NS", label: "Nosate" },
  { prefix: "VN", label: "Vanzaghello" },
  { prefix: "BE", label: "Bernate Ticino" },
  { prefix: "BF", label: "Boffalora" },
  { prefix: "RB", label: "Robecchetto" },
  { prefix: "MC", label: "Marcallo" },
  { prefix: "MS", label: "Mesero" },
  { prefix: "MM", label: "Magnago" },
  { prefix: "BI", label: "Magnago (Bienate)" },
  { prefix: "ML", label: "Milano" },
  { prefix: "TM", label: "Settimo Milanese" },
  { prefix: "SI", label: "S. Ilario Milanese" },
  { prefix: "AR", label: "Arese" },
  { prefix: "BR", label: "Barbaiana/Lainate" },
  { prefix: "VP", label: "Villastanza" },
  { prefix: "VS", label: "S. Sebastiano" }
];

let lastArgs = null;

export function renderLive(state, lineData, lineConfig, cfg, saveSettings) {
  lastArgs = { state, lineData, lineConfig, cfg, saveSettings };
  const container = document.getElementById("live-content");
  if (!container) return;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = getDayType(now, cfg);
  const baseDirection = state.settings.liveDirection || cfg.defaults.liveDirection || "outbound";
  const direction = state.settings?.invertDirections
    ? (baseDirection === "outbound" ? "return" : "outbound")
    : baseDirection;
  const allLines = Object.keys(lineConfig);
  const cityLines = cfg.lineOrder || allLines;
  const showAllLines = !!state.showAllLines;
  // If user toggled "show all lines", use full set; otherwise use city-specific
  // and apply userProfile.activeLines filter if onboarding chose specific lines.
  const userActiveLines = state.settings?.userProfile?.activeLines;
  const focusCity = state.settings?.focusCity || cfg.defaults?.focusCity || 'BT';
  const followedForCity = state.settings?.followedLinesByCity?.[focusCity];

  let lineOrder;
  if (showAllLines) {
    lineOrder = allLines;
  } else if (Array.isArray(followedForCity)) {
    lineOrder = followedForCity.filter(id => lineConfig[id]);
  } else if (Array.isArray(userActiveLines) && userActiveLines.length > 0 
             && !state.settings?.userProfile?.skipped
             && focusCity === (state.settings?.userProfile?.focusCity || 'BT')) {
    lineOrder = cityLines.filter(id => userActiveLines.includes(id));
  } else {
    lineOrder = cityLines;
  }

  const stopFilter = state.liveStopFilter || null;
  const lineFilter = state.liveLineFilter || null;

  // Dynamic title based on focus city and inversion preference
  const cityName = cfg.activeCityConfig?.name || cfg.homeProfile?.address || "Busto Garolfo";
  const title = baseDirection === "return"
    ? (state.settings?.invertDirections ? `Ritorno da ${cityName}` : `Ritorno verso ${cityName}`)
    : (state.settings?.invertDirections ? `Andata verso ${cityName}` : `Andata da ${cityName}`);
  const subtitle = baseDirection === "return"
    ? "Interscambi e fermate di ritorno verso casa."
    : "Fermate preferite con fallback automatico per ogni linea.";

  let html = `
    <section class="hero-panel">
      <div style="flex: 1; min-width: 250px;">
        <p class="section-eyebrow">${escapeHtml(cfg.homeProfile.address)}</p>
        <h2 style="display: flex; align-items: center; gap: 8px;">
          ${title}
          <button type="button" class="live-customize-trigger" title="Personalizza scheda LIVE" aria-label="Personalizza scheda LIVE">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </h2>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="segmented" data-live-direction>
        <button type="button" data-dir="outbound" class="${baseDirection === "outbound" ? "active" : ""}">Andata</button>
        <button type="button" data-dir="return" class="${baseDirection === "return" ? "active" : ""}">Ritorno</button>
      </div>
    </section>`;

  const followedLineOrder = Array.isArray(followedForCity)
    ? followedForCity.filter(id => lineConfig[id])
    : (Array.isArray(userActiveLines) && userActiveLines.length > 0 
       && !state.settings?.userProfile?.skipped
       && focusCity === (state.settings?.userProfile?.focusCity || 'BT')
       ? cityLines.filter(id => userActiveLines.includes(id))
       : cityLines);

  html += renderFilterBar(lineConfig, cfg, stopFilter, lineFilter, showAllLines, followedLineOrder);

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
      const heroCode = state.settings.liveHero || "Z649";
      if (!heroCode.endsWith("_FS")) {
        const hero = cards.find(card => card.lineId === heroCode && card.hasTrips);
        if (hero) {
          try {
            html += renderFeaturedCard(hero, direction, cfg, currentMin, state);
          } catch (e) {
            console.error("[Trasporti] Errore nel render della featured card:", e);
          }
        }
      } else {
        try {
          html += renderTrainCard(heroCode, state, currentMin, cfg, true);
        } catch (e) {
          console.error("[Trasporti] Errore nel render del treno Hero:", e);
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
  if (!stopFilter) {
    const heroCode = state.settings.liveHero || "Z649";
    const visibleTrains = state.settings.visibleTrains || ["CN_FS"];
    for (const stationCode of visibleTrains) {
      if (stationCode === heroCode) continue; // skip if rendered as Hero!
      try {
        html += renderTrainCard(stationCode, state, currentMin, cfg, false);
      } catch (e) {
        console.error(`[Trasporti] Errore nel render del treno ${stationCode}:`, e);
      }
    }
  }
  
  html += `<div class="app-footer">Dati aggiornati al ${escapeHtml(cfg.lastUpdate)}. Coincidenze treno/metro stimate.</div>`;

  // Append the slide-up modal HTML
  const heroCode = state.settings.liveHero || "Z649";
  const visibleTrains = state.settings.visibleTrains || ["CN_FS"];

  // Options for the Home Hero dropdown select
  const heroOptions = [
    ...lineOrder.map(id => `<option value="${id}" ${heroCode === id ? "selected" : ""}>Bus ${id} - ${escapeHtml(lineConfig[id]?.destination || id)}</option>`),
    ...Object.entries(TRAIN_STATIONS).map(([code, info]) => `<option value="${code}" ${heroCode === code ? "selected" : ""}>Treno - Stazione di ${escapeHtml(info.name)}</option>`)
  ].join("");

  const trainsCheckboxes = Object.entries(TRAIN_STATIONS).map(([code, info]) => {
    const isChecked = visibleTrains.includes(code);
    return `
      <label>
        <input type="checkbox" name="visibleTrain" value="${code}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(info.name)}</span>
      </label>
    `;
  }).join("");

  const isLineChecked = (lineId) => {
    if (Array.isArray(followedForCity)) {
      return followedForCity.includes(lineId);
    }
    // Fallback: onboarding activeLines if city matches
    const userActiveLines = state.settings?.userProfile?.activeLines;
    if (Array.isArray(userActiveLines) && userActiveLines.length > 0 && !state.settings?.userProfile?.skipped && focusCity === (state.settings?.userProfile?.focusCity || 'BT')) {
      return userActiveLines.includes(lineId);
    }
    // Fallback: is it in cityLines?
    return cityLines.includes(lineId);
  };

  const cityLinesCheckboxes = cityLines.map(id => {
    const isChecked = isLineChecked(id);
    return `
      <label style="padding: 8px 10px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" name="visibleLine" value="${id}" ${isChecked ? "checked" : ""} style="width: 16px; height: 16px;">
        <span>${id}</span>
      </label>
    `;
  }).join("");

  const otherLines = allLines.filter(id => !cityLines.includes(id));
  const otherLinesCheckboxes = otherLines.map(id => {
    const isChecked = isLineChecked(id);
    return `
      <label style="padding: 8px 10px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" name="visibleLine" value="${id}" ${isChecked ? "checked" : ""} style="width: 16px; height: 16px;">
        <span>${id}</span>
      </label>
    `;
  }).join("");

  html += `
    <div id="live-customize-modal" class="live-customize-modal" onclick="event.stopPropagation()">
      <div class="live-customize-sheet" onclick="event.stopPropagation()">
        <div class="live-customize-header">
          <h3>Personalizza LIVE e ORARI</h3>
          <button type="button" class="live-customize-close" aria-label="Chiudi">&times;</button>
        </div>
        <div class="live-customize-body">
          <div class="live-customize-section">
            <label class="section-label">Scheda principale (HERO)</label>
            <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 4px 0;">Scegli quale linea o stazione posizionare in alto come principale.</p>
            <select id="customize-live-hero" style="width:100%; background: var(--input-bg, rgba(255,255,255,0.05)); border: 1px solid var(--line); border-radius: 8px; color: var(--text); padding: 8px 12px;">
              ${heroOptions}
            </select>
          </div>
          <div class="live-customize-section">
            <label class="section-label">Linee bus visibili (LIVE e ORARI)</label>
            <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 4px 0;">Scegli quali linee mostrare nei tab LIVE e ORARI. Puoi aggiungerne o toglierne quante ne vuoi.</p>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--accent); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Suggerite per ${escapeHtml(cityName)}</div>
            <div class="live-customize-trains-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
              ${cityLinesCheckboxes}
            </div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-top: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Altre linee del network</div>
            <div class="live-customize-trains-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(0,0,0,0.15);">
              ${otherLinesCheckboxes}
            </div>
            <div style="margin-top: 6px; display: flex; justify-content: flex-end;">
              <button type="button" class="text-btn" id="reset-live-lines" style="font-size: 0.72rem; font-weight: 700; color: var(--accent); background: none; border: none; cursor: pointer; padding: 0;">Reset ai default della città</button>
            </div>
          </div>
          <div class="live-customize-section">
            <label class="section-label">Stazioni ferroviarie visibili</label>
            <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 4px 0;">Seleziona quali stazioni visualizzare in fondo alla pagina.</p>
            <div class="live-customize-trains-grid">
              ${trainsCheckboxes}
            </div>
          </div>
          <div class="live-customize-section" style="border-top: 1px solid var(--line); padding-top: 12px; margin-top: 12px;">
            <label class="check-row" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="customize-invert-directions" ${state.settings.invertDirections ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px;">
              <span style="font-size: 0.82rem; font-weight: 700; color: var(--text);">Inverti Andata/Ritorno</span>
            </label>
            <p style="font-size: 0.72rem; color: var(--muted); margin: 4px 0 0 0;">Scambia la direzione dei viaggi (Andata mostra il Ritorno e viceversa). Utile per chi abita a Milano.</p>
          </div>
        </div>
        <div class="live-customize-footer">
          <button type="button" class="btn btn-secondary live-customize-close-btn" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">Annulla</button>
          <button type="button" class="btn btn-primary" id="save-live-customization" style="flex: 1; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; background: var(--accent); color: #000; border: none;">Salva modifiche</button>
        </div>
      </div>
    </div>
  `;

  // Capture any dep-stop-select that is currently in edit mode (visible).
  // patchDOM preserves the SELECT's style (via dom-utils fix), but resets the
  // sibling .dep-stop-name-text and .edit-dep-stop-btn back to visible.
  // We save the state here and restore it in onAfterPatch to avoid duplication.
  const activeEdits = [];
  container.querySelectorAll('.dep-stop-select').forEach(sel => {
    if (sel.style.display && sel.style.display !== 'none') {
      activeEdits.push({
        line: sel.dataset.line,
        dir: sel.dataset.dir,
        shownAt: sel.__shown_at || Date.now()
      });
    }
  });

  patchDOM(container, html, { onAfterPatch: () => {
    // Restore active edit states: hide text+btn, keep select visible
    activeEdits.forEach(({ line, dir, shownAt }) => {
      const sel = container.querySelector(`.dep-stop-select[data-line="${line}"][data-dir="${dir}"]`);
      if (sel) {
        const parent = sel.parentElement;
        const staticText = parent?.querySelector('.dep-stop-name-text');
        const editBtn = parent?.querySelector('.edit-dep-stop-btn');
        if (staticText) staticText.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        sel.style.display = 'inline-block';
        sel.__shown_at = shownAt;
      }
    });
    bindLiveEvents(container);
  } });
}

function getSearchHistoryChipsHTML() {
  try {
    const history = JSON.parse(localStorage.getItem("trasporti_search_history") || "[]");
    if (!history.length) return "";
    
    const chips = history.map(code => {
      const name = getStopName(code);
      return `
        <div class="search-chip" data-chip-stop="${code}" title="Filtra per ${escapeHtml(name)}">
          <span>${escapeHtml(name)}</span>
          <button type="button" class="search-chip-delete" data-chip-delete="${code}" aria-label="Elimina dalla cronologia">✕</button>
        </div>
      `;
    }).join("");

    return `
      <div class="search-chips-container">
        <div class="search-chips-title">Ricerche recenti</div>
        <div class="search-chips">${chips}</div>
      </div>
    `;
  } catch (e) {
    return "";
  }
}

function renderFilterBar(lineConfig, cfg, stopFilter, lineFilter, showAllLines, followedLineOrder) {
  const cityLineOrder = followedLineOrder || cfg.lineOrder || Object.keys(lineConfig);
  const allLineIds = Object.keys(lineConfig).sort();
  const lineOrder = showAllLines ? allLineIds : cityLineOrder;
  const inputValue = stopFilter ? getStopName(stopFilter) : "";

  // Build line pills (scrollable for many lines)
  const linePills = [
    `<button type="button" data-line-filter="" class="${!lineFilter ? "active" : ""}">Tutte <small>(${lineOrder.length})</small></button>`,
    ...lineOrder
      .filter(id => lineConfig[id]) // only show lines that have config
      .map(id => {
        const isOutsideCity = !cityLineOrder.includes(id);
        return `<button type="button" data-line-filter="${id}" class="${lineFilter === id ? "active" : ""}${isOutsideCity ? " line-outside" : ""}" title="${lineConfig[id]?.label || id}">${id}</button>`;
      })
  ].join("");

  // Toggle "Show all lines"
  const arrowSvg = showAllLines
    ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 2px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;

  const state = lastArgs.state;
  const focusCity = state.settings?.focusCity || cfg.defaults?.focusCity || 'BT';
  const followedForCity = state.settings?.followedLinesByCity?.[focusCity];
  const userActiveLines = state.settings?.userProfile?.activeLines;
  const hasCustomLines = Array.isArray(followedForCity) || (Array.isArray(userActiveLines) && userActiveLines.length > 0 && !state.settings?.userProfile?.skipped && focusCity === (state.settings?.userProfile?.focusCity || 'BT'));

  const cityOrCustomLabel = hasCustomLines ? "linee personalizzate" : (cfg.activeCityConfig?.name || "la mia città");

  const allLinesToggle = `
    <button type="button" class="text-btn line-scope-toggle" data-toggle-all-lines>
      ${showAllLines ? `${arrowSvg} Solo ${cityOrCustomLabel} (${cityLineOrder.length})` : `Mostra tutte le linee (${allLineIds.length}) ${arrowSvg}`}
    </button>`;

  // Active filter indicator
  let activeInfo = "";
  if (stopFilter || lineFilter) {
    const parts = [];
    if (stopFilter) {
      parts.push(`<span class="active-filter-badge"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> <strong title="${escapeHtml(getStopName(stopFilter))} [${stopFilter}]">${escapeHtml(getStopName(stopFilter))}</strong></span>`);
    }
    if (lineFilter) {
      parts.push(`<span class="active-filter-badge"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 4px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="6" y1="21" x2="6" y2="17"></line><line x1="18" y1="21" x2="18" y2="17"></line><line x1="2" y1="10" x2="22" y2="10"></line></svg> <strong>${lineFilter}</strong></span>`);
    }
    activeInfo = `<div class="filter-active-info">
      <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">${parts.join("")}</div>
      <button type="button" class="text-btn" data-clear-filters>Azzera filtri</button>
    </div>`;
  }

  const fermataSvg = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
  const busSvg = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="6" y1="21" x2="6" y2="17"></line><line x1="18" y1="21" x2="18" y2="17"></line><line x1="2" y1="10" x2="22" y2="10"></line></svg>`;

  const chipsHtml = getSearchHistoryChipsHTML();

  return `<section class="filter-bar">
    <div class="filter-group">
      <span class="filter-label">${fermataSvg} Fermata</span>
      <div class="stop-search-wrapper">
        <svg class="search-input-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" class="stop-search-input" data-stop-search
          placeholder="Cerca fermata..." autocomplete="off"
          value="${escapeHtml(inputValue)}">
        ${stopFilter ? '<button type="button" class="stop-search-clear" data-stop-search-clear>✕</button>' : ""}
        <div class="stop-search-results" data-stop-results></div>
      </div>
      <div id="search-chips-wrapper">${chipsHtml}</div>
    </div>
    <div class="filter-group">
      <span class="filter-label">${busSvg} Linea</span>
      <div class="filter-pills filter-pills-scroll">${linePills}</div>
    </div>
    ${allLinesToggle}
    ${activeInfo}
  </section>`;
}

function buildSearchResults(query) {
  if (!query || query.length < 1) return "";
  const q = query.toLowerCase();
  let html = "";
  for (const { prefix, label } of FILTER_CITY_ORDER) {
    const codes = Object.keys(STOP_NAMES)
      .filter(c => c.startsWith(prefix) && (
        STOP_NAMES[c].toLowerCase().includes(q) ||
        getStopName(c).toLowerCase().includes(q) ||
        c.toLowerCase().includes(q)
      ))
      .sort();
    if (!codes.length) continue;
    html += `<div class="search-group-label">${escapeHtml(label)}</div>`;
    for (const code of codes) {
      html += `<button type="button" class="search-result-item" data-stop-pick="${code}">${escapeHtml(getStopName(code))}</button>`;
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

  const stopCandidates = [...new Set([
    preferred,
    ...(profile.outboundHomeStops || []),
    ...(profile.detailStops?.outbound || []),
    ...(profile.compactStops?.outbound || []),
    ...(config.referenceStops || [])
  ].filter(Boolean))];

  return {
    lineId, config, direction: "outbound",
    hasTrips: nextTrips.length > 0, disrupted,
    validities: unique(trips.map(t => t.validity)),
    nextTrips, trip,
    fromStop: trip?._depStop || preferred || fallbacks[0],
    toStop: compactStops.at(-1),
    compactStops, detailStops, scheduleKey,
    stopCandidates
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

  const stopCandidates = [...new Set([
    preferredInterchange,
    ...(profile.returnInterchanges || []),
    ...(profile.detailStops?.return || []),
    ...(profile.compactStops?.return || [])
  ].filter(Boolean))];

  return {
    lineId, config, direction: "return",
    hasTrips: nextTrips.length > 0, disrupted,
    validities: unique(trips.map(t => t.validity)),
    nextTrips, trip,
    fromStop: trip?._depStop || preferredInterchange,
    toStop: arrival?.stopCode || homeStops[0],
    compactStops, detailStops, scheduleKey,
    returnOrigins: profile.returnConnectionOrigins || [],
    arrival,
    stopCandidates
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
const PIN_SVG = `<svg class="pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
const EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px; vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const CALENDAR_SVG = `<svg class="btn-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;

function renderFeaturedCard(card, direction, cfg, currentMin, state) {
  const trip = card.trip;
  const wait = trip._depMin - currentMin;
  const walkMin = Number(state.settings?.walkRossini || cfg.defaults.walkRossini || 0);
  const busState = getUrgencyState(wait);
  const reachability = direction === "outbound" ? getReachabilityState(wait, walkMin) : busState;
  const urgency = busState.css === "missed" ? busState : reachability;
  const primaryStops = renderStopChips(trip, card.compactStops, "large");
  const returnDest = card.config?.returnDestination || RETURN_DESTINATIONS[card.lineId] || "Busto Garolfo";
  const destination = direction === 'return' ? (card.toStop ? getStopName(card.toStop) : returnDest) : card.config.destination;
  const hasMapPin = card.fromStop && typeof STOP_COORDINATES !== 'undefined' && !!STOP_COORDINATES[card.fromStop];
  const pinHtml = hasMapPin
    ? `<button type="button" class="map-trigger dep-stop-pin" data-stop-code="${card.fromStop}" title="Vedi sulla mappa" aria-label="Apri mappa fermata">${PIN_SVG}</button>`
    : '';

  let selectHtml = "";
  if (card && card.stopCandidates && card.stopCandidates.length > 1) {
    const options = card.stopCandidates.map(code => {
      const isSelected = code === card.fromStop;
      return `<option value="${code}" ${isSelected ? "selected" : ""}>${escapeHtml(getStopName(code))}</option>`;
    }).join("");
    selectHtml = `
      <span class="dep-stop-name-text" style="font-weight: 600;">${escapeHtml(getStopName(card.fromStop))}</span>
      <button type="button" class="edit-dep-stop-btn" title="Modifica fermata di partenza" aria-label="Modifica fermata di partenza">
        ${EDIT_SVG}
      </button>
      <select class="dep-stop-select" data-line="${card.lineId}" data-dir="${direction}" style="display: none;" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">
        ${options}
      </select>
    `;
  } else {
    selectHtml = `<span class="dep-stop-name-text" style="font-weight: 600;">${escapeHtml(getStopName(card.fromStop))}</span>`;
  }

  const depStopHtml = `
    <div class="dep-stop-row" style="padding-left: 0; padding-right: 0; padding-top: 8px; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="dep-stop-label" style="font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.5px;">PARTENZA DA</span>
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            ${selectHtml}
            ${pinHtml}
            <span class="dep-stop-dest" style="font-size: 0.8rem; color: var(--muted); margin-left: 4px;">→ ${escapeHtml(destination)}</span>
          </div>
        </div>
        <button type="button" class="btn text-btn view-timetable-btn" data-timetable-line="${card.lineId}" data-timetable-dir="${direction}">
          ${CALENDAR_SVG} Orari linea
        </button>
      </div>
      <div class="pref-confirm-label" style="font-size: 0.72rem; color: #10b981; font-weight: 600; display: none; margin-top: 2px; align-self: flex-start; transition: opacity 0.3s ease;">
        ✓ Impostata come preferita per ${card.lineId}!
      </div>
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
  const returnDest = card.config?.returnDestination || RETURN_DESTINATIONS[card.lineId] || "Busto Garolfo";
  const toDestName = card.toStop ? getStopName(card.toStop) : returnDest;
  const routeLabel = direction === "return"
    ? `${getStopName(card.fromStop)} -> ${toDestName}`
    : `${getStopName(card.fromStop)} -> ${card.config.destination}`;
  const cardDest = direction === "return" ? toDestName : card.config.destination;
  const fallback = trip?._usedFallback ? `<span class="notice-inline">fermata alternativa</span>` : "";
  const nextDisplay = trip ? `${minsToHHMM(trip._depMin)} · ${formatWait(wait)}` : "Nessun bus";

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
    ${renderTimeInfoRow(trip, wait, walkMin, direction, card.fromStop, cardDest, card)}
    ${compact}
    <div class="line-card-body">
      ${card.disrupted ? renderDisruption(card.lineId, cfg) : ""}
      ${trip ? renderTripDetails(card, cfg, currentMin) : `<div class="empty-mini">Nessuna corsa nelle prossime ore.</div>`}
      ${renderUpcomingTrips(card)}
    </div>
  </article>`;
}

function renderTimeInfoRow(trip, wait, walkMin, direction, fromStop, destination, card) {
  if (!trip) return "";
  const depHHMM = minsToHHMM(trip._depMin);
  const leaveCountdown = wait - walkMin;
  const leaveAtHHMM = minsToHHMM(trip._depMin - walkMin);

  const fromStopName = getStopName(fromStop);
  const hasMapPin = fromStop && typeof STOP_COORDINATES !== 'undefined' && !!STOP_COORDINATES[fromStop];
  const pinHtml = hasMapPin
    ? `<button type="button" class="map-trigger dep-stop-pin" data-stop-code="${fromStop}" title="Vedi sulla mappa" aria-label="Apri mappa fermata">${PIN_SVG}</button>`
    : '';

  let selectHtml = "";
  if (card && card.stopCandidates && card.stopCandidates.length > 1) {
    const options = card.stopCandidates.map(code => {
      const isSelected = code === fromStop;
      return `<option value="${code}" ${isSelected ? "selected" : ""}>${escapeHtml(getStopName(code))}</option>`;
    }).join("");
    selectHtml = `
      <span class="dep-stop-name-text" style="font-weight: 600;">${escapeHtml(fromStopName)}</span>
      <button type="button" class="edit-dep-stop-btn" title="Modifica fermata di partenza" aria-label="Modifica fermata di partenza">
        ${EDIT_SVG}
      </button>
      <select class="dep-stop-select" data-line="${card.lineId}" data-dir="${direction}" style="display: none;" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()">
        ${options}
      </select>
    `;
  } else {
    selectHtml = `<span class="dep-stop-name-text" style="font-weight: 600;">${escapeHtml(fromStopName)}</span>`;
  }

  const depStopHtml = `
    <div class="dep-stop-row" style="padding-left: 14px; padding-right: 14px; padding-top: 8px; display: flex; flex-direction: column; gap: 4px; align-items: stretch;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="dep-stop-label" style="font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.5px;">PARTENZA DA</span>
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            ${selectHtml}
            ${pinHtml}
            <span class="dep-stop-dest" style="font-size: 0.8rem; color: var(--muted); margin-left: 4px;">→ ${escapeHtml(destination)}</span>
          </div>
        </div>
        ${card ? `
        <button type="button" class="btn text-btn view-timetable-btn" data-timetable-line="${card.lineId}" data-timetable-dir="${direction}">
          ${CALENDAR_SVG} Orari linea
        </button>
        ` : ''}
      </div>
      ${card ? `
      <div class="pref-confirm-label" style="font-size: 0.72rem; color: #10b981; font-weight: 600; display: none; margin-top: 2px; align-self: flex-start; transition: opacity 0.3s ease;">
        ✓ Impostata come preferita per ${card.lineId}!
      </div>
      ` : ''}
    </div>
  `;

  return `
    ${depStopHtml}
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
        ? `<small class="map-trigger" data-stop-code="${code}" style="cursor:pointer" title="${escapeHtml(getStopName(code))} [${code}] - Vedi sulla mappa">${escapeHtml(getStopName(code))} ${PIN_SVG}</small>`
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
  let foundUpcoming = false;
  const timeline = card.detailStops
    .map(code => ({ code, minutes: trip.stops?.[code] }))
    .filter(s => s.minutes !== undefined && s.minutes !== null)
    .map(s => {
      const isPast = s.minutes < currentMin;
      let statusClass = "";
      if (isPast) {
        statusClass = "past";
      } else if (!foundUpcoming) {
        statusClass = "upcoming";
        foundUpcoming = true;
      }

      const hasPin = STOP_COORDINATES?.[s.code];
      const stopEl = hasPin
        ? `<small class="map-trigger" data-stop-code="${s.code}" style="cursor:pointer" title="${escapeHtml(getStopName(s.code))} [${s.code}] - Vedi sulla mappa">${escapeHtml(getStopName(s.code))} ${PIN_SVG}</small>`
        : `<small title="${escapeHtml(getStopName(s.code))} [${s.code}]">${escapeHtml(getStopName(s.code))}</small>`;
      return `<div class="timeline-node ${statusClass}">
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

function renderTrainCard(stationCode, state, currentMin, cfg, isHero = false) {
  const stationInfo = TRAIN_STATIONS[stationCode];
  if (!stationInfo) return "";

  const reachMinutes = stationCode === "CN_FS"
    ? Number(state?.settings?.driveCanegrate || cfg.defaults.driveCanegrate || 16)
    : Number(state?.settings?.stationReachMinutes?.[stationCode] || 0);

  const now = new Date();
  const dayType = getDayType(now, cfg);

  const baseDirection = state?.settings?.liveDirection || cfg?.defaults?.liveDirection || "outbound";
  const resolvedDir = state?.settings?.invertDirections
    ? (baseDirection === "outbound" ? "return" : "outbound")
    : baseDirection;
  const trainDirection = resolvedDir === "return" ? "from_milano" : "to_milano";
  const isReturn = trainDirection === "from_milano";

  const block = buildTrainStationBlock(stationCode, reachMinutes, currentMin, dayType, trainDirection);
  const trains = block.trains;

  if (!trains.length) return "";

  const firstTrain = trains[0];
  const wait = block.canLeaveIn;
  const urgency = getUrgencyState(wait);

  const stationName = stationInfo.name + " FS";
  const liveLink = stationInfo.stopId ? ` <a href="https://m.trenord.it/store/#/station-details/${stationInfo.stopId}" target="_blank" rel="noopener" class="station-link" title="Orari tempo reale ${escapeHtml(stationName)}">🔴 LIVE</a>` : "";

  const timetableBtn = `
    <button type="button" class="btn text-btn view-timetable-btn view-train-timetable-btn" data-station-code="${stationCode}">
      ${CALENDAR_SVG} Orari stazione
    </button>
  `;

  const trainChips = trains.slice(0, 4).map(t => `
    <span class="stop-chip" style="background: rgba(var(--bg-rgb), 0.48); border: 1px solid var(--line); padding: 8px 12px; display: inline-flex; flex-direction: column; align-items: center; gap: 2px; flex: 0 0 auto; min-width: 70px; border-radius: var(--radius);">
      <small style="font-size: 0.68rem; opacity: 0.8; font-weight: 600; color: ${t.color || 'var(--accent)'};">${escapeHtml(t.line)}</small>
      <strong style="font-size: 0.88rem; font-weight: 700; color: var(--text);">${minsToHHMM(t.departureMin)}</strong>
    </span>
  `).join("");

  const depHHMM = minsToHHMM(firstTrain.departureMin);
  const leaveAtHHMM = minsToHHMM(firstTrain.departureMin - reachMinutes);

  if (isHero) {
    const walkBlockHtml = reachMinutes > 0 ? `
      <div class="time-block walk">
        <div class="time-block-label walk">Uscire di casa</div>
        <h2 style="color: var(--accent); margin: 0; font-size: clamp(2rem, 9vw, 3.5rem);">tra ${wait} min</h2>
        <span class="time-block-pill walk">${stationCode === "CN_FS" ? "in auto" : "percorso"}</span>
        <div class="time-block-detail">Partenza ore ${leaveAtHHMM} &middot; ${stationCode === "CN_FS" ? "auto" : "tempo"} ${reachMinutes} min</div>
      </div>
    ` : `
      <div class="time-block walk" style="opacity: 0.62;">
        <div class="time-block-label walk">Uscire di casa</div>
        <h2 style="color: var(--quiet); margin: 0; font-size: clamp(1.6rem, 7vw, 2.5rem); font-weight: 650; text-transform: lowercase;">non imp.</h2>
        <span class="time-block-pill walk" style="background: rgba(var(--muted-rgb), 0.12); color: var(--muted); border: 1px solid var(--line);">disattivato</span>
        <div class="time-block-detail" style="font-size: 0.68rem;">Imposta i minuti nel tab Treni o Impostazioni</div>
      </div>
    `;

    return `
      <section class="featured-card ${urgency.css} train-hero-card">
        <div class="featured-top">
          <span class="line-pill" style="background: ${firstTrain.color || 'var(--accent)'}; color: var(--accent-on);">${escapeHtml(firstTrain.line)}</span>
          <span class="status-pill ${urgency.css}">${urgency.label}</span>
        </div>
        
        <div class="dep-stop-row" style="padding-left: 0; padding-right: 0; padding-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="dep-stop-label" style="font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.5px;">STAZIONE DI</span>
              <div style="display: inline-flex; align-items: center; gap: 4px;">
                <span class="dep-stop-name-text" style="font-weight: 600; color: var(--text);">${escapeHtml(stationName)}</span>
                <button type="button" class="map-trigger dep-stop-pin" data-stop-code="${stationCode}" title="Vedi sulla mappa" aria-label="Apri mappa stazione">${PIN_SVG}</button>
                ${liveLink}
                <span class="dep-stop-dest" style="font-size: 0.8rem; color: var(--muted); margin-left: 4px;">${isReturn ? "← Da Milano" : "→ Milano"}</span>
              </div>
            </div>
            ${timetableBtn}
          </div>
        </div>

        <div class="time-info-row" style="border-top: none; margin-top: 12px;">
          <div class="time-block bus">
            <div class="time-block-label bus">Orario Treno</div>
            <h2 style="margin: 0;">${depHHMM}</h2>
            <span class="time-block-pill bus">tra ${firstTrain.departureMin - currentMin} min</span>
          </div>
          ${walkBlockHtml}
        </div>
        <div class="stop-chip-row" style="margin-top: 14px; border-top: 1px solid var(--line); padding: 12px 0 0; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;">
          ${trainChips}
        </div>
      </section>
    `;
  } else {
    // Standard Train Card styled EXACTLY like Bus line-card
    const id = `live-train-${stationCode}`;
    const isExpanded = false;
    const nextDisplay = `${depHHMM} · ${formatWait(firstTrain.departureMin - currentMin)}`;
    const routeLabel = isReturn ? `${escapeHtml(stationName)} ← Da Milano` : `${escapeHtml(stationName)} → Milano`;
    const validityHtml = `<span class="validity-badge">Treno</span>${liveLink}`;

    const urgencyClass = urgency.css === "hurry" ? "urgency-hurry" : (urgency.css === "good" ? "urgency-good" : (urgency.css === "calm" ? "urgency-calm" : "urgency-missed"));

    const walkBlock = reachMinutes > 0 ? `
      <div class="time-block walk">
        <div class="time-block-label walk">Uscire di casa</div>
        <div class="time-block-value walk">tra ${wait} min</div>
        <span class="time-block-pill walk">${stationCode === "CN_FS" ? "in auto" : "percorso"}</span>
        <div class="time-block-detail">Partenza ore ${leaveAtHHMM} &middot; ${stationCode === "CN_FS" ? "auto" : "tempo"} ${reachMinutes} min</div>
      </div>
    ` : `
      <div class="time-block walk" style="opacity: 0.62;">
        <div class="time-block-label walk">Uscire di casa</div>
        <div class="time-block-value walk" style="text-transform: lowercase;">non imp.</div>
        <span class="time-block-pill walk" style="background: rgba(var(--muted-rgb), 0.12); color: var(--muted); border: 1px solid var(--line);">disattivato</span>
        <div class="time-block-detail" style="font-size: 0.68rem;">Imposta i minuti nel tab Treni o Impostazioni</div>
      </div>
    `;

    const depStopHtml = `
      <div class="dep-stop-row" style="padding-left: 14px; padding-right: 14px; padding-top: 8px; display: flex; flex-direction: column; gap: 4px; align-items: stretch;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="dep-stop-label" style="font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.5px;">STAZIONE DI</span>
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <span class="dep-stop-name-text" style="font-weight: 600; color: var(--text);">${escapeHtml(stationName)}</span>
              <button type="button" class="map-trigger dep-stop-pin" data-stop-code="${stationCode}" title="Vedi sulla mappa" aria-label="Apri mappa stazione">${PIN_SVG}</button>
              ${liveLink}
              <span class="dep-stop-dest" style="font-size: 0.8rem; color: var(--muted); margin-left: 4px;">${isReturn ? "← Da Milano" : "→ Milano"}</span>
            </div>
          </div>
          ${timetableBtn}
        </div>
      </div>
    `;

    const timeInfoRow = `
      ${depStopHtml}
      <div class="time-info-row">
        <div class="time-block bus">
          <div class="time-block-label bus">Orario Treno</div>
          <div class="time-block-value bus">${depHHMM}</div>
          <span class="time-block-pill bus">tra ${firstTrain.departureMin - currentMin} min</span>
        </div>
        ${walkBlock}
      </div>
    `;

    const upcomingTrips = `
      <div class="next-list">
        <h4>Prossime partenze</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
          ${trainChips}
        </div>
      </div>
    `;

    return `
      <article class="line-card ${isExpanded ? "expanded" : ""}" data-card="${id}">
        <button class="line-card-header" type="button" data-toggle-card="${id}">
          <div class="line-main">
            <span class="line-pill" style="background: ${firstTrain.color || 'var(--accent)'}; color: var(--accent-on);">${escapeHtml(firstTrain.line)}</span>
            <div>
              <h3>${routeLabel}</h3>
              <p>${validityHtml}</p>
            </div>
          </div>
          <div class="line-meta">
            <strong>${nextDisplay}</strong>
            <span class="urgency-dot ${urgencyClass}"></span>
          </div>
        </button>
        ${timeInfoRow}
        <div class="line-card-body">
          ${upcomingTrips}
        </div>
      </article>
    `;
  }
}


function bindChipEvents(chipsWrapper, handleStopPick) {
  chipsWrapper.querySelectorAll("[data-chip-stop]").forEach(chip => {
    if (chip.__has_click) return;
    chip.__has_click = true;
    chip.addEventListener("click", (e) => {
      if (e.target.closest("[data-chip-delete]")) return;
      handleStopPick(chip.dataset.chipStop);
    });
  });

  chipsWrapper.querySelectorAll("[data-chip-delete]").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const codeToDelete = btn.dataset.chipDelete;
      try {
        let history = JSON.parse(localStorage.getItem("trasporti_search_history") || "[]");
        history = history.filter(c => c !== codeToDelete);
        localStorage.setItem("trasporti_search_history", JSON.stringify(history));
        chipsWrapper.innerHTML = getSearchHistoryChipsHTML();
        bindChipEvents(chipsWrapper, handleStopPick);
      } catch (err) {
        console.warn(err);
      }
    });
  });
}
function bindLiveEvents(container) {
  const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
  const focusCity = state.settings?.focusCity || cfg.defaults?.focusCity || 'BT';

  // Dropdown dep-stop-select change event
  container.querySelectorAll(".dep-stop-select").forEach(select => {
    // Stop propagation of mouse events to prevent document click-outside from triggering
    if (!select.__has_stop_prop) {
      select.__has_stop_prop = true;
      select.addEventListener("click", e => e.stopPropagation());
      select.addEventListener("mousedown", e => { e.stopPropagation(); select.__shown_at = Date.now(); });
      select.addEventListener("mouseup", e => e.stopPropagation());
      // Refresh guard on touch (mobile native picker interactions)
      select.addEventListener("touchstart", e => { select.__shown_at = Date.now(); }, { passive: true });
      select.addEventListener("touchend", e => { select.__shown_at = Date.now(); }, { passive: true });
    }

    // Add Escape key support to cancel and revert
    if (!select.__has_keydown) {
      select.__has_keydown = true;
      select.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          const parent = select.parentElement;
          if (parent) {
            const editBtn = parent.querySelector(".edit-dep-stop-btn");
            const staticText = parent.querySelector(".dep-stop-name-text");
            if (staticText && editBtn) {
              staticText.style.display = "";
              editBtn.style.display = "";
              select.style.display = "none";
              select.blur();
            }
          }
        }
      });
    }

    if (select.__has_change) return;
    select.__has_change = true;
    select.addEventListener("change", (e) => {
      e.stopPropagation();
      const lineId = select.dataset.line;
      const direction = select.dataset.dir;
      const newStop = select.value;

      // Update favoriteStops in settings
      const favoriteStops = { ...state.settings.favoriteStops };
      if (!favoriteStops[lineId]) favoriteStops[lineId] = {};
      favoriteStops[lineId][direction] = newStop;

      saveSettings({ favoriteStops });

      // Trigger premium floating toast notification (which survives tab-level reactive DOM patching)
      showPremiumToast(`Fermata <strong>${escapeHtml(getStopName(newStop))}</strong> impostata come preferita per la linea ${lineId}!`, 'success');

      // Find the label in the parent container (if it survived/renders)
      const cardEl = select.closest(".featured-card, .line-card");
      if (cardEl) {
        const label = cardEl.querySelector(".pref-confirm-label");
        if (label) {
          label.style.display = "block";
          label.style.opacity = "1";
          setTimeout(() => {
            label.style.opacity = "0";
            setTimeout(() => {
              label.style.display = "none";
            }, 300);
          }, 3000);
        }
      }
    });
  });

  // Edit button edit-dep-stop-btn click event
  container.querySelectorAll(".edit-dep-stop-btn").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = btn.parentElement;
      if (parent) {
        const staticText = parent.querySelector(".dep-stop-name-text");
        const selectEl = parent.querySelector(".dep-stop-select");
        if (staticText && selectEl) {
          staticText.style.display = "none";
          btn.style.display = "none";
          selectEl.style.display = "inline-block";
          selectEl.__shown_at = Date.now();
          selectEl.focus();
        }
      }
    });
  });

  // Handle click outside to revert edit mode (safely guarded against duplicates)
  if (!window.__has_global_stop_click_outside) {
    window.__has_global_stop_click_outside = true;
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".dep-stop-select").forEach(select => {
        if (select.style.display && select.style.display !== "none") {
          console.log("[Trasporti Click Debug] Clicked:", {
            target: e.target,
            targetTagName: e.target ? e.target.tagName : null,
            targetId: e.target ? e.target.id : null,
            targetClass: e.target ? e.target.className : null,
            select: select,
            activeEl: document.activeElement,
            shownAt: select.__shown_at,
            diff: Date.now() - (select.__shown_at || 0)
          });
          // If shown recently (within 700ms), do not close (covers rapid clicks, bubbling, touch/mouse mismatches, slow native pickers on mobile)
          if (select.__shown_at && (Date.now() - select.__shown_at < 700)) {
            console.log("[Trasporti Click Debug] Ignored due to 700ms guard");
            return;
          }
          // If the click target is the select itself, inside it, the body/html (which can happen with native select dropdown overlays), 
          // or if the element is currently the active/focused element, do not close.
          if (
            e.target === select ||
            select.contains(e.target) ||
            e.target === document.body ||
            e.target === document.documentElement ||
            document.activeElement === select
          ) {
            console.log("[Trasporti Click Debug] Ignored: click target is select, body, html, or activeElement");
            return;
          }
          const depStopRow = select.closest(".dep-stop-row");
          console.log("[Trasporti Click Debug] depStopRow:", depStopRow, "contains target:", depStopRow ? depStopRow.contains(e.target) : false);
          if (depStopRow && !depStopRow.contains(e.target)) {
            console.log("[Trasporti Click Debug] Closing and reverting!");
            const editBtn = depStopRow.querySelector(".edit-dep-stop-btn");
            const staticText = depStopRow.querySelector(".dep-stop-name-text");
            if (staticText && editBtn) {
              staticText.style.display = "";
              editBtn.style.display = "";
              select.style.display = "none";
            }
          }
        }
      });
    });
  }

  // View timetable button click event
  container.querySelectorAll(".view-timetable-btn").forEach(btn => {
    if (btn.classList.contains("view-train-timetable-btn")) return;
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineId = btn.dataset.timetableLine;
      const direction = btn.dataset.timetableDir;

      state.timetableLine = lineId;
      state.timetableDirection = direction;

      if (window._app_config && window._app_config.switchTab) {
        window._app_config.switchTab("timetable");
      }
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

  // Direction toggle
  container.querySelectorAll("[data-dir]").forEach(button => {
    if (button.closest("[data-timetable-direction]")) return;
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      saveSettings({ liveDirection: button.dataset.dir });
    });
  });

  // Card expand/collapse
  container.querySelectorAll("[data-toggle-card]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      const card = container.querySelector(`[data-card="${button.dataset.toggleCard}"]`);
      card?.classList.toggle("expanded");
    });
  });

  // Stop search input
  const searchInput = container.querySelector("[data-stop-search]");
  const resultsBox = container.querySelector("[data-stop-results]");
  if (searchInput && resultsBox) {
    // Helper: when selecting a stop, auto-enable showAllLines and load all lines
    // if the stop isn't served by any currently-loaded line
    const handleStopPick = async (stopCode) => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;

      // Salva nello storico ricerche
      try {
        let history = JSON.parse(localStorage.getItem("trasporti_search_history") || "[]");
        history = [stopCode, ...history.filter(c => c !== stopCode)].slice(0, 3);
        localStorage.setItem("trasporti_search_history", JSON.stringify(history));
      } catch (e) {
        console.warn("Impossibile salvare lo storico ricerche:", e);
      }

      // Check if any loaded line serves this stop
      let stopIsServed = false;
      for (const lineId of Object.keys(lineData || {})) {
        const data = lineData[lineId];
        for (const key of Object.keys(data || {})) {
          if ((data[key] || []).some(t => t.stops?.[stopCode] !== undefined)) {
            stopIsServed = true;
            break;
          }
        }
        if (stopIsServed) break;
      }
      if (!stopIsServed) {
        // Load all lines so we can find this stop
        try {
          const { loadLines, getCachedLineData } = await import("./line-registry.js");
          await loadLines(Object.keys(lineConfig));
          Object.assign(lineData, getCachedLineData());
          state.showAllLines = true;
        } catch (e) {
          console.error("[Trasporti] Errore caricamento linee:", e);
        }
      }
      state.liveStopFilter = stopCode;
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    };

    if (!searchInput.__has_input) {
      searchInput.__has_input = true;
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim();
        if (q.length >= 1) {
          resultsBox.innerHTML = buildSearchResults(q);
          resultsBox.classList.add("open");
          // Bind pick events on results
          resultsBox.querySelectorAll("[data-stop-pick]").forEach(btn => {
            if (btn.__has_click) return;
            btn.__has_click = true;
            btn.addEventListener("click", () => handleStopPick(btn.dataset.stopPick));
          });
        } else {
          resultsBox.innerHTML = "";
          resultsBox.classList.remove("open");
        }
      });
    }

    if (!searchInput.__has_focus) {
      searchInput.__has_focus = true;
      searchInput.addEventListener("focus", () => {
        if (!searchInput.value && !lastArgs.state.liveStopFilter) {
          // Show all stops on focus when empty
          resultsBox.innerHTML = buildSearchResults(" ");
          resultsBox.classList.add("open");
          resultsBox.querySelectorAll("[data-stop-pick]").forEach(btn => {
            if (btn.__has_click) return;
            btn.__has_click = true;
            btn.addEventListener("click", () => handleStopPick(btn.dataset.stopPick));
          });
        } else if (searchInput.value) {
          // If has a selected stop, clear text to allow new search
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
        }
      });
    }

    // Close results on outside click (guarded against accumulation)
    if (!document.__has_results_click) {
      document.__has_results_click = true;
      document.addEventListener("click", (e) => {
        document.__has_results_click = false;
        if (!e.target.closest(".stop-search-wrapper")) {
          resultsBox.classList.remove("open");
        }
      }, { once: true });
    }

    // Gestione click sulle chips della cronologia ricerche
    const chipsWrapper = container.querySelector("#search-chips-wrapper");
    if (chipsWrapper) {
      bindChipEvents(chipsWrapper, handleStopPick);
    }
  }

  // Clear stop search
  const clearBtn = container.querySelector("[data-stop-search-clear]");
  if (clearBtn && !clearBtn.__has_click) {
    clearBtn.__has_click = true;
    clearBtn.addEventListener("click", () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      state.liveStopFilter = null;
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Line filter pills
  container.querySelectorAll("[data-line-filter]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", async () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      const lineId = button.dataset.lineFilter || null;
      // If selecting a specific line that isn't loaded yet, load it on demand
      if (lineId && !lineData[lineId] && lineConfig[lineId]) {
        try {
          const { loadSingleLine } = await import("./line-registry.js");
          const data = await loadSingleLine(lineId);
          if (data) lineData[lineId] = data;
        } catch (e) {
          console.error(`[Trasporti] Errore caricamento ${lineId}:`, e);
        }
      }
      state.liveLineFilter = lineId;
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    });
  });

  // Clear all filters
  const clearFiltersBtn = container.querySelector("[data-clear-filters]");
  if (clearFiltersBtn && !clearFiltersBtn.__has_click) {
    clearFiltersBtn.__has_click = true;
    clearFiltersBtn.addEventListener("click", () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      state.liveStopFilter = null;
      state.liveLineFilter = null;
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Toggle "Show all lines" / "Show only my city"
  const toggleLinesBtn = container.querySelector("[data-toggle-all-lines]");
  if (toggleLinesBtn && !toggleLinesBtn.__has_click) {
    toggleLinesBtn.__has_click = true;
    toggleLinesBtn.addEventListener("click", async () => {
      const { state, lineData, lineConfig, cfg, saveSettings } = lastArgs;
      state.showAllLines = !state.showAllLines;
      if (state.showAllLines) {
        // Load all lines on demand
        try {
          const { loadLines, getCachedLineData } = await import("./line-registry.js");
          const allLineIds = Object.keys(lineConfig);
          await loadLines(allLineIds);
          // Update lineData reference (mutate the global LINE_DATA via main.js)
          const cached = getCachedLineData();
          Object.assign(lineData, cached);
        } catch (e) {
          console.error("[Trasporti] Errore caricamento tutte le linee:", e);
        }
      }
      renderLive(state, lineData, lineConfig, cfg, saveSettings);
    });
  }

  // Dismiss strike alert banners
  container.querySelectorAll("[data-dismiss-alert]").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", () => {
      dismissAlert(btn.dataset.dismissAlert);
      const banner = btn.closest(".alert-strike-banner");
      if (banner) banner.remove();
    });
  });

  // View train timetable button click event
  container.querySelectorAll(".view-train-timetable-btn").forEach(btn => {
    if (btn.__has_click) return;
    btn.__has_click = true;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const stationCode = btn.dataset.stationCode;
      state.trainsStation = stationCode;

      if (window._app_config && window._app_config.switchTab) {
        window._app_config.switchTab("trains");
      }
    });
  });

  // Open customize modal
  const openBtn = container.querySelector(".live-customize-trigger");
  const modal = container.querySelector("#live-customize-modal");
  if (openBtn && modal && !openBtn.__has_click) {
    openBtn.__has_click = true;
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      modal.classList.add("open");
    });
  }

  // Close customize modal triggers
  if (modal) {
    modal.querySelectorAll(".live-customize-close, .live-customize-close-btn").forEach(btn => {
      if (btn.__has_click) return;
      btn.__has_click = true;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        modal.classList.remove("open");
      });
    });

    // Close when clicking modal backdrop
    if (!modal.__has_backdrop_click) {
      modal.__has_backdrop_click = true;
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("open");
        }
      });
    }

    // Save customization settings
    const saveBtn = modal.querySelector("#save-live-customization");
    if (saveBtn && !saveBtn.__has_click) {
      saveBtn.__has_click = true;
      saveBtn.addEventListener("click", () => {
        const liveHero = modal.querySelector("#customize-live-hero").value;
        const visibleTrainCheckboxes = modal.querySelectorAll("input[name='visibleTrain']:checked");
        const visibleTrains = Array.from(visibleTrainCheckboxes).map(cb => cb.value);

        const visibleLineCheckboxes = modal.querySelectorAll("input[name='visibleLine']:checked");
        const visibleLines = Array.from(visibleLineCheckboxes).map(cb => cb.value);

        const followedLinesByCity = structuredClone(state.settings.followedLinesByCity || {});
        followedLinesByCity[focusCity] = visibleLines;

        const invertDirections = modal.querySelector("#customize-invert-directions").checked;

        saveSettings({ liveHero, visibleTrains, followedLinesByCity, invertDirections });
        modal.classList.remove("open");
        showPremiumToast("Personalizzazione del tab LIVE salvata con successo!", "success");
      });
    }

    // Reset customization lines
    const resetBtn = modal.querySelector("#reset-live-lines");
    if (resetBtn && !resetBtn.__has_click) {
      resetBtn.__has_click = true;
      resetBtn.addEventListener("click", () => {
        if (confirm("Ripristinare le linee predefinite per questa città?")) {
          const followedLinesByCity = structuredClone(state.settings.followedLinesByCity || {});
          delete followedLinesByCity[focusCity];
          saveSettings({ followedLinesByCity });
          modal.classList.remove("open");
          showPremiumToast("Linee ripristinate ai valori predefiniti per questa città!", "success");
        }
      });
    }
  }
}

/**
 * Show a premium, custom, glassmorphic toast notification.
 * This is appended to document.body, ensuring it survives reactive tab/card DOM re-renders.
 */
function showPremiumToast(message, type = "success") {
  let container = document.getElementById("premium-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "premium-toast-container";
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(40px);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      width: max-content;
      max-width: 90vw;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-item ${type}`;
  toast.style.cssText = `
    background: rgba(var(--surface-rgb), 0.9);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
    border-radius: 12px;
    padding: 12px 20px;
    color: var(--text);
    font-size: 0.88rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: auto;
  `;

  if (type === "success") {
    toast.style.borderLeft = "4px solid var(--ok, #22c55e)";
  } else if (type === "info") {
    toast.style.borderLeft = "4px solid var(--accent, #22d3ee)";
  }

  const checkIcon = type === "success" 
    ? `<span style="color: var(--ok, #22c55e); font-size: 1.1rem; display: inline-flex; align-items: center; justify-content: center; font-weight: bold;">✓</span>` 
    : `<span style="color: var(--accent, #22d3ee); font-size: 1.1rem; display: inline-flex; align-items: center; justify-content: center; font-weight: bold;">ℹ</span>`;

  toast.innerHTML = `
    ${checkIcon}
    <span style="letter-spacing: -0.01em;">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animations
  container.style.transform = "translateX(-50%) translateY(0)";
  
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  // Fade out and remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.style.transform = "translateX(-50%) translateY(40px)";
      }
    }, 350);
  }, 4000);
}
