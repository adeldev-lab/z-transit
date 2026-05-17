import { CFG } from "../data/config.js";
import { Z649_DATA } from "../data/z649.js";
import { Z627_DATA } from "../data/z627.js";
import { Z644_DATA } from "../data/z644.js";
import { Z625_DATA } from "../data/z625.js";
import { Z647_DATA } from "../data/z647.js";
import { Z642_DATA } from "../data/z642.js";
import { LINE_CONFIG } from "./line-config.js";
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

const LINE_DATA = {
  Z649: Z649_DATA,
  Z627: Z627_DATA,
  Z644: Z644_DATA,
  Z625: Z625_DATA,
  Z647: Z647_DATA,
  Z642: Z642_DATA
};

// `state.settings` is initialized lazily on first access. This breaks the
// `js/main.js` ↔ `js/settings.js` ESM circular-import deadlock: when a
// consumer imports `js/settings.js` first, that module's evaluation is
// paused on `import { setSuppressCloudWrite } from "./main.js"`. Node
// then evaluates `js/main.js`, but the `sanitizeSettings` binding from
// `js/settings.js` is still in the TDZ. Calling it from a top-level
// `loadSettings()` would throw `TypeError: sanitizeSettings is not a
// function`. Deferring the call to first access of `state.settings`
// guarantees both modules have finished evaluating before
// `sanitizeSettings` is invoked.
const state = {
  currentTab: "live",
  timetableLine: "Z649",
  timetableDirection: "outbound",
  timetableDayType: null,
  settingsPanelLine: "Z649",
  settingsLineDirection: "outbound",
  settingsLineDay: "weekday",
  liveStopFilter: null,
  liveLineFilter: null,
  showAllStops: false,
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
  renderCurrentTab();
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

  try {
    if (state.currentTab === "live") renderLive(state, LINE_DATA, LINE_CONFIG, CFG, saveSettings);
    else if (state.currentTab === "timetable") renderTimetable(state, LINE_DATA, LINE_CONFIG, CFG);
    else if (state.currentTab === "alerts") renderAlertsTab();
    else if (state.currentTab === "settings") renderSettings(state, saveSettings, CFG, LINE_DATA, LINE_CONFIG);
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
    btn.classList.toggle("active", btn.dataset.tab === tabId);
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

function init() {
  window._app_config = { CFG };
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  updateClock();
  setInterval(updateClock, 1000);
  try {
    initFirebase();
  } catch (e) {
    console.warn("[Firebase]", e);
  }
  onAuthStateChanged(() => {
    if (state.currentTab === "settings") renderCurrentTab();
  });
  document.addEventListener("trasporti:settings-changed", () => {
    if (state.currentTab === "settings") renderCurrentTab();
  });

  // Show onboarding wizard on first launch (before rendering any tab)
  if (shouldShowOnboarding(state.settings)) {
    startOnboarding((profile) => {
      if (profile && !profile.skipped) {
        // Apply the profile to settings
        const updates = { userProfile: profile };
        if (profile.walkMinutes) updates.walkRossini = profile.walkMinutes;
        if (profile.driveCanegrate) updates.driveCanegrate = profile.driveCanegrate;
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
  setInterval(() => {
    if (state.currentTab === "live" || state.currentTab === "timetable") renderCurrentTab();
  }, 60000);
  try {
    initMap();
  } catch (e) {
    console.warn("[Trasporti] Mappa non inizializzata:", e);
  }
  initTheme();
  initAlerts();
  initNotifications(
    () => state,
    () => LINE_DATA,
    () => LINE_CONFIG,
    () => CFG
  );
  registerSW();
}

document.addEventListener("DOMContentLoaded", init);

export function getState() {
  return state;
}

export function getLineData() {
  return LINE_DATA;
}

export function getLineConfig() {
  return LINE_CONFIG;
}
