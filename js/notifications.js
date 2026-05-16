// =============================================================================
// notifications.js – Local notification system with line following & reminders
// =============================================================================
// Uses the browser Notification API (not push from server).
// Works offline and in PWA mode on GitHub Pages.
// =============================================================================

import { minsToHHMM, getDayType, getScheduleKey, getActiveTrips, escapeHtml } from "./utils.js";
import { getStopName } from "./line-config.js";

const STORAGE_KEY = "trasporti_notifications";
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

let checkTimer = null;
let lastNotifiedKey = null; // Prevent duplicate notifications

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the notification system.
 * Call once on app start.
 */
export function initNotifications(getState, getLineData, getLineConfig, getCfg) {
  const ctx = { getState, getLineData, getLineConfig, getCfg };

  // Start the periodic check
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(() => checkReminders(ctx), CHECK_INTERVAL_MS);

  // Also check immediately
  setTimeout(() => checkReminders(ctx), 2000);
}

/**
 * Get current notification config from localStorage.
 */
export function getNotificationConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultConfig();
  } catch (e) {
    return getDefaultConfig();
  }
}

/**
 * Save notification config.
 */
export function saveNotificationConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("[Notifications] Impossibile salvare config:", e);
  }
}

/**
 * Request notification permission from user.
 * @returns {Promise<string>} - "granted", "denied", or "default"
 */
export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

/**
 * Get the current permission status.
 */
export function getPermissionStatus() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Toggle follow/unfollow a line.
 */
export function toggleFollowLine(lineId) {
  const config = getNotificationConfig();
  const idx = config.followedLines.indexOf(lineId);
  if (idx === -1) {
    config.followedLines.push(lineId);
  } else {
    config.followedLines.splice(idx, 1);
    // Remove reminders for this line too
    delete config.reminders[lineId];
  }
  saveNotificationConfig(config);
  return config;
}

/**
 * Check if a line is followed.
 */
export function isLineFollowed(lineId) {
  const config = getNotificationConfig();
  return config.followedLines.includes(lineId);
}

/**
 * Set reminders for a line.
 * @param {string} lineId
 * @param {number[]} minutesBefore - e.g. [5, 10, 15]
 */
export function setReminders(lineId, minutesBefore) {
  const config = getNotificationConfig();
  if (!config.followedLines.includes(lineId)) {
    config.followedLines.push(lineId);
  }
  config.reminders[lineId] = minutesBefore.filter(m => m > 0).sort((a, b) => a - b);
  saveNotificationConfig(config);
  return config;
}

/**
 * Get reminders for a line.
 */
export function getReminders(lineId) {
  const config = getNotificationConfig();
  return config.reminders[lineId] || config.defaultReminders;
}

/**
 * Set default reminder times.
 */
export function setDefaultReminders(minutesBefore) {
  const config = getNotificationConfig();
  config.defaultReminders = minutesBefore.filter(m => m > 0).sort((a, b) => a - b);
  saveNotificationConfig(config);
  return config;
}

/**
 * Toggle global enable/disable.
 */
export function toggleEnabled() {
  const config = getNotificationConfig();
  config.enabled = !config.enabled;
  saveNotificationConfig(config);
  return config;
}

// ── Internal Logic ──────────────────────────────────────────────────────────

function getDefaultConfig() {
  return {
    enabled: true,
    followedLines: [],
    reminders: {},       // { "Z649": [5, 10], "canegrate": [15] }
    defaultReminders: [5, 10],
    lastNotified: {}     // { "Z649_435_10": timestamp } – prevent duplicates
  };
}

/**
 * Main check loop: for each followed line, find the next trip and fire
 * notifications at the configured reminder times.
 */
function checkReminders(ctx) {
  const config = getNotificationConfig();
  if (!config.enabled || config.followedLines.length === 0) return;
  if (getPermissionStatus() !== "granted") return;

  const { getState, getLineData, getLineConfig, getCfg } = ctx;
  const state = getState();
  const lineData = getLineData();
  const lineConfig = getLineConfig();
  const cfg = getCfg();

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const dayType = getDayType(now, cfg);
  const direction = state.settings?.liveDirection || "outbound";

  for (const lineId of config.followedLines) {
    // Handle special "canegrate" line
    if (lineId === "canegrate") {
      checkCanegrateReminder(config, currentMin, state, cfg, now);
      continue;
    }

    const lc = lineConfig[lineId];
    if (!lc) continue;

    const scheduleKey = getScheduleKey(lineId, dayType, direction);
    const trips = lineData[lineId]?.[scheduleKey] || [];
    const profile = cfg.stopProfiles?.[lineId] || {};
    const preferred = state.settings?.favoriteStops?.[lineId]?.[direction] || cfg.favoriteStops?.[lineId]?.[direction];
    const fallbacks = direction === "outbound" ? (profile.outboundHomeStops || lc.referenceStops || []) : (profile.returnHomeStops || []);

    const activeTrips = getActiveTrips(trips, currentMin, 2, preferred, fallbacks);
    if (!activeTrips.length) continue;

    const nextTrip = activeTrips[0];
    const depMin = nextTrip._depMin;
    const waitMin = depMin - currentMin;
    const stopName = getStopName(nextTrip._depStop);

    // Check each reminder threshold
    const reminders = config.reminders[lineId] || config.defaultReminders;
    for (const reminderMin of reminders) {
      const notifKey = `${lineId}_${depMin}_${reminderMin}`;
      if (waitMin <= reminderMin && !config.lastNotified?.[notifKey]) {
        fireNotification(
          `${lineId} tra ${waitMin} min`,
          `Bus ${lineId} parte alle ${minsToHHMM(depMin)} da ${stopName}. Esci ${direction === "outbound" ? "di casa" : "dalla fermata"} presto!`,
          lineId
        );
        markNotified(config, notifKey, now);
      }
    }
  }
}

function checkCanegrateReminder(config, currentMin, state, cfg, now) {
  // Import buildCanegrateBlock dynamically is tricky in static modules,
  // so we use a simplified check based on train slot patterns.
  const driveMin = Number(state.settings?.driveCanegrate || cfg.defaults?.driveCanegrate || 16);
  const trainMinutes = [21, 51]; // S5 from Canegrate at :21 and :51
  const hour = Math.floor(currentMin / 60);

  for (let h = hour; h <= hour + 1 && h < 24; h++) {
    for (const m of trainMinutes) {
      const trainDep = h * 60 + m;
      if (trainDep <= currentMin) continue;
      const leaveIn = trainDep - driveMin - currentMin;
      if (leaveIn < 0) continue;

      const reminders = config.reminders["canegrate"] || config.defaultReminders;
      for (const reminderMin of reminders) {
        const notifKey = `canegrate_${trainDep}_${reminderMin}`;
        if (leaveIn <= reminderMin && !config.lastNotified?.[notifKey]) {
          fireNotification(
            `Canegrate FS tra ${leaveIn} min`,
            `Treno S5 parte alle ${minsToHHMM(trainDep)}. Esci in auto tra ${leaveIn} min (${driveMin} min di guida).`,
            "canegrate"
          );
          markNotified(config, notifKey, now);
        }
      }
      break; // Only check the first upcoming train
    }
  }
}

function wasRecentlyNotified(config, key, now) {
  const ts = config.lastNotified?.[key];
  if (!ts) return false;
  // Prevent re-firing within 90 seconds
  return (now.getTime() - ts) < 90000;
}

function markNotified(config, key, now) {
  if (!config.lastNotified) config.lastNotified = {};
  config.lastNotified[key] = now.getTime();
  // Cleanup old entries (older than 2 hours)
  const cutoff = now.getTime() - 7200000;
  for (const k of Object.keys(config.lastNotified)) {
    if (config.lastNotified[k] < cutoff) delete config.lastNotified[k];
  }
  saveNotificationConfig(config);
}

async function fireNotification(title, body, tag) {
  const options = {
    body,
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    icon: "./icon-192.png",
    badge: "./icon-badge.png"
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        return reg.showNotification(title, options);
      }
    }
    const { vibrate, renotify, requireInteraction, ...legacy } = options;
    const n = new Notification(title, legacy);
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 15000);
  } catch (e) {
    console.warn("[Notifications]", e);
  }
}

// ── Render Helper for Settings UI ───────────────────────────────────────────

/**
 * Generate HTML for the notifications settings section.
 */
export function renderNotificationSettings(cfg) {
  const config = getNotificationConfig();
  const permission = getPermissionStatus();
  const allLines = [...(cfg.lineOrder || []), "canegrate"];

  const permissionHtml = permission === "granted"
    ? `<span style="color: var(--ok); font-weight: 700;">Autorizzate</span>`
    : permission === "denied"
      ? `<span style="color: var(--danger); font-weight: 700;">Bloccate (cambia nelle impostazioni del browser)</span>`
      : `<button type="button" class="btn primary" data-request-notif-permission>Attiva notifiche</button>`;

  const enabledToggle = `<label class="check-row">
    <input type="checkbox" data-notif-toggle-enabled ${config.enabled ? "checked" : ""}>
    <span>Notifiche attive</span>
  </label>`;

  const defaultRemindersHtml = `<div class="field-row">
    <span>Reminder predefiniti (min prima della partenza)</span>
    <input type="text" data-notif-default-reminders 
      value="${(config.defaultReminders || [5, 10]).join(", ")}" 
      placeholder="5, 10, 15"
      style="min-height: 40px; width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: 8px 10px; font: inherit;">
    <small style="color: var(--quiet); font-size: 0.72rem;">Separa i valori con virgola. Es: 5, 10, 15</small>
  </div>`;

  const linesHtml = allLines.map(lineId => {
    const isFollowed = config.followedLines.includes(lineId);
    const label = lineId === "canegrate" ? "Canegrate FS (S5 in auto)" : lineId;
    const customReminders = config.reminders[lineId];
    const remindersDisplay = customReminders ? customReminders.join(", ") : "default";

    return `<div class="field-row" style="flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 12px;">
      <label class="check-row" style="min-height: auto; flex: 1;">
        <input type="checkbox" data-notif-follow-line="${lineId}" ${isFollowed ? "checked" : ""}>
        <span style="font-weight: 700;">${escapeHtml(label)}</span>
      </label>
      ${isFollowed ? `<input type="text" data-notif-line-reminders="${lineId}" 
        value="${remindersDisplay}" 
        placeholder="default"
        style="width: 90px; min-height: 32px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: 4px 8px; font-size: 0.8rem; text-align: center;"
        title="Minuti prima (es: 5,10,15). Scrivi 'default' per usare i predefiniti.">` : ""}
    </div>`;
  }).join("");

  return `
    <section class="panel" id="notification-settings">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Notifiche e Reminder</p>
          <h2>Segui le linee</h2>
          <p>Ricevi un avviso prima della partenza dei bus che segui.</p>
        </div>
      </div>
      <div class="settings-grid">
        <div class="field-row">
          <span>Permesso notifiche</span>
          ${permissionHtml}
        </div>
        ${enabledToggle}
        ${defaultRemindersHtml}
      </div>
      <div style="margin-top: 12px;">
        <strong style="font-size: 0.82rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;">Linee seguite</strong>
        <div class="settings-grid" style="margin-top: 8px;">
          ${linesHtml}
        </div>
      </div>
    </section>
  `;
}

/**
 * Bind events for the notification settings section.
 */
export function bindNotificationEvents(container) {
  // Request permission
  container.querySelector("[data-request-notif-permission]")?.addEventListener("click", async () => {
    const result = await requestPermission();
    if (result === "granted") {
      // Re-render via event bus instead of full page reload
      document.dispatchEvent(new CustomEvent('trasporti:settings-changed'));
    } else {
      alert("Notifiche non autorizzate. Controlla le impostazioni del browser.");
    }
  });

  // Toggle enabled
  container.querySelector("[data-notif-toggle-enabled]")?.addEventListener("change", (e) => {
    const config = getNotificationConfig();
    config.enabled = e.target.checked;
    saveNotificationConfig(config);
  });

  // Default reminders
  container.querySelector("[data-notif-default-reminders]")?.addEventListener("change", (e) => {
    const values = parseReminderInput(e.target.value);
    if (values.length > 0) {
      setDefaultReminders(values);
      e.target.value = values.join(", ");
    }
  });

  // Follow/unfollow lines
  container.querySelectorAll("[data-notif-follow-line]").forEach(input => {
    input.addEventListener("change", () => {
      toggleFollowLine(input.dataset.notifFollowLine);
      // Re-render via event bus
      document.dispatchEvent(new CustomEvent('trasporti:settings-changed'));
    });
  });

  // Per-line reminders
  container.querySelectorAll("[data-notif-line-reminders]").forEach(input => {
    input.addEventListener("change", () => {
      const lineId = input.dataset.notifLineReminders;
      const value = input.value.trim().toLowerCase();
      if (value === "default" || value === "") {
        const config = getNotificationConfig();
        delete config.reminders[lineId];
        saveNotificationConfig(config);
        input.value = "default";
      } else {
        const values = parseReminderInput(value);
        if (values.length > 0) {
          setReminders(lineId, values);
          input.value = values.join(", ");
        }
      }
    });
  });
}

function parseReminderInput(value) {
  return value
    .split(/[,;\s]+/)
    .map(v => parseInt(v.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0 && n <= 60)
    .sort((a, b) => a - b);
}
