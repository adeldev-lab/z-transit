// =============================================================================
// alerts.js – Transport alerts (strikes & disruptions) display
// =============================================================================
// Fetches alerts.json (pushed by the private scraper repo) and provides:
//   - getStrikeAlerts() → only strikes (shown as banners in LIVE tab)
//   - getAllAlerts() → all alerts (shown in the dedicated Avvisi tab)
//   - renderAlertBanner() → HTML for the LIVE tab strike banner
//   - renderAlertsTab() → full HTML for the Avvisi tab
// =============================================================================

import { escapeHtml } from "./utils.js";
import { patchDOM } from "./dom-utils.js";

const ALERTS_URL = "./alerts.json";
const DISMISSED_KEY = "trasporti_dismissed_alerts";
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

let _alertsData = null;
let _lastFetch = 0;
let _onAlertsReady = null;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize alerts: fetch on startup, set up periodic refresh.
 * @param {Function} [onReady] - called after first successful fetch (to trigger re-render)
 */
export function initAlerts(onReady) {
  _onAlertsReady = onReady || null;
  fetchAlerts();
  setInterval(fetchAlerts, REFRESH_INTERVAL);
}

/**
 * Get only strike alerts (type === "strike") that are currently active.
 * These are shown as banners in the LIVE tab.
 */
export function getStrikeAlerts() {
  if (!_alertsData?.alerts) return [];
  const now = Date.now();
  const dismissed = getDismissed();
  return _alertsData.alerts.filter(a =>
    a.type === "strike" &&
    !dismissed.includes(a.id) &&
    isActiveNow(a, now)
  );
}

/**
 * Get all alerts grouped by category for the Avvisi tab.
 * Returns { strikes: [...], notices: [...], lastUpdated: string }
 */
export function getAllAlerts() {
  if (!_alertsData?.alerts) return { strikes: [], notices: [], lastUpdated: null };
  const now = Date.now();
  const active = _alertsData.alerts.filter(a => isActiveOrUpcoming(a, now));
  return {
    strikes: active.filter(a => a.type === "strike"),
    notices: active.filter(a => a.type !== "strike"),
    lastUpdated: _alertsData.lastUpdated || null
  };
}

/**
 * Dismiss an alert (hide from LIVE banner).
 */
export function dismissAlert(alertId) {
  const dismissed = getDismissed();
  if (!dismissed.includes(alertId)) {
    dismissed.push(alertId);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}

/**
 * Render the strike banner for the LIVE tab.
 * Returns HTML string (empty if no active strikes).
 */
export function renderStrikeBanner() {
  const strikes = getStrikeAlerts();
  if (strikes.length === 0) return "";

  return strikes.map(alert => {
    const services = (alert.affectedServices || []).join(", ");
    const bands = alert.guaranteedBands ? `Fasce garanzia: ${escapeHtml(alert.guaranteedBands)}` : "";
    const dateStr = alert.startDate ? formatAlertDate(alert.startDate) : "";

    return `<div class="alert-strike-banner" data-alert-id="${escapeHtml(alert.id)}">
      <div class="alert-strike-icon">⚠️</div>
      <div class="alert-strike-body">
        <strong class="alert-strike-title">${escapeHtml(alert.title)}</strong>
        ${dateStr ? `<span class="alert-strike-date">${dateStr}</span>` : ""}
        ${services ? `<span class="alert-strike-services">${escapeHtml(services)}</span>` : ""}
        ${bands ? `<small class="alert-strike-bands">${bands}</small>` : ""}
      </div>
      <button type="button" class="alert-strike-dismiss" data-dismiss-alert="${escapeHtml(alert.id)}" aria-label="Chiudi avviso">✕</button>
    </div>`;
  }).join("");
}

/**
 * Render the full Avvisi tab content.
 */
export function renderAlertsTab() {
  const container = document.getElementById("alerts-content");
  if (!container) return;

  const { strikes, notices, lastUpdated } = getAllAlerts();
  const updatedStr = lastUpdated ? formatAlertDate(lastUpdated) : "mai";

  let html = `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="section-eyebrow">Avvisi trasporti</p>
          <h2>Scioperi e disservizi</h2>
          <p>Informazioni su scioperi Trenord, ATM e Movibus.</p>
        </div>
      </div>
      <small style="color: var(--quiet); font-size: 0.72rem;">Ultimo aggiornamento: ${escapeHtml(updatedStr)}</small>
    </section>
  `;

  // Strikes section
  if (strikes.length > 0) {
    html += `<div class="section-title">🚨 Scioperi</div>`;
    html += strikes.map(a => renderAlertCard(a, "strike")).join("");
  }

  // Notices section
  if (notices.length > 0) {
    html += `<div class="section-title" style="margin-top: 16px;">📋 Avvisi servizio</div>`;
    html += notices.map(a => renderAlertCard(a, "notice")).join("");
  }

  // Empty state
  if (strikes.length === 0 && notices.length === 0) {
    html += `<div class="empty-state">
      <strong>Nessun avviso attivo</strong><br>
      <small>Nessuno sciopero o disservizio segnalato per i prossimi giorni. Buon viaggio! 🚌</small>
    </div>`;
  }

  patchDOM(container, html);
}

// ── Internal ────────────────────────────────────────────────────────────────

function renderAlertCard(alert, category) {
  const services = (alert.affectedServices || []).join(", ");
  const dateStr = alert.startDate ? formatAlertDate(alert.startDate) : "";
  const endStr = alert.endDate ? formatAlertDate(alert.endDate) : "";
  const bands = alert.guaranteedBands || "";
  const sourceLabel = { trenord: "Trenord", atm: "ATM Milano" }[alert.source] || alert.source;
  const typeIcon = category === "strike" ? "🚨" : "ℹ️";
  const borderClass = category === "strike" ? "alert-card--strike" : "alert-card--notice";

  return `<div class="alert-card ${borderClass}">
    <div class="alert-card-header">
      <span class="alert-card-icon">${typeIcon}</span>
      <div class="alert-card-meta">
        <span class="alert-card-source">${escapeHtml(sourceLabel)}</span>
        ${dateStr ? `<span class="alert-card-date">${dateStr}${endStr ? ` → ${endStr}` : ""}</span>` : ""}
      </div>
    </div>
    <h3 class="alert-card-title">${escapeHtml(alert.title)}</h3>
    ${alert.description && alert.description !== alert.title ? `<p class="alert-card-desc">${escapeHtml(alert.description.slice(0, 300))}</p>` : ""}
    <div class="alert-card-footer">
      ${services ? `<span class="alert-card-services">${escapeHtml(services)}</span>` : ""}
      ${bands ? `<span class="alert-card-bands">Garanzia: ${escapeHtml(bands)}</span>` : ""}
    </div>
    ${alert.url ? `<a href="${escapeHtml(alert.url)}" target="_blank" rel="noopener" class="alert-card-link">Dettagli →</a>` : ""}
  </div>`;
}

async function fetchAlerts() {
  try {
    const res = await fetch(ALERTS_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const wasEmpty = !_alertsData;
    _alertsData = await res.json();
    _lastFetch = Date.now();
    cleanDismissed();
    // On first successful fetch, trigger a re-render so banners appear
    if (wasEmpty && _onAlertsReady && _alertsData.alerts?.length > 0) {
      _onAlertsReady();
    }
  } catch (e) {
    // Silently fail — app works without alerts
  }
}

function isActiveNow(alert, now) {
  // A strike is "active now" if:
  // - It has no endDate and startDate is within the past 2 days or in the future
  // - It has an endDate that hasn't passed yet
  if (alert.endDate && new Date(alert.endDate).getTime() < now) return false;
  if (alert.startDate) {
    const start = new Date(alert.startDate).getTime();
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    return start > twoDaysAgo;
  }
  return true;
}

function isActiveOrUpcoming(alert, now) {
  // For the Avvisi tab: show anything from the past 7 days or upcoming
  if (alert.endDate && new Date(alert.endDate).getTime() < now) return false;
  if (alert.startDate) {
    const start = new Date(alert.startDate).getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return start > sevenDaysAgo;
  }
  return true;
}

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function cleanDismissed() {
  if (!_alertsData?.alerts) return;
  const activeIds = new Set(_alertsData.alerts.map(a => a.id));
  const dismissed = getDismissed().filter(id => activeIds.has(id));
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
}

function formatAlertDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}
