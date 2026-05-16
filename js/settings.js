import { getScheduleKey, escapeHtml } from "./utils.js";
import { getStopName } from "./line-config.js";
import { patchDOM } from "./dom-utils.js";
import { renderNotificationSettings, bindNotificationEvents } from "./notifications.js";

let lastArgs = null;

export function renderSettings(state, saveFn, cfg, lineData, lineConfig) {
  lastArgs = { state, saveFn, cfg, lineData, lineConfig };
  const container = document.getElementById("settings-content");
  if (!container) return;
  const settings = state.settings || {};
  const activeLine = state.settingsPanelLine || cfg.lineOrder?.[0] || "Z649";

  const lineOptions = (cfg.lineOrder || []).map(lineId =>
    `<button type="button" data-settings-line="${lineId}" class="${lineId === activeLine ? "active" : ""}">${lineId}</button>`
  ).join("");

  const html = `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Profilo casa</p>
          <h2>${escapeHtml(cfg.homeProfile.address)}</h2>
          <p>${escapeHtml(cfg.homeProfile.note)}</p>
        </div>
      </div>
      <div class="settings-grid">
        <label class="field-row">
          <span>Minuti a piedi verso fermata principale</span>
          <input type="number" min="1" max="30" data-setting-number="walkRossini" value="${Number(settings.walkRossini || cfg.defaults.walkRossini)}">
        </label>
        <label class="field-row">
          <span>Minuti in auto verso Canegrate FS</span>
          <input type="number" min="1" max="45" data-setting-number="driveCanegrate" value="${Number(settings.driveCanegrate || cfg.defaults.driveCanegrate)}">
        </label>
      </div>
    </section>

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

    ${renderNotificationSettings(cfg)}

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
        <button type="button" class="btn secondary" data-check-sw>Aggiorna app</button>
      </div>
      <input type="file" accept=".json,application/json" data-import-file hidden>
      <div class="info-list">
        <div><span>Versione</span><strong>${escapeHtml(cfg.version)}</strong></div>
        <div><span>Aggiornamento dati</span><strong>${escapeHtml(cfg.lastUpdate)}</strong></div>
        <div><span>Service worker</span><strong data-sw-status>verifica...</strong></div>
      </div>
    </section>
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

  container.querySelectorAll("[data-setting-number]").forEach(input => {
    input.addEventListener("change", () => {
      const min = Number(input.min || 0);
      const max = Number(input.max || 999);
      const value = Math.max(min, Math.min(max, Number(input.value || 0)));
      input.value = value;
      saveFn({ [input.dataset.settingNumber]: value });
    });
  });

  container.querySelectorAll("[data-settings-line]").forEach(button => {
    button.addEventListener("click", () => {
      state.settingsPanelLine = button.dataset.settingsLine;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-settings-day]").forEach(button => {
    button.addEventListener("click", () => {
      state.settingsLineDay = button.dataset.settingsDay;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-settings-dir]").forEach(button => {
    button.addEventListener("click", () => {
      state.settingsLineDirection = button.dataset.settingsDir;
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelectorAll("[data-favorite-stop]").forEach(select => {
    select.addEventListener("change", () => {
      const [lineId, direction] = select.dataset.favoriteStop.split(":");
      const favoriteStops = structuredClone(state.settings.favoriteStops || {});
      favoriteStops[lineId] = { ...(favoriteStops[lineId] || {}) };
      favoriteStops[lineId][direction] = select.value;
      saveFn({ favoriteStops });
    });
  });

  container.querySelectorAll("[data-timetable-stop]").forEach(input => {
    input.addEventListener("change", () => {
      const [lineId, scheduleKey] = input.dataset.timetableStop.split(":");
      const checked = [...container.querySelectorAll(`[data-timetable-stop^="${lineId}:${scheduleKey}:"]:checked`)]
        .map(el => el.dataset.timetableStop.split(":")[2]);
      const timetableStops = structuredClone(state.settings.timetableStops || {});
      timetableStops[lineId] = { ...(timetableStops[lineId] || {}) };
      timetableStops[lineId][scheduleKey] = checked;
      saveFn({ timetableStops });
    });
  });

  container.querySelectorAll("[data-reset-line-stops]").forEach(button => {
    button.addEventListener("click", () => {
      const [lineId, scheduleKey] = button.dataset.resetLineStops.split(":");
      const timetableStops = structuredClone(state.settings.timetableStops || {});
      if (timetableStops[lineId]) delete timetableStops[lineId][scheduleKey];
      saveFn({ timetableStops });
      renderSettings(state, saveFn, cfg, lineData, lineConfig);
    });
  });

  container.querySelector("[data-export]")?.addEventListener("click", () => exportSettings(state, cfg));
  container.querySelector("[data-import-trigger]")?.addEventListener("click", () => container.querySelector("[data-import-file]")?.click());
  container.querySelector("[data-import-file]")?.addEventListener("change", event => importSettings(event.target, saveFn, state, cfg, lineData, lineConfig));
  container.querySelector("[data-reset-preferences]")?.addEventListener("click", () => {
    if (!confirm("Ripristinare tutte le preferenze predefinite?")) return;
    localStorage.removeItem("trasporti_settings");
    state.settings = buildDefaultSettings(cfg);
    saveFn(state.settings, true);
    renderSettings(state, saveFn, cfg, lineData, lineConfig);
  });
  container.querySelector("[data-check-sw]")?.addEventListener("click", () => {
    navigator.serviceWorker?.ready.then(reg => reg.update()).finally(() => location.reload());
  });

  // Bind notification events
  bindNotificationEvents(container);

  // Expose renderSettings for notification re-render
  window._app_config = window._app_config || {};
  window._app_config.renderSettings = () => renderSettings(state, saveFn, cfg, lineData, lineConfig);
}

function buildDefaultSettings(cfg) {
  return {
    ...cfg.defaults,
    favoriteStops: structuredClone(cfg.favoriteStops || {}),
    timetableStops: {},
    visibleStops: {}
  };
}

function exportSettings(state, cfg) {
  const data = { version: cfg.version, exportedAt: new Date().toISOString(), settings: state.settings };
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
  settings.walkRossini = clampNumber(settings.walkRossini, 1, 30, cfg.defaults.walkRossini);
  settings.driveCanegrate = clampNumber(settings.driveCanegrate, 1, 45, cfg.defaults.driveCanegrate);
  settings.liveDirection = settings.liveDirection === "return" ? "return" : "outbound";
  settings.favoriteStops = { ...structuredClone(cfg.favoriteStops || {}), ...(settings.favoriteStops || {}) };
  settings.timetableStops = settings.timetableStops && typeof settings.timetableStops === "object" ? settings.timetableStops : {};
  settings.visibleStops = settings.visibleStops && typeof settings.visibleStops === "object" ? settings.visibleStops : {};
  return settings;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
