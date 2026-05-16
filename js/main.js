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
import { initNotifications } from "./notifications.js";
import { initFirebase, saveToCloud, getCurrentUser, onAuthStateChanged, loadFromCloud, listenForCloudChanges } from "./firebase-sync.js";

const LINE_DATA = {
  Z649: Z649_DATA,
  Z627: Z627_DATA,
  Z644: Z644_DATA,
  Z625: Z625_DATA,
  Z647: Z647_DATA,
  Z642: Z642_DATA
};

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
  settings: loadSettings()
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
  // Auto-sync to cloud if logged in
  if (getCurrentUser()) {
    saveToCloud(state.settings);
  }
  renderCurrentTab();
}

function renderCurrentTab() {
  const errorMessage = `<div class="empty-state" style="border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08); color: #fecaca;">
    <strong>Errore di rendering</strong><br>
    <small>Si è verificato un problema nel caricamento di questa sezione. Prova a ricaricare la pagina.</small>
  </div>`;

  try {
    if (state.currentTab === "live") renderLive(state, LINE_DATA, LINE_CONFIG, CFG, saveSettings);
    else if (state.currentTab === "timetable") renderTimetable(state, LINE_DATA, LINE_CONFIG, CFG);
    else if (state.currentTab === "settings") renderSettings(state, saveSettings, CFG, LINE_DATA, LINE_CONFIG);
  } catch (error) {
    console.error(`[Trasporti] Errore nel render del tab "${state.currentTab}":`, error);
    const container = document.getElementById(`${state.currentTab}-content`);
    if (container) container.innerHTML = errorMessage;
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
  navigator.serviceWorker.register("./sw.js").catch(error => {
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
  switchTab("live");
  setInterval(() => {
    if (state.currentTab === "live" || state.currentTab === "timetable") renderCurrentTab();
  }, 60000);
  try {
    initMap();
  } catch (e) {
    console.warn("[Trasporti] Mappa non inizializzata:", e);
  }
  initTheme();
  initFirebase();
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
