import { getScheduleKey, escapeHtml, getVisibleLines } from "./utils.js";
import { getStopName } from "./line-config.js";
import { patchDOM } from "./dom-utils.js";
import {
  getCurrentUser,
  getSyncStatus,
  isFirebaseReady,
  signInWithGoogle,
  signOut,
  saveToCloud,
  loadFromCloud,
  deleteCloudData,
  listenForCloudChanges,
  onAuthStateChanged,
  setSyncPassphrase,
  getSyncPassphrase
} from "./firebase-sync.js";
import {
  getNotificationConfig,
  saveNotificationConfig,
  renderNotificationSettings,
  bindNotificationEvents,
  sanitizeNotifications
} from "./notifications.js";
import { setSuppressCloudWrite } from "./main.js";
import { startOnboarding } from "./onboarding.js";
import { TRAIN_STATIONS } from "../data/trains.js";


let lastArgs = null;

export function renderSettings(state, saveFn, cfg, lineData, lineConfig) {
  lastArgs = { state, saveFn, cfg, lineData, lineConfig };
  // Register the settings event-bus listener exactly once per page lifetime
  // (B14): notification UI controls dispatch `trasporti:settings-changed`
  // and we re-render in place when the Settings tab is active. This
  // replaces the brittle `window._app_config.renderSettings` indirection.
  if (!window.__settingsBusBound) {
    document.addEventListener("trasporti:settings-changed", () => {
      if (lastArgs && lastArgs.state && lastArgs.state.currentTab === "settings") {
        const { state: s, saveFn: sf, cfg: c, lineData: ld, lineConfig: lc } = lastArgs;
        renderSettings(s, sf, c, ld, lc);
      }
    });

    document.addEventListener("trasporti:sync-locked", () => {
      // Cloud sync is encrypted, but passphrase is not set. Reload to show warning.
      if (lastArgs && lastArgs.state && lastArgs.state.currentTab === "settings") {
        const { state: s, saveFn: sf, cfg: c, lineData: ld, lineConfig: lc } = lastArgs;
        renderSettings(s, sf, c, ld, lc);
      }
    });

    document.addEventListener("trasporti:sync-error-passphrase", () => {
      alert("⚠️ Errore di decrittografia del cloud. La tua Passphrase di Sincronizzazione locale non è corretta.");
    });

    window.__settingsBusBound = true;
  }

  const container = document.getElementById("settings-content");
  if (!container) return;
  const settings = state.settings || {};
  const visibleLines = getVisibleLines(state, cfg);
  const activeLine = state.settingsPanelLine || visibleLines[0] || "Z649";

  const lineOptions = visibleLines.map(lineId =>
    `<button type="button" data-settings-line="${lineId}" class="${lineId === activeLine ? "active" : ""}">${lineId}</button>`
  ).join("");

  const selectedFocusCity = settings.focusCity || cfg.defaults.focusCity || "BT";
  const focusCityOptions = Object.entries(cfg.focusCities || {}).map(([code, city]) =>
    `<option value="${code}" ${code === selectedFocusCity ? "selected" : ""}>${escapeHtml(city.name)}</option>`
  ).join("");

  const ALL_STATIONS = Object.keys(TRAIN_STATIONS);
  const STATION_NAMES = Object.fromEntries(
    Object.entries(TRAIN_STATIONS).map(([code, info]) => [code, info.name])
  );

  const stationsHtml = Object.entries(TRAIN_STATIONS).map(([station, info]) => {
    const value = settings.stationReachMinutes?.[station] !== undefined ? settings.stationReachMinutes[station] : 0;
    return `
      <label class="field-row">
        <span>Minuti per raggiungere ${escapeHtml(info.name)}</span>
        <input type="number" min="0" max="60" data-station-reach-setting="${station}" value="${Number(value)}">
      </label>
    `;
  }).join("");

  const settingsHeroCode = settings.liveHero || "Z649";
  const settingsVisibleTrains = settings.visibleTrains || ["CN_FS"];

  const settingsHeroOptions = [
    ...visibleLines.map(id => `<option value="${id}" ${settingsHeroCode === id ? "selected" : ""}>Bus ${id} - ${escapeHtml(lineConfig[id]?.destination || id)}</option>`),
    ...Object.entries(TRAIN_STATIONS).map(([code, info]) => `<option value="${code}" ${settingsHeroCode === code ? "selected" : ""}>Treno - Stazione di ${escapeHtml(info.name)}</option>`)
  ].join("");

  const settingsTrainsCheckboxes = Object.entries(TRAIN_STATIONS).map(([code, info]) => {
    const isChecked = settingsVisibleTrains.includes(code);
    return `
      <label class="check-row" style="background: rgba(255,255,255,0.02); border: 1px solid var(--line); padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" data-settings-visible-train="${code}" ${isChecked ? "checked" : ""} style="cursor: pointer;">
        <span>${escapeHtml(info.name)}</span>
      </label>
    `;
  }).join("");

  const activeSubTab = state.settingsSubTab || "profile";

  const settingsFooterLinks = `
    <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;">
      <a href="./privacy.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">📋 Privacy & GDPR</a>
      <span style="color: var(--line);">|</span>
      <a href="./feedback.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">🐛 Segnala un problema</a>
      <span style="color: var(--line);">|</span>
      <a href="./feedback.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">💡 Suggerisci miglioramento</a>
    </div>
  `;

  // Linee bus visibili: checkbox per la selezione (stessa logica del modal LIVE)
  const focusCity = settings.focusCity || cfg.defaults?.focusCity || "BT";
  const cityName = cfg.focusCities?.[focusCity]?.name || focusCity;
  const cityLineOrder = cfg.focusCities?.[focusCity]?.lineOrder || cfg.lineOrder || [];
  const allBusLines = Object.keys(lineConfig).sort();
  const followedForCity = settings.followedLinesByCity?.[focusCity];

  const isLineChecked = (lineId) => {
    if (Array.isArray(followedForCity)) return followedForCity.includes(lineId);
    return cityLineOrder.includes(lineId);
  };

  const cityBusCheckboxes = cityLineOrder.map(id => `
    <label style="padding: 8px 10px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
      <input type="checkbox" data-settings-visible-line="${id}" ${isLineChecked(id) ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px;">
      <span style="font-weight: 600;">${id}</span>
    </label>
  `).join("");

  const otherBusLines = allBusLines.filter(id => !cityLineOrder.includes(id));
  const otherBusCheckboxes = otherBusLines.map(id => `
    <label style="padding: 8px 10px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--line); border-radius: 8px; cursor: pointer;">
      <input type="checkbox" data-settings-visible-line="${id}" ${isLineChecked(id) ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px;">
      <span>${id}</span>
    </label>
  `).join("");

  const subtabsHtml = `
    <div class="settings-subtabs" role="navigation" aria-label="Sotto-sezioni impostazioni">
      <button type="button" class="subtab-btn ${activeSubTab === "profile" ? "active" : ""}" data-settings-subtab="profile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span>Profilo</span>
      </button>
      <button type="button" class="subtab-btn ${activeSubTab === "display" ? "active" : ""}" data-settings-subtab="display">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        <span>Interfaccia</span>
      </button>
      <button type="button" class="subtab-btn ${activeSubTab === "lines" ? "active" : ""}" data-settings-subtab="lines">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 20 10.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span>Fermate</span>
      </button>
      <button type="button" class="subtab-btn ${activeSubTab === "notifications" ? "active" : ""}" data-settings-subtab="notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span>Notifiche</span>
      </button>
      <button type="button" class="subtab-btn ${activeSubTab === "system" ? "active" : ""}" data-settings-subtab="system">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Sincronizzazione</span>
      </button>
    </div>
  `;

  const html = `
    ${subtabsHtml}

    <div class="settings-section-wrapper ${activeSubTab === "profile" ? "" : "hidden"}" data-card="settings-profile-section">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Profilo casa</p>
            <h2>${escapeHtml(cfg.homeProfile.address)}</h2>
            <p>${escapeHtml(cfg.homeProfile.note || "Configurazione attiva concentrata sulla tua città.")}</p>
          </div>
        </div>
        <div class="settings-grid">
          <label class="field-row">
            <span>Città di Focus</span>
            <select data-setting-string="focusCity">
              ${focusCityOptions}
            </select>
          </label>
          <label class="field-row">
            <span>Minuti a piedi verso fermata principale</span>
            <input type="number" min="1" max="30" data-setting-number="walkRossini" value="${Number(settings.walkRossini || cfg.defaults.walkRossini)}">
          </label>
          <label class="field-row">
            <span>Minuti in auto verso Canegrate FS</span>
            <input type="number" min="1" max="45" data-setting-number="driveCanegrate" value="${Number(settings.driveCanegrate || cfg.defaults.driveCanegrate)}">
          </label>
          <label class="check-row" style="grid-column: span 1; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(255,255,255,0.02);">
            <input type="checkbox" id="settings-invert-directions" ${settings.invertDirections ? "checked" : ""} style="cursor: pointer; width: 18px; height: 18px;">
            <span style="color: var(--text); font-size: 0.85rem;">Inverti Andata/Ritorno (utile se abiti a Milano)</span>
          </label>
        </div>
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--line); padding-top: 1.5rem;">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin-bottom: 1rem;">Tempi per raggiungere la stazione (minuti)</h3>
          <div class="settings-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            ${stationsHtml}
          </div>
        </div>
      </section>
      ${settingsFooterLinks}
    </div>

    <div class="settings-section-wrapper ${activeSubTab === "display" ? "" : "hidden"}" data-card="settings-display-section">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Personalizzazione LIVE e ORARI</p>
            <h2>Layout e Contenuto</h2>
            <p>Configura la scheda principale (Hero) e seleziona quali stazioni/linee visualizzare.</p>
          </div>
        </div>
        <div class="settings-grid">
          <label class="field-row">
            <span>Scheda principale (HERO)</span>
            <select data-settings-live-hero>
              ${settingsHeroOptions}
            </select>
          </label>
        </div>
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--line); padding-top: 1.5rem;">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin-bottom: 0.5rem;">Soglie di Coincidenza (Minuti di attesa)</h3>
          <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 1rem 0;">Imposta i tempi limite di attesa per la classificazione visiva delle coincidenze.</p>
          <div class="settings-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <label class="field-row">
              <span>Coincidenza Stretta (Max minuti - Rosso)</span>
              <input type="number" min="1" max="20" data-setting-number="connectionTightMin" value="${Number(settings.connectionTightMin || cfg.defaults.connectionTightMin || 4)}">
            </label>
            <label class="field-row">
              <span>Coincidenza Comoda (Max minuti - Giallo)</span>
              <input type="number" min="5" max="45" data-setting-number="connectionGoodMin" value="${Number(settings.connectionGoodMin || cfg.defaults.connectionGoodMin || 12)}">
            </label>
            <label class="field-row">
              <span>Coincidenza Lunga (Max minuti - Verde)</span>
              <input type="number" min="10" max="90" data-setting-number="connectionLongMin" value="${Number(settings.connectionLongMin || cfg.defaults.connectionLongMin || 25)}">
            </label>
          </div>
        </div>
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--line); padding-top: 1.5rem;">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin-bottom: 0.5rem;">Linee bus visibili (LIVE e ORARI)</h3>
          <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 1rem 0;">Scegli quali linee mostrare nei tab LIVE, ORARI, Fermate e Notifiche.</p>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--accent); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Suggerite per ${escapeHtml(cityName)}</div>
          <div class="settings-grid" style="grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px;">
            ${cityBusCheckboxes}
          </div>
          ${otherBusLines.length > 0 ? `
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-top: 12px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Altre linee del network</div>
          <div style="max-height: 140px; overflow-y: auto; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(0,0,0,0.15);">
            <div class="settings-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
              ${otherBusCheckboxes}
            </div>
          </div>` : ""}
          <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
            <button type="button" class="text-btn" data-reset-visible-lines style="font-size: 0.72rem; font-weight: 700; color: var(--accent); background: none; border: none; cursor: pointer; padding: 4px 0;">Reset ai default della città</button>
          </div>
        </div>
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--line); padding-top: 1.5rem;">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin-bottom: 0.5rem;">Stazioni ferroviarie visibili nel tab LIVE</h3>
          <p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 1rem 0;">Seleziona quali stazioni mostrare in fondo al tab LIVE per il monitoraggio in tempo reale.</p>
          <div class="settings-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            ${settingsTrainsCheckboxes}
          </div>
        </div>
      </section>
      ${settingsFooterLinks}
    </div>

    <div class="settings-section-wrapper ${activeSubTab === "lines" ? "" : "hidden"}" data-card="settings-lines-section">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Fermate e linee</p>
            <h2>Personalizzazione intuitiva</h2>
            <p>Scegli fermate preferite e colonne visibili. I default restano in data/config.js.</p>
          </div>
        </div>
        <div class="line-tabs">${lineOptions}</div>
        ${safeRenderLineSettings(activeLine, state, cfg, lineData, lineConfig)}
      </section>
      ${settingsFooterLinks}
    </div>

    <div class="settings-section-wrapper ${activeSubTab === "notifications" ? "" : "hidden"}" data-card="settings-notifications-section">
      ${renderNotificationSettings(cfg, visibleLines)}
      ${settingsFooterLinks}
    </div>

    <div class="settings-section-wrapper ${activeSubTab === "system" ? "" : "hidden"}" data-card="settings-system-section">
      ${renderCloudSyncSection(cfg)}

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Dati e PWA</p>
            <h2>Backup e aggiornamento</h2>
            <p>Le preferenze sono salvate solo nel browser.</p>
          </div>
        </div>
        <div class="button-grid">
          <button type="button" class="btn primary" data-export>Export preferenze</button>
          <button type="button" class="btn secondary" data-import-trigger>Import preferenze</button>
          <button type="button" class="btn secondary" data-reset-preferences>Reset preferenze</button>
          <button type="button" class="btn secondary" data-restart-onboarding>Riavvia procedura guidata</button>
          <button type="button" class="btn secondary" data-check-sw>Aggiorna app</button>
        </div>
        <input type="file" accept=".json,application/json" data-import-file hidden>
        <div class="info-list">
          <div><span>Versione</span><strong>${escapeHtml(cfg.version)}</strong></div>
          <div><span>Aggiornamento dati</span><strong>${escapeHtml(cfg.lastUpdate)}</strong></div>
          <div><span>Validità GTFS Bus</span><strong>${escapeHtml(cfg.feedValidity?.from || '?')} → ${escapeHtml(cfg.feedValidity?.to || '?')}</strong></div>
          <div><span>Fonte Bus</span><strong>Agenzia TPL / Movibus (Open Data)</strong></div>
          <div><span>Fonte Treni</span><strong>Trenord GTFS (Open Data)</strong></div>
          <div><span>Service worker</span><strong data-sw-status>verifica...</strong></div>
        </div>
        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;">
          <a href="./privacy.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">📋 Privacy & GDPR</a>
          <span style="color: var(--line);">|</span>
          <a href="./feedback.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">🐛 Segnala un problema</a>
          <span style="color: var(--line);">|</span>
          <a href="./feedback.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.78rem; text-decoration: underline; font-weight: 500;">💡 Suggerisci miglioramento</a>
        </div>
      </section>
    </div>
  `;

  patchDOM(container, html, { onAfterPatch: () => {
    bindEvents(container);
    updateSWStatus(container);
  }});
}

function safeRenderLineSettings(lineId, state, cfg, lineData, lineConfig) {
  try {
    return renderLineSettings(lineId, state, cfg, lineData, lineConfig);
  } catch (e) {
    console.error(`[Trasporti] Errore nel render impostazioni linea ${lineId}:`, e);
    return `<div class="empty-mini" style="border-color: rgba(239,68,68,0.3); color: #fecaca;">Errore nel caricamento delle impostazioni per ${lineId}.</div>`;
  }
}

function renderLineSettings(lineId, state, cfg, lineData, lineConfig) {
  const profile = cfg.stopProfiles?.[lineId] || {};
  const favoriteOutbound = state.settings?.favoriteStops?.[lineId]?.outbound || cfg.favoriteStops?.[lineId]?.outbound;
  const favoriteReturn = state.settings?.favoriteStops?.[lineId]?.return || cfg.favoriteStops?.[lineId]?.return;
  const outboundCandidates = collectCandidates(profile.outboundHomeStops, profile.detailStops?.outbound, profile.compactStops?.outbound, lineConfig[lineId]?.referenceStops);
  const returnCandidates = collectCandidates(profile.returnHomeStops, profile.returnInterchanges, profile.detailStops?.return, profile.compactStops?.return);
  const direction = state.settingsLineDirection || "outbound";
  const dayType = state.settingsLineDay || "weekday";
  const scheduleKey = getScheduleKey(lineId, dayType, direction);
  const allStops = collectStopsFromTrips(lineData[lineId]?.[scheduleKey] || []);
  const selectedStops = state.settings?.timetableStops?.[lineId]?.[scheduleKey]
    || profile.timetableStops?.[scheduleKey]
    || profile.timetableStops?.[direction]
    || allStops.slice(0, 4);

  return `
    <div class="settings-grid two">
      <label class="field-row">
        <span>Preferita Andata</span>
        <select data-favorite-stop="${lineId}:outbound">
          ${renderStopOptions(outboundCandidates, favoriteOutbound)}
        </select>
      </label>
      <label class="field-row">
        <span>Preferita Ritorno</span>
        <select data-favorite-stop="${lineId}:return">
          ${renderStopOptions(returnCandidates, favoriteReturn)}
        </select>
      </label>
    </div>

    <div class="filter-row">
      ${["weekday", "saturday", "sunday"].map(dt => {
        const key = getScheduleKey(lineId, dt, direction);
        const disabled = !(lineData[lineId]?.[key]?.length);
        return `<button type="button" data-settings-day="${dt}" class="${dayType === dt ? "active" : ""}" ${disabled ? "disabled" : ""}>${labelDay(dt)}</button>`;
      }).join("")}
    </div>
    <div class="segmented wide">
      <button type="button" data-settings-dir="outbound" class="${direction === "outbound" ? "active" : ""}">Andata</button>
      <button type="button" data-settings-dir="return" class="${direction === "return" ? "active" : ""}">Ritorno</button>
    </div>

    <div class="checkbox-panel">
      <div class="checkbox-panel-head">
        <strong>Fermate visibili in Orari</strong>
        <button type="button" class="text-btn" data-reset-line-stops="${lineId}:${scheduleKey}">default</button>
      </div>
      <div class="checkbox-grid">
        ${allStops.map(code => `<label class="check-row">
          <input type="checkbox" data-timetable-stop="${lineId}:${scheduleKey}:${code}" ${selectedStops.includes(code) ? "checked" : ""}>
          <span>${escapeHtml(getStopName(code))}</span>
        </label>`).join("") || `<div class="empty-mini">Nessuna fermata disponibile per questa selezione.</div>`}
      </div>
    </div>
  `;
}

function collectCandidates(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function collectStopsFromTrips(trips) {
  const stops = [];
  for (const trip of trips) {
    for (const code of Object.keys(trip.stops || {})) {
      if (!stops.includes(code)) stops.push(code);
    }
  }
  return stops;
}

function renderStopOptions(candidates, selected) {
  return candidates.map(code =>
    `<option value="${escapeHtml(code)}" ${code === selected ? "selected" : ""}>${escapeHtml(getStopName(code))}</option>`
  ).join("");
}

function labelDay(dayType) {
  return { weekday: "Feriale", saturday: "Sabato", sunday: "Festivo" }[dayType] || dayType;
}

function bindEvents(container) {
  const { state, saveFn, cfg, lineData, lineConfig } = lastArgs;

  container.querySelectorAll("[data-settings-subtab]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.settingsSubTab = button.dataset.settingsSubtab;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
      // Smooth scroll to top of settings tab content
      const tabContent = document.getElementById("settings-content");
      if (tabContent) {
        tabContent.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  container.querySelectorAll("[data-setting-string]").forEach(select => {
    if (select.__has_change) return;
    select.__has_change = true;
    select.addEventListener("change", () => {
      const value = select.value;
      saveFn({ [select.dataset.settingString]: value });
    });
  });

  container.querySelectorAll("[data-setting-number]").forEach(input => {
    if (input.__has_change) return;
    input.__has_change = true;
    input.addEventListener("change", () => {
      const min = Number(input.min || 0);
      const max = Number(input.max || 999);
      const value = Math.max(min, Math.min(max, Number(input.value || 0)));
      input.value = value;
      saveFn({ [input.dataset.settingNumber]: value });
    });
  });

  const invertCheckbox = container.querySelector("#settings-invert-directions");
  if (invertCheckbox && !invertCheckbox.__has_change) {
    invertCheckbox.__has_change = true;
    invertCheckbox.addEventListener("change", () => {
      saveFn({ invertDirections: invertCheckbox.checked });
    });
  }

  container.querySelectorAll("[data-station-reach-setting]").forEach(input => {
    if (input.__has_change) return;
    input.__has_change = true;
    input.addEventListener("change", () => {
      const station = input.dataset.stationReachSetting;
      const min = Number(input.min || 0);
      const max = Number(input.max || 60);
      const value = Math.max(min, Math.min(max, Number(input.value || 0)));
      input.value = value;
      const stationReachMinutes = { ...state.settings.stationReachMinutes };
      stationReachMinutes[station] = value;
      saveFn({ stationReachMinutes });
    });
  });

  container.querySelectorAll("[data-settings-live-hero]").forEach(select => {
    if (select.__has_change) return;
    select.__has_change = true;
    select.addEventListener("change", () => {
      saveFn({ liveHero: select.value });
    });
  });

  container.querySelectorAll("[data-settings-visible-train]").forEach(checkbox => {
    if (checkbox.__has_change) return;
    checkbox.__has_change = true;
    checkbox.addEventListener("change", () => {
      const code = checkbox.dataset.settingsVisibleTrain;
      let visibleTrains = [...(state.settings.visibleTrains || ["CN_FS"])];
      if (checkbox.checked) {
        if (!visibleTrains.includes(code)) visibleTrains.push(code);
      } else {
        visibleTrains = visibleTrains.filter(c => c !== code);
      }
      saveFn({ visibleTrains });
    });
  });

  // Handler: Linee bus visibili (checkbox)
  container.querySelectorAll("[data-settings-visible-line]").forEach(checkbox => {
    if (checkbox.__has_change) return;
    checkbox.__has_change = true;
    checkbox.addEventListener("change", () => {
      const focusCity = state.settings.focusCity || cfg.defaults?.focusCity || "BT";
      const checkedLines = [...container.querySelectorAll("[data-settings-visible-line]:checked")]
        .map(cb => cb.dataset.settingsVisibleLine);
      const followedLinesByCity = structuredClone(state.settings.followedLinesByCity || {});
      followedLinesByCity[focusCity] = checkedLines;
      saveFn({ followedLinesByCity });
    });
  });

  // Handler: Reset linee visibili ai default della città
  const resetVisibleLinesBtn = container.querySelector("[data-reset-visible-lines]");
  if (resetVisibleLinesBtn && !resetVisibleLinesBtn.__has_click) {
    resetVisibleLinesBtn.__has_click = true;
    resetVisibleLinesBtn.addEventListener("click", () => {
      const focusCity = state.settings.focusCity || cfg.defaults?.focusCity || "BT";
      const followedLinesByCity = structuredClone(state.settings.followedLinesByCity || {});
      delete followedLinesByCity[focusCity];
      saveFn({ followedLinesByCity });
    });
  }

  container.querySelectorAll("[data-settings-line]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.settingsPanelLine = button.dataset.settingsLine;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-settings-day]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.settingsLineDay = button.dataset.settingsDay;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-settings-dir]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      state.settingsLineDirection = button.dataset.settingsDir;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-favorite-stop]").forEach(select => {
    if (select.__has_change) return;
    select.__has_change = true;
    select.addEventListener("change", () => {
      const [lineId, direction] = select.dataset.favoriteStop.split(":");
      const favoriteStops = structuredClone(state.settings.favoriteStops || {});
      favoriteStops[lineId] = { ...(favoriteStops[lineId] || {}) };
      favoriteStops[lineId][direction] = select.value;
      saveFn({ favoriteStops });
    });
  });

  container.querySelectorAll("[data-timetable-stop]").forEach(input => {
    if (input.__has_change) return;
    input.__has_change = true;
    input.addEventListener("change", () => {
      const [lineId, scheduleKey] = input.dataset.timetableStop.split(":");
      const checked = [...container.querySelectorAll(`[data-timetable-stop^="${lineId}:${scheduleKey}:"]:checked`)]
        .map(el => el.dataset.timetableStop.split(":")[2]);
      const timetableStops = structuredClone(state.settings.timetableStops || {});
      timetableStops[lineId] = { ...(timetableStops[lineId] || {}) };
      
      const direction = scheduleKey.endsWith("_return") ? "return" : "outbound";
      for (const dt of ["weekday", "saturday", "sunday"]) {
        const key = getScheduleKey(lineId, dt, direction);
        timetableStops[lineId][key] = checked;
      }
      
      saveFn({ timetableStops });
    });
  });

  container.querySelectorAll("[data-reset-line-stops]").forEach(button => {
    if (button.__has_click) return;
    button.__has_click = true;
    button.addEventListener("click", () => {
      const [lineId, scheduleKey] = button.dataset.resetLineStops.split(":");
      const timetableStops = structuredClone(state.settings.timetableStops || {});
      if (timetableStops[lineId]) {
        const direction = scheduleKey.endsWith("_return") ? "return" : "outbound";
        for (const dt of ["weekday", "saturday", "sunday"]) {
          const key = getScheduleKey(lineId, dt, direction);
          delete timetableStops[lineId][key];
        }
      }
      saveFn({ timetableStops });
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  const exportBtn = container.querySelector("[data-export]");
  if (exportBtn && !exportBtn.__has_click) {
    exportBtn.__has_click = true;
    exportBtn.addEventListener("click", () => exportSettings(state, cfg));
  }

  const importTriggerBtn = container.querySelector("[data-import-trigger]");
  if (importTriggerBtn && !importTriggerBtn.__has_click) {
    importTriggerBtn.__has_click = true;
    importTriggerBtn.addEventListener("click", () => container.querySelector("[data-import-file]")?.click());
  }

  const importFileInput = container.querySelector("[data-import-file]");
  if (importFileInput && !importFileInput.__has_change) {
    importFileInput.__has_change = true;
    importFileInput.addEventListener("change", event => importSettings(event.target, saveFn, state, cfg, lineData, lineConfig));
  }

  const resetPrefBtn = container.querySelector("[data-reset-preferences]");
  if (resetPrefBtn && !resetPrefBtn.__has_click) {
    resetPrefBtn.__has_click = true;
    resetPrefBtn.addEventListener("click", () => {
      if (!confirm("Ripristinare tutte le preferenze predefinite?")) return;
      localStorage.removeItem("trasporti_settings");
      state.settings = buildDefaultSettings(cfg);
      saveFn(state.settings, true);
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  }

  const checkSWBtn = container.querySelector("[data-check-sw]");
  if (checkSWBtn && !checkSWBtn.__has_click) {
    checkSWBtn.__has_click = true;
    checkSWBtn.addEventListener("click", () => {
      navigator.serviceWorker?.ready.then(reg => reg.update()).finally(() => location.reload());
    });
  }

  const restartOnboardingBtn = container.querySelector("[data-restart-onboarding]");
  if (restartOnboardingBtn && !restartOnboardingBtn.__has_click) {
    restartOnboardingBtn.__has_click = true;
    restartOnboardingBtn.addEventListener("click", () => {
      startOnboarding((profile) => {
        if (profile && !profile.skipped) {
          const updates = { userProfile: profile };
          if (profile.walkMinutes) updates.walkRossini = profile.walkMinutes;
          if (profile.stationReachMinutes) {
            updates.stationReachMinutes = {
              ...state.settings.stationReachMinutes,
              ...profile.stationReachMinutes
            };
          }
          if (profile.driveCanegrate) updates.driveCanegrate = profile.driveCanegrate;
          if (profile.focusCity) updates.focusCity = profile.focusCity;
          if (profile.visibleTrains) updates.visibleTrains = profile.visibleTrains;
          if (profile.liveHero) updates.liveHero = profile.liveHero;
          if (profile.favoriteStops && Object.keys(profile.favoriteStops).length > 0) {
            updates.favoriteStops = { ...state.settings.favoriteStops, ...profile.favoriteStops };
          }
          saveFn(updates);
        } else if (profile) {
          saveFn({ userProfile: profile });
        }
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      });
    });
  }

  // Bind notification events
  bindNotificationEvents(container);

  // Bind cloud-sync events (B2)
  bindCloudSyncEvents(container);
}

function buildDefaultSettings(cfg) {
  return {
    ...cfg.defaults,
    favoriteStops: structuredClone(cfg.favoriteStops || {}),
    timetableStops: {},
    visibleStops: {},
    followedLinesByCity: {}
  };
}

function exportSettings(state, cfg) {
  const data = {
    version: cfg.version,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    notifications: getNotificationConfig()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trasporti-preferenze-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSettings(input, saveFn, state, cfg, lineData, lineConfig) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed.settings || typeof parsed.settings !== "object") throw new Error("preferenze mancanti");
      // Apply notifications config first so the saveFn (which triggers a
      // cloud push including notifications) sees the imported value (B16).
      if (parsed.notifications !== undefined) {
        saveNotificationConfig(sanitizeNotifications(parsed.notifications));
      }
      saveFn(sanitizeSettings(parsed.settings, cfg));
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
      alert("Preferenze importate.");
    } catch (error) {
      alert(`Import non valido: ${error.message}`);
    }
  };
  reader.readAsText(file);
  input.value = "";
}

export function sanitizeSettings(raw, cfg) {
  const defaults = buildDefaultSettings(cfg);
  const settings = { ...defaults, ...(raw || {}) };
  settings.focusCity = raw?.focusCity && cfg.focusCities?.[raw.focusCity] ? raw.focusCity : cfg.defaults.focusCity || "BT";
  settings.walkRossini = clampNumber(settings.walkRossini, 1, 30, cfg.defaults.walkRossini);
  settings.driveCanegrate = clampNumber(settings.driveCanegrate, 1, 45, cfg.defaults.driveCanegrate);
  
  settings.connectionTightMin = clampNumber(settings.connectionTightMin, 1, 20, cfg.defaults.connectionTightMin || 4);
  settings.connectionGoodMin = clampNumber(settings.connectionGoodMin, 5, 45, cfg.defaults.connectionGoodMin || 12);
  settings.connectionLongMin = clampNumber(settings.connectionLongMin, 10, 90, cfg.defaults.connectionLongMin || 25);
  
  const stationReachMinutes = {};
  const ALL_STATIONS = Object.keys(TRAIN_STATIONS);
  ALL_STATIONS.forEach(station => {
    const rawVal = raw?.stationReachMinutes?.[station];
    const val = rawVal !== undefined ? rawVal : 0;
    stationReachMinutes[station] = clampNumber(val, 0, 60, 0);
  });
  settings.stationReachMinutes = stationReachMinutes;

  
  settings.liveDirection = settings.liveDirection === "return" ? "return" : "outbound";
  
  const CITY_MAIN_STATION_CODE = {
    BT: "CN_FS",
    VC: "CN_FS",
    DG: "LG_FS",
    AC: "LG_FS",
    CZ: "PB_FS",
    LG: "LG_FS",
    PB: "PB_FS",
    BS: "BS_FS",
  };
  const focusCityCode = settings.focusCity || "BT";
  const mainStation = CITY_MAIN_STATION_CODE[focusCityCode] || "CN_FS";
  settings.visibleTrains = Array.isArray(raw?.visibleTrains) ? raw.visibleTrains : [mainStation];
  settings.liveHero = typeof raw?.liveHero === "string" ? raw.liveHero : "Z649";
  
  // Dynamic favorite stops merge: if favoriteStops is empty/partial, merge with focus city default
  const activeFocusStops = cfg.focusCities?.[settings.focusCity]?.favoriteStops || cfg.favoriteStops || {};
  settings.favoriteStops = { ...structuredClone(activeFocusStops), ...(settings.favoriteStops || {}) };
  
  settings.invertDirections = !!raw?.invertDirections;
  
  settings.timetableStops = settings.timetableStops && typeof settings.timetableStops === "object" ? settings.timetableStops : {};
  settings.visibleStops = settings.visibleStops && typeof settings.visibleStops === "object" ? settings.visibleStops : {};
  settings.followedLinesByCity = raw?.followedLinesByCity && typeof raw.followedLinesByCity === "object" ? raw.followedLinesByCity : {};
  // Preserve userProfile if present (onboarding data)
  if (raw?.userProfile && typeof raw.userProfile === "object") {
    settings.userProfile = raw.userProfile;
  } else if (settings.userProfile && typeof settings.userProfile !== "object") {
    delete settings.userProfile;
  }
  return settings;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function renderCloudSyncSection(_cfg) {
  const user = getCurrentUser();
  const syncStatus = getSyncStatus();

  if (!isFirebaseReady()) {
    return `
      <section class="panel" id="cloud-sync-section">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Cloud Sync</p>
            <h2>Sincronizzazione preferenze</h2>
            <p>Caricamento Firebase in corso...</p>
          </div>
        </div>
      </section>`;
  }

  if (!user) {
    return `
      <section class="panel" id="cloud-sync-section">
        <div class="panel-heading">
          <div>
            <p class="section-eyebrow">Cloud Sync</p>
            <h2>Sincronizza tra dispositivi</h2>
            <p>Accedi con Google per salvare le preferenze nel cloud e sincronizzarle su tutti i tuoi dispositivi.</p>
          </div>
        </div>
        <div class="button-grid">
          <button type="button" class="btn primary" data-cloud-login style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Accedi con Google
          </button>
        </div>
      </section>`;
  }

  // User is logged in – strictly use a generic privacy-first avatar icon
  const photoHtml = `<div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(34, 211, 238, 0.12); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; color: var(--accent);" title="Avatar Generico">
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  </div>`;

  const passphrase = getSyncPassphrase();
  const isLocked = window._cloud_is_encrypted === true && !passphrase;
  
  let cryptoStatusHtml = "";
  if (passphrase) {
    cryptoStatusHtml = `
      <div style="margin-top: 12px; padding: 12px; border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radius); background: rgba(34,197,94,0.06); display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--ok); display: flex; align-items: center; gap: 6px;">
          🔒 Crittografia Zero-Knowledge Attiva (AES-256)
        </span>
        <span style="font-size: 0.75rem; color: var(--muted);">
          Le tue preferenze vengono cifrate sul tuo dispositivo prima di essere caricate. Nessun altro può leggerle.
        </span>
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <input type="password" value="${escapeHtml(passphrase)}" readonly style="flex: 1; min-height: 32px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(255,255,255,0.02); color: var(--muted); padding: 4px 8px; font-size: 0.8rem; font-family: monospace;">
          <button type="button" class="btn secondary" data-sync-passphrase-change style="padding: 2px 8px; font-size: 0.75rem; min-height: 32px;">Modifica</button>
        </div>
      </div>
    `;
  } else if (window._cloud_is_encrypted === true) {
    cryptoStatusHtml = `
      <div style="margin-top: 12px; padding: 12px; border: 1px solid rgba(239,68,68,0.4); border-radius: var(--radius); background: rgba(239,68,68,0.06); display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size: 0.85rem; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 6px;">
          🔒 Sincronizzazione Bloccata
        </span>
        <span style="font-size: 0.75rem; color: var(--muted);">
          I tuoi dati nel cloud sono protetti da crittografia. Inserisci la tua passphrase per sbloccare la sincronizzazione ed accedere alle tue preferenze.
        </span>
        <div style="display: flex; gap: 8px;">
          <input type="password" placeholder="Inserisci Passphrase per sbloccare" data-sync-passphrase-unlock-input style="flex: 1; min-height: 32px; border: 1px solid rgba(239,68,68,0.4); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: 4px 8px; font-size: 0.8rem;">
          <button type="button" class="btn primary" data-unlock-passphrase-btn style="padding: 2px 10px; font-size: 0.75rem; min-height: 32px; background: var(--accent); color: var(--bg); border: 1px solid var(--accent);">Sblocca</button>
        </div>
        <div style="margin-top: 4px; border-top: 1px solid var(--line); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <small style="color: var(--quiet); font-size: 0.72rem;">Chiave persa o dimenticata?</small>
          <button type="button" class="text-btn" data-reset-encrypted-cloud style="color: var(--danger); font-size: 0.72rem; text-decoration: underline; background: none; border: none; cursor: pointer;">Resetta dati cloud</button>
        </div>
      </div>
    `;
  } else {
    cryptoStatusHtml = `
      <div style="margin-top: 12px; padding: 12px; border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius); background: rgba(245,158,11,0.06); display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size: 0.85rem; font-weight: 700; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
          ⚠️ Sincronizzazione in Chiaro
        </span>
        <span style="font-size: 0.75rem; color: var(--muted);">
          Imposta una passphrase per crittografare i tuoi dati sul tuo browser (Zero-Knowledge) prima del caricamento nel cloud.
        </span>
        <div style="display: flex; gap: 8px;">
          <input type="password" placeholder="Passphrase di Sincronizzazione" data-sync-passphrase-input style="flex: 1; min-height: 32px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: 4px 8px; font-size: 0.8rem;">
          <button type="button" class="btn primary" data-save-passphrase-btn style="padding: 2px 10px; font-size: 0.75rem; min-height: 32px;">Proteggi Dati</button>
        </div>
      </div>
    `;
  }

  return `
    <section class="panel" id="cloud-sync-section">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Cloud Sync</p>
          <h2>Profilo connesso</h2>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(16,24,40,0.42);">
        ${photoHtml}
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; font-size: 0.92rem;">${escapeHtml(user.displayName || "Utente")}</strong>
          <small style="color: var(--muted); font-size: 0.75rem;">${escapeHtml(user.email || "")}</small>
        </div>
        <span style="font-size: 0.68rem; font-weight: 700; color: var(--ok); background: rgba(34,197,94,0.12); padding: 3px 8px; border-radius: 999px;">Online</span>
      </div>
      
      ${cryptoStatusHtml}

      <div class="button-grid" style="margin-top: 12px;">
        <button type="button" class="btn primary" data-cloud-push ${isLocked ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}>Salva nel cloud ora</button>
        <button type="button" class="btn secondary" data-cloud-pull ${isLocked ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}>Carica dal cloud</button>
        <button type="button" class="btn secondary" data-cloud-logout>Disconnetti</button>
        <button type="button" class="btn secondary" data-cloud-delete style="color: var(--danger);">Elimina dati cloud</button>
      </div>
      <div style="margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <small style="color: var(--quiet); font-size: 0.72rem;">Le preferenze vengono sincronizzate automaticamente.</small>
        <a href="./privacy.html" target="_blank" rel="noopener" style="color: var(--accent); font-size: 0.75rem; text-decoration: underline; font-weight: 500;">Informativa Privacy e GDPR 🔒</a>
      </div>
    </section>`;
}

function bindCloudSyncEvents(container) {
  const { state, saveFn, cfg, lineData, lineConfig } = lastArgs;

  // Make sure the cross-device listener auto-starts when a session-persisted
  // user is detected by Firebase auth (B7).
  _ensureAuthStateBound();

  // Login
  const loginBtn = container.querySelector("[data-cloud-login]");
  if (loginBtn && !loginBtn.__has_click) {
    loginBtn.__has_click = true;
    loginBtn.addEventListener("click", async () => {
      try {
        const user = await signInWithGoogle();
        if (user) {
          // Try to load cloud settings (already decrypted if correct passphrase was configured during login)
          const cloudPayload = await loadFromCloud();
          
          const cloudSettings = cloudPayload?.settings ?? null;
          const cloudNotifs = cloudPayload?.notifications ?? null;
          
          if (cloudPayload && (cloudSettings || cloudNotifs)) {
            const useCloud = confirm("Trovate preferenze nel cloud. Vuoi sovrascrivere quelle locali con quelle dal cloud?");
            if (useCloud) {
              if (cloudSettings) {
                saveFn(sanitizeSettings(cloudSettings, cfg));
              }
              if (cloudNotifs) {
                saveNotificationConfig(sanitizeNotifications(cloudNotifs));
              }
            } else {
              // Save local to cloud instead
              saveToCloud({
                settings: state.settings,
                notifications: getNotificationConfig()
              });
            }
          } else if (cloudPayload && cloudPayload.isEncrypted) {
            // Sync remains suspended (user skipped passphrase prompt during Google login)
          } else {
            // No cloud data, upload current settings + notifications
            saveToCloud({
              settings: state.settings,
              notifications: getNotificationConfig()
            });
          }
          // Start real-time listener
          _startCloudListener();
          renderSettings(state, saveFn, cfg, lineData, lineConfig);
        }
      } catch (e) {
        alert("Errore durante il login: " + e.message);
      }
    });
  }


  // Logout
  const logoutBtn = container.querySelector("[data-cloud-logout]");
  if (logoutBtn && !logoutBtn.__has_click) {
    logoutBtn.__has_click = true;
    logoutBtn.addEventListener("click", async () => {
      await signOut();
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  }

  // Push to cloud
  const pushBtn = container.querySelector("[data-cloud-push]");
  if (pushBtn && !pushBtn.__has_click) {
    pushBtn.__has_click = true;
    pushBtn.addEventListener("click", () => {
      saveToCloud({
        settings: state.settings,
        notifications: getNotificationConfig()
      });
      alert("Preferenze salvate nel cloud.");
    });
  }

  // Pull from cloud
  const pullBtn = container.querySelector("[data-cloud-pull]");
  if (pullBtn && !pullBtn.__has_click) {
    pullBtn.__has_click = true;
    pullBtn.addEventListener("click", async () => {
      const cloudPayload = await loadFromCloud();
      const cloudSettings = cloudPayload?.settings ?? null;
      const cloudNotifs = cloudPayload?.notifications ?? null;
      if (cloudPayload && (cloudSettings || cloudNotifs)) {
        if (cloudSettings) {
          saveFn(sanitizeSettings(cloudSettings, cfg));
        }
        if (cloudNotifs) {
          saveNotificationConfig(sanitizeNotifications(cloudNotifs));
        }
        alert("Preferenze caricate dal cloud.");
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      } else {
        alert("Nessuna preferenza trovata nel cloud.");
      }
    });
  }

  // Delete cloud data
  const deleteBtn = container.querySelector("[data-cloud-delete]");
  if (deleteBtn && !deleteBtn.__has_click) {
    deleteBtn.__has_click = true;
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Eliminare definitivamente i dati dal cloud? Le preferenze locali rimarranno intatte.")) return;
      await deleteCloudData();
      alert("Dati cloud eliminati.");
    });
  }

  // Imposta Passphrase
  const savePassBtn = container.querySelector("[data-save-passphrase-btn]");
  if (savePassBtn && !savePassBtn.__has_click) {
    savePassBtn.__has_click = true;
    savePassBtn.addEventListener("click", () => {
      const input = container.querySelector("[data-sync-passphrase-input]");
      const val = input ? input.value.trim() : "";
      if (val.length < 4) {
        alert("La passphrase deve essere lunga almeno 4 caratteri per garantire una sicurezza sufficiente.");
        return;
      }
      if (!confirm(
        "Confermi l'impostazione di questa Passphrase di Sincronizzazione?\n\n" +
        "⚠️ IMPORTANTE:\n" +
        "- Se perdi la passphrase, i tuoi dati cifrati nel cloud saranno TOTALMENTE IRRECUPERABILI.\n" +
        "- Non c'è alcun modo per recuperarla (nemmeno dallo sviluppatore o amministratore).\n" +
        "- È strettamente necessaria per accedere alle tue preferenze su altri dispositivi o se effettui di nuovo l'accesso."
      )) {
        return;
      }
      setSyncPassphrase(val);
      // Salva e cifra immediatamente le impostazioni sul cloud
      saveToCloud({
        settings: state.settings,
        notifications: getNotificationConfig()
      });
      alert("Passphrase impostata con successo! I tuoi dati personali sono ora protetti da crittografia Zero-Knowledge.");
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  }

  // Modifica Passphrase
  const changePassBtn = container.querySelector("[data-sync-passphrase-change]");
  if (changePassBtn && !changePassBtn.__has_click) {
    changePassBtn.__has_click = true;
    changePassBtn.addEventListener("click", () => {
      const newPass = prompt("Inserisci la nuova Passphrase di Sincronizzazione (lascia vuoto per disattivare la crittografia):");
      if (newPass === null) return;
      
      const trimmed = newPass.trim();
      if (trimmed === "") {
        if (confirm("Disattivare la crittografia? I tuoi dati sul cloud torneranno ad essere salvati in chiaro.")) {
          setSyncPassphrase(null);
          saveToCloud({
            settings: state.settings,
            notifications: getNotificationConfig()
          });
          alert("Crittografia disattivata.");
          renderSettings(state, saveFn, cfg, lineData, lineConfig);
        }
      } else {
        if (trimmed.length < 4) {
          alert("La passphrase deve essere di almeno 4 caratteri.");
          return;
        }
        if (!confirm(
          "Vuoi aggiornare la Passphrase di Sincronizzazione?\n\n" +
          "⚠️ IMPORTANTE:\n" +
          "- Se perdi la nuova passphrase, i tuoi dati cifrati nel cloud saranno TOTALMENTE IRRECUPERABILI.\n" +
          "- Non c'è alcun modo per recuperarla (nemmeno dallo sviluppatore o amministratore).\n" +
          "- È strettamente necessaria per accedere alle tue preferenze su altri dispositivi o se effettui di nuovo l'accesso."
        )) {
          return;
        }
        setSyncPassphrase(trimmed);
        saveToCloud({
          settings: state.settings,
          notifications: getNotificationConfig()
        });
        alert("Passphrase aggiornata con successo e dati crittografati nuovamente.");
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      }
    });
  }

  // Sblocca Passphrase (stato locked)
  const unlockBtn = container.querySelector("[data-unlock-passphrase-btn]");
  if (unlockBtn && !unlockBtn.__has_click) {
    unlockBtn.__has_click = true;
    unlockBtn.addEventListener("click", async () => {
      const input = container.querySelector("[data-sync-passphrase-unlock-input]");
      const val = input ? input.value.trim() : "";
      if (val === "") {
        alert("Inserisci la passphrase per sbloccare la sincronizzazione.");
        return;
      }
      
      // Temporarily set passphrase to test it
      setSyncPassphrase(val);
      try {
        const cloudPayload = await loadFromCloud();
        
        // If it got here, decryption succeeded!
        const cloudSettings = cloudPayload?.settings ?? null;
        const cloudNotifs = cloudPayload?.notifications ?? null;
        
        if (cloudPayload && (cloudSettings || cloudNotifs)) {
          const useCloud = confirm("Sincronizzazione sbloccata con successo! Trovate preferenze nel cloud.\n\nVuoi sovrascrivere quelle locali con quelle dal cloud?");
          if (useCloud) {
            if (cloudSettings) {
              saveFn(sanitizeSettings(cloudSettings, cfg));
            }
            if (cloudNotifs) {
              saveNotificationConfig(sanitizeNotifications(cloudNotifs));
            }
          } else {
            // Save local to cloud instead
            saveToCloud({
              settings: state.settings,
              notifications: getNotificationConfig()
            });
          }
        } else {
          // Empty cloud, upload local
          saveToCloud({
            settings: state.settings,
            notifications: getNotificationConfig()
          });
        }
        
        window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "synced" } }));
        alert("Sincronizzazione sbloccata con successo!");
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      } catch (err) {
        // Decryption failed or wrong passphrase
        setSyncPassphrase(null); // Clear wrong passphrase
        if (err.message === "passphrase_incorrect") {
          alert("Passphrase errata. Riprova.");
        } else {
          alert("Errore durante lo sblocco: " + err.message);
        }
      }
    });
  }

  // Reset Dati Cloud (stato locked)
  const resetBtn = container.querySelector("[data-reset-encrypted-cloud]");
  if (resetBtn && !resetBtn.__has_click) {
    resetBtn.__has_click = true;
    resetBtn.addEventListener("click", async () => {
      if (!confirm(
        "⚠️ ATTENZIONE: Il reset dei dati cloud eliminerà definitivamente tutte le preferenze crittografate salvate sul server per questo account.\n\n" +
        "I dati locali su questo dispositivo NON verranno eliminati.\n\n" +
        "Vuoi procedere con l'eliminazione dei dati cloud e la rimozione del blocco?"
      )) {
        return;
      }
      
      try {
        await deleteCloudData();
        setSyncPassphrase(null);
        window._cloud_is_encrypted = false;
        window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "synced" } }));
        alert("Dati cloud resettati con successo. La sincronizzazione è stata sbloccata.");
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      } catch (err) {
        alert("Errore durante il reset dei dati cloud: " + err.message);
      }
    });
  }
}


// Internal: start real-time listener for cross-device sync
let _unsubscribeCloudListener = null;
let _authStateBound = false;

/**
 * Subscribe once to auth-state changes so the cross-device listener
 * starts the moment a user is detected (covers session-persisted logins
 * where the user never clicks `[data-cloud-login]`) and stops cleanly
 * on sign-out (B7).
 */
function _ensureAuthStateBound() {
  if (_authStateBound) return;
  _authStateBound = true;
  onAuthStateChanged(user => {
    if (user) {
      _startCloudListener();
    } else if (_unsubscribeCloudListener) {
      _unsubscribeCloudListener();
      _unsubscribeCloudListener = null;
    }
  });
}

function _startCloudListener() {
  if (_unsubscribeCloudListener) _unsubscribeCloudListener();
  _unsubscribeCloudListener = listenForCloudChanges(cloudPayload => {
    if (!lastArgs) return;
    const { state, saveFn, cfg, lineData, lineConfig } = lastArgs;
    // The cloud helper passes either { settings, notifications } or just
    // a bare settings object on the legacy path; tolerate both.
    const rawSettings = cloudPayload && cloudPayload.settings !== undefined
      ? cloudPayload.settings
      : cloudPayload;
    const rawNotifs = cloudPayload && cloudPayload.notifications !== undefined
      ? cloudPayload.notifications
      : null;
    const incomingSettings = sanitizeSettings(rawSettings, cfg);
    const incomingNotifs = rawNotifs !== null
      ? sanitizeNotifications(rawNotifs)
      : getNotificationConfig();
    // Own-write echo guard (B7-echo): if the snapshot is byte-equal to what
    // we already hold locally, skip the callback entirely. Pair this with
    // the timestamp guard inside firebase-sync.js for full coverage.
    if (
      deepEqual(incomingSettings, state.settings) &&
      deepEqual(incomingNotifs, getNotificationConfig())
    ) {
      return;
    }
    // Suppress the cloud-write side of saveSettings while we mutate state
    // and re-render, breaking the auto-sync echo loop (B8).
    setSuppressCloudWrite(true);
    try {
      state.settings = incomingSettings;
      try {
        localStorage.setItem("trasporti_settings", JSON.stringify(state.settings));
      } catch (e) { /* ignore */ }
      if (rawNotifs !== null) {
        saveNotificationConfig(incomingNotifs);
      }
      // Re-render the active tab so the user sees the new state without
      // having to switch tabs (B7).
      if (state.currentTab === "settings") {
        renderSettings(state, saveFn, cfg, lineData, lineConfig);
      } else {
        // Other tabs read state.settings directly; dispatch a typed event so
        // any listeners (e.g. main.js renderCurrentTab) can pick it up.
        document.dispatchEvent(new CustomEvent("trasporti:settings-changed"));
      }
    } finally {
      setSuppressCloudWrite(false);
    }
    console.log("[FirebaseSync] Preferenze aggiornate da altro dispositivo.");
  });
}

/**
 * Structural equality for plain JSON-shaped values. Used by the cloud
 * listener to filter own-write echoes (B7-echo).
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}



function updateSWStatus(container) {
  const el = container.querySelector("[data-sw-status]");
  if (!el) return;
  if (!("serviceWorker" in navigator)) {
    el.textContent = "non disponibile";
    return;
  }
  navigator.serviceWorker.ready
    .then(() => { el.textContent = "attivo"; })
    .catch(() => { el.textContent = "non installato"; });
}
