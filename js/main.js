import { CFG } from "../data/config.js";
import { LINE_CONFIG } from "./line-config.js";
import { loadLinesForCity, loadSingleLine, getCachedLineData } from "./line-registry.js";
import { renderLive } from "./live.js";
import { renderTimetable } from "./timetable.js";
import { renderSettings, sanitizeSettings } from "./settings.js";
import { getItalianDayName } from "./utils.js";
import { initMap } from "./map.js";
import { initTheme } from "./theme.js";
import { initNotifications, getNotificationConfig } from "./notifications.js";
import { initFirebase, getCurrentUser, saveToCloud, onAuthStateChanged } from "./firebase-sync.js";
import { shouldShowOnboarding, startOnboarding } from "./onboarding.js";
import { initAlerts, renderAlertsTab, renderStrikeBanner, dismissAlert } from "./alerts.js";

// Lazy-loaded module for the trains tab (avoids blocking boot if trains.js fails)
let _renderTrainsTab = null;
async function loadTrainsTab() {
  if (!_renderTrainsTab) {
    try {
      const mod = await import("./trains-tab.js");
      _renderTrainsTab = mod.renderTrainsTab;
    } catch (e) {
      console.warn("[Trasporti] Tab Treni non disponibile:", e);
    }
  }
  return _renderTrainsTab;
}

// Module-level flag used by js/settings.js _startCloudListener to suppress
// the cloud write branch of saveSettings while applying a remote snapshot,
// breaking the auto-sync echo loop (B8).
let _suppressCloudWrite = false;

/**
 * Allow other modules (e.g. js/settings.js) to toggle the cloud-write
 * suppression flag around cloud-listener-driven state mutations.
 * @param {boolean} v
 */
export function setSuppressCloudWrite(v) {
  _suppressCloudWrite = !!v;
}

/**
 * Resolves the active configuration dynamically based on the current focusCity.
 * @param {object} state
 * @param {object} cfg
 * @returns {object}
 */
export function getActiveConfig(state, cfg) {
  const focusCity = state?.settings?.focusCity || cfg?.defaults?.focusCity || "BT";
  const cityCfg = cfg?.focusCities?.[focusCity] || cfg?.focusCities?.["BT"];
  if (!cityCfg) return cfg;
  return {
    ...cfg,
    homeProfile: {
      ...cfg.homeProfile,
      address: cityCfg.homeProfile?.address || cityCfg.name || cfg.homeProfile.address,
      note: cityCfg.homeProfile?.note || `Area di focus attiva: ${cityCfg.name || cfg.homeProfile.address}. Mappa e orari personalizzati.`
    },
    lineOrder: cityCfg.lineOrder || cfg.lineOrder,
    favoriteStops: { ...cfg.favoriteStops, ...(cityCfg.favoriteStops || {}) },
    activeFocusCity: focusCity,
    activeCityConfig: cityCfg
  };
}

// LINE_DATA is now dynamically populated via lazy loading.
// getCachedLineData() returns whatever has been loaded so far.
// Fallback: if dynamic imports fail (e.g. file:// protocol), we import BT lines statically.
let LINE_DATA = {};
let _staticFallbackLoaded = false;

async function loadStaticFallback() {
  if (_staticFallbackLoaded) return;
  _staticFallbackLoaded = true;
  try {
    const [z649, z627, z644, z625, z647, z642] = await Promise.all([
      import("../data/z649.js").then(m => m.Z649_DATA),
      import("../data/z627.js").then(m => m.Z627_DATA),
      import("../data/z644.js").then(m => m.Z644_DATA),
      import("../data/z625.js").then(m => m.Z625_DATA),
      import("../data/z647.js").then(m => m.Z647_DATA),
      import("../data/z642.js").then(m => m.Z642_DATA),
    ]);
    LINE_DATA = { Z649: z649, Z627: z627, Z644: z644, Z625: z625, Z647: z647, Z642: z642 };
  } catch (e) {
    console.error("[Trasporti] Anche il fallback statico è fallito:", e);
  }
}

// `state.settings` is initialized lazily on first access. This breaks the
// `js/main.js` ↔ `js/settings.js` ESM circular-import deadlock.
const state = {
  currentTab: "live",
  timetableLine: null, // will be set after lines load
  timetableDirection: "outbound",
  timetableDayType: null,
  settingsPanelLine: null, // will be set after lines load
  settingsLineDirection: "outbound",
  settingsLineDay: "weekday",
  liveStopFilter: null,
  liveLineFilter: null,
  showAllStops: false,
  showAllLines: false,
  timetableShowAllLines: false,
  linesLoaded: false,
  trainsStation: null,
  trainsDirection: "to_milano",
  trainsShowAllStations: false,
  _settings: null,
  get settings() {
    if (this._settings === null) this._settings = loadSettings();
    return this._settings;
  },
  set settings(v) {
    this._settings = v;
  }
};

function loadSettings() {
  try {
    const raw = localStorage.getItem("trasporti_settings");
    if (raw) return sanitizeSettings(JSON.parse(raw), CFG);
  } catch (error) {
    console.warn("Preferenze non leggibili, uso i default.", error);
  }
  return sanitizeSettings({}, CFG);
}

export function saveSettings(partial) {
  const oldFocusCity = state.settings.focusCity;
  state.settings = sanitizeSettings({ ...state.settings, ...partial }, CFG);
  try {
    localStorage.setItem("trasporti_settings", JSON.stringify(state.settings));
  } catch (error) {
    console.warn("Impossibile salvare le preferenze.", error);
  }
  // Auto-sync to cloud if logged in (skipped while applying a remote snapshot)
  if (!_suppressCloudWrite && getCurrentUser()) {
    saveToCloud({ settings: state.settings, notifications: getNotificationConfig() });
  }
  // If focus city changed, reload lines for the new city
  if (state.settings.focusCity !== oldFocusCity) {
    reloadLinesForCurrentCity().then(() => renderCurrentTab());
  } else {
    renderCurrentTab();
  }
}

/**
 * Load (or reload) line data for the current focus city.
 * Updates LINE_DATA and state.linesLoaded.
 */
async function reloadLinesForCurrentCity() {
  const focusCity = state.settings?.focusCity || CFG.defaults?.focusCity || "BT";
  try {
    const loaded = await loadLinesForCity(CFG, focusCity);
    LINE_DATA = { ...getCachedLineData(), ...loaded };
    state.linesLoaded = true;

    // Set default timetable/settings line to first available
    const activeCFG = getActiveConfig(state, CFG);
    const firstLine = activeCFG.lineOrder?.[0] || Object.keys(LINE_DATA)[0] || "Z649";
    if (!state.timetableLine) state.timetableLine = firstLine;
    if (!state.settingsPanelLine) state.settingsPanelLine = firstLine;
  } catch (e) {
    console.error("[Trasporti] Errore nel caricamento linee:", e);
    // Fallback: try loading BT lines statically
    if (Object.keys(LINE_DATA).length === 0) {
      await loadStaticFallback();
    }
    state.linesLoaded = true; // unblock UI even on failure
  }
}

let _rendering = false;

function renderCurrentTab() {
  // Prevent re-entrant rendering which can cause infinite loops when
  // event handlers inside a render trigger saveSettings → renderCurrentTab
  if (_rendering) return;
  _rendering = true;

  const errorMessage = `<div class="empty-state" style="border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08); color: #fecaca;">
    <strong>Errore di rendering</strong><br>
    <small>Si è verificato un problema nel caricamento di questa sezione. Prova a ricaricare la pagina.</small>
  </div>`;

  // Show loading state if lines haven't loaded yet
  if (!state.linesLoaded && (state.currentTab === "live" || state.currentTab === "timetable")) {
    const container = document.getElementById(`${state.currentTab}-content`);
    if (container) {
      container.innerHTML = `<div class="empty-state">Caricamento orari...</div>`;
    }
    _rendering = false;
    return;
  }

  try {
    const activeCFG = getActiveConfig(state, CFG);
    if (state.currentTab === "live") renderLive(state, LINE_DATA, LINE_CONFIG, activeCFG, saveSettings);
    else if (state.currentTab === "timetable") renderTimetable(state, LINE_DATA, LINE_CONFIG, activeCFG, saveSettings);
    else if (state.currentTab === "trains") {
      loadTrainsTab().then(fn => {
        if (fn) fn(state, activeCFG, saveSettings);
        else {
          const c = document.getElementById("trains-content");
          if (c) c.innerHTML = `<div class="empty-state">Tab Treni in caricamento...</div>`;
        }
      });
    }
    else if (state.currentTab === "alerts") renderAlertsTab();
    else if (state.currentTab === "settings") renderSettings(state, saveSettings, activeCFG, LINE_DATA, LINE_CONFIG);
  } catch (error) {
    console.error(`[Trasporti] Errore nel render del tab "${state.currentTab}":`, error);
    const container = document.getElementById(`${state.currentTab}-content`);
    if (container) container.innerHTML = errorMessage;
  } finally {
    _rendering = false;
  }
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
  renderCurrentTab();
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = `${getItalianDayName(now)} ${now.toLocaleDateString("it-IT")}`;
  document.getElementById("clock-time").textContent = time;
  document.getElementById("clock-date").textContent = date;
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").then(reg => {
    // Check for updates immediately on every page load
    reg.update().catch(() => {});
    // When a new SW is found and installed, reload to pick up fresh assets
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
          // New SW activated — reload to serve fresh content
          window.location.reload();
        }
      });
    });
  }).catch(error => {
    console.warn("Service worker non registrato.", error);
  });
}

async function init() {
  window._app_config = { CFG, switchTab };
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  updateClock();
  setInterval(updateClock, 1000);

  // Sincronizzazione Pillola & Connettività
  const updateSyncPill = (forcedStatus) => {
    const pill = document.getElementById("sync-pill");
    const text = document.getElementById("sync-status-text");
    if (!pill || !text) return;

    pill.className = "sync-pill"; // reset
    if (!navigator.onLine) {
      pill.classList.add("sync-status-offline");
      text.textContent = "Offline - Dati Locali";
      pill.title = "Sei disconnesso dalla rete. L'app usa i dati locali salvati sul dispositivo.";
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      pill.classList.add("sync-status-synced");
      pill.style.background = "rgba(100, 116, 139, 0.12)";
      pill.style.color = "var(--muted)";
      pill.style.borderColor = "var(--line)";
      text.textContent = "Dati Locali";
      pill.title = "Sei online. Accedi nelle Impostazioni per attivare la sincronizzazione cloud.";
      return;
    }

    // Reset inline styles
    pill.style.background = "";
    pill.style.color = "";
    pill.style.borderColor = "";

    const status = (typeof forcedStatus === "string") ? forcedStatus : (window._last_sync_status || "synced");
    window._last_sync_status = status;

    if (status === "pending" || status === "syncing") {
      pill.classList.add("sync-status-syncing");
      text.textContent = "Sincronizzazione...";
      pill.title = "Sincronizzazione in corso con il cloud...";
    } else if (status === "error") {
      pill.classList.add("sync-status-offline");
      text.textContent = "Errore Sync";
      pill.title = "Si è verificato un errore durante il salvataggio sul cloud.";
    } else {
      pill.classList.add("sync-status-synced");
      text.textContent = "Sincronizzato";
      pill.title = `Sincronizzato con il cloud (${user.email}).`;
    }
  };

  // Listeners di connettività
  window.addEventListener("online", updateSyncPill);
  window.addEventListener("offline", updateSyncPill);
  window.addEventListener("trasporti:sync-status", (e) => updateSyncPill(e.detail.status));

  // Gestione tasti freccia per la barra dei tab
  const tabBar = document.querySelector(".tab-bar[role='tablist']");
  if (tabBar) {
    const tabs = Array.from(tabBar.querySelectorAll("[role='tab']"));
    tabBar.addEventListener("keydown", (e) => {
      let index = tabs.findIndex(t => t.classList.contains("active"));
      if (index === -1) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        index = (index + 1) % tabs.length;
        tabs[index].focus();
        switchTab(tabs[index].dataset.tab);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        index = (index - 1 + tabs.length) % tabs.length;
        tabs[index].focus();
        switchTab(tabs[index].dataset.tab);
      } else if (e.key === "Home") {
        e.preventDefault();
        tabs[0].focus();
        switchTab(tabs[0].dataset.tab);
      } else if (e.key === "End") {
        e.preventDefault();
        tabs[tabs.length - 1].focus();
        switchTab(tabs[tabs.length - 1].dataset.tab);
      }
    });
  }

  try {
    initFirebase();
    updateSyncPill();
  } catch (e) {
    console.warn("[Firebase]", e);
  }
  onAuthStateChanged(() => {
    updateSyncPill();
    if (state.currentTab === "settings") renderCurrentTab();
  });
  document.addEventListener("trasporti:settings-changed", () => {
    updateSyncPill();
    if (state.currentTab === "settings") renderCurrentTab();
  });

  // Load line data for the current focus city
  try {
    await reloadLinesForCurrentCity();
  } catch (e) {
    console.error("[Trasporti] Errore critico nel caricamento linee:", e);
    state.linesLoaded = true; // unblock UI even on failure
  }

  // Show onboarding wizard on first launch (before rendering any tab)
  if (shouldShowOnboarding(state.settings)) {
    startOnboarding((profile) => {
      if (profile && !profile.skipped) {
        // Apply the profile to settings
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
        saveSettings(updates);
        // Set up notifications if requested
        if (profile.wantNotifications && profile.activeLines?.length > 0) {
          import("./notifications.js").then(({ requestPermission, getNotificationConfig, saveNotificationConfig }) => {
            requestPermission().then(perm => {
              if (perm === "granted") {
                const notifConfig = getNotificationConfig();
                notifConfig.enabled = true;
                notifConfig.followedLines = [...new Set([...notifConfig.followedLines, ...profile.activeLines])];
                if (profile.useCanegrate) notifConfig.followedLines.push("canegrate");
                saveNotificationConfig(notifConfig);
              }
            });
          });
        }
      } else if (profile) {
        // Skipped — just mark onboarding as done without changing anything else
        saveSettings({ userProfile: profile });
      }
      // Proceed to render the app
      switchTab("live");
    });
  } else {
    switchTab("live");
  }
  // Load remaining lines in the background to ensure search, map popups, and other features have full data (skipping in test envs)
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
    setTimeout(ensureAllLinesLoaded, 1000);
  }
  setInterval(() => {
    if (state.currentTab === "live" || state.currentTab === "timetable") {
      // Skip re-render if user has a dep-stop-select dropdown open (would destroy it mid-interaction)
      const selectOpen = document.querySelector(".dep-stop-select[style*='display: inline'], .dep-stop-select[style*='display:inline']");
      const anyVisible = selectOpen || [...document.querySelectorAll(".dep-stop-select")].some(s => s.style.display && s.style.display !== "none");
      if (anyVisible) return;
      renderCurrentTab();
    }
  }, 60000);
  try {
    initMap();
  } catch (e) {
    console.warn("[Trasporti] Mappa non inizializzata:", e);
  }
  initTheme();
  initAlerts(() => {
    // Re-render current tab once alerts are loaded so banners appear on first load
    renderCurrentTab();
  });
  initNotifications(
    () => state,
    () => LINE_DATA,
    () => LINE_CONFIG,
    () => getActiveConfig(state, CFG)
  );
  registerSW();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(e => {
    console.error("[Trasporti] Errore fatale nell'inizializzazione:", e);
    // Show error in UI so user knows something went wrong
    const liveContent = document.getElementById("live-content");
    if (liveContent) {
      liveContent.innerHTML = `<div class="empty-state" style="border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08); color: #fecaca;">
        <strong>Errore di avvio</strong><br>
        <small>${e.message || "Errore sconosciuto"}. Prova a ricaricare la pagina (Ctrl+Shift+R).</small>
      </div>`;
    }
  });
});

export function getState() {
  return state;
}

export function getLineData() {
  return LINE_DATA;
}

export function getLineConfig() {
  return LINE_CONFIG;
}

/**
 * Load a specific line on demand (used by timetable/search when user
 * selects a line not in their focus city).
 * @param {string} lineId
 * @returns {Promise<object|null>}
 */
export async function ensureLineLoaded(lineId) {
  if (LINE_DATA[lineId]) return LINE_DATA[lineId];
  const data = await loadSingleLine(lineId);
  if (data) {
    LINE_DATA[lineId] = data;
  }
  return data;
}

/**
 * Load all available lines in the registry to ensure full coverage
 * across all cities (used by search, map markers, and notifications).
 * @returns {Promise<object>}
 */
export async function ensureAllLinesLoaded() {
  try {
    const { getAllLineIds, loadLines, getCachedLineData } = await import("./line-registry.js");
    const allIds = getAllLineIds();
    const loaded = await loadLines(allIds);
    LINE_DATA = { ...getCachedLineData(), ...loaded };
  } catch (e) {
    console.warn("[Trasporti] Impossibile caricare tutte le linee in background:", e);
  }
  return LINE_DATA;
}
