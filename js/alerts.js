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
  const dismissedMap = getDismissedMap();
  return _alertsData.alerts.filter(a => {
    if (a.type !== "strike") return false;
    if (!isActiveNow(a, now)) return false;

    const dismissedAt = dismissedMap[a.id];
    if (dismissedAt) {
      if (a.startDate) {
        const start = new Date(a.startDate).getTime();
        const reminderStartTime = start - 24 * 60 * 60 * 1000;
        
        // Se è stato cancellato PRIMA che iniziasse la finestra di 24 ore,
        // ma ora siamo nelle ultime 24 ore, ignoriamo la cancellazione precedente
        // e lo visualizziamo di nuovo come "reminder".
        if (dismissedAt < reminderStartTime && now >= reminderStartTime) {
          return true;
        }
      }
      return false;
    }
    return true;
  });
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
  const dismissed = getDismissedMap();
  dismissed[alertId] = Date.now();
  localStorage.setItem(DISMISSED_KEY + "_v2", JSON.stringify(dismissed));
}

/**
 * Render the strike banner for the LIVE tab.
 * Returns HTML string (empty if no active strikes).
 */
export function renderStrikeBanner() {
  const strikes = getStrikeAlerts();
  if (strikes.length === 0) return "";

  const now = Date.now();

  return strikes.map(alert => {
    const services = (alert.affectedServices || []).join(", ");
    const dateRange = formatStrikeDateRange(alert.startDate, alert.endDate);
    const bands = alert.guaranteedBands || "";
    const sourceLabel = { trenord: "Trenord", atm: "ATM Milano" }[alert.source] || alert.source;
    const typeIcon = "🚨";
    
    // Determine if we should display the reminder tag
    let reminderTag = "";
    if (alert.startDate) {
      const start = new Date(alert.startDate).getTime();
      const diffMs = start - now;
      if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
        reminderTag = `<span class="alert-strike-reminder-tag">reminder</span> `;
      }
    }

    const countdownBadge = getCountdownBadge(alert.startDate, alert.endDate);

    // Splitta la stringa per virgola e genera chip/pill HTML separati con classe band-chip
    let bandsHtml = "";
    if (bands) {
      const chips = bands.split(",")
        .map(b => b.trim())
        .filter(Boolean)
        .map(b => `<span class="band-chip">${escapeHtml(b)}</span>`)
        .join("");
      bandsHtml = `<div class="alert-card-bands"><span class="alert-card-bands-label">Fasce di garanzia:</span>${chips}</div>`;
    }

    return `<div class="alert-card alert-card--strike alert-strike-banner" data-alert-id="${escapeHtml(alert.id)}">
      <button type="button" class="alert-card-dismiss alert-strike-dismiss" data-dismiss-alert="${escapeHtml(alert.id)}" aria-label="Chiudi avviso: ${escapeHtml(alert.title)}">✕</button>
      <div class="alert-card-header">
        <span class="alert-card-icon">${typeIcon}</span>
        <div class="alert-card-meta">
          <span class="alert-card-source">${escapeHtml(sourceLabel)}</span>
          ${countdownBadge}
        </div>
      </div>
      <h3 class="alert-card-title">${reminderTag}${escapeHtml(alert.title)}</h3>
      ${dateRange ? `<div class="alert-card-daterange">${dateRange}</div>` : ""}
      ${alert.description && alert.description !== alert.title ? `<p class="alert-card-desc">${escapeHtml(alert.description.slice(0, 300))}</p>` : ""}
      <div class="alert-card-footer">
        ${services ? `<span class="alert-card-services">${escapeHtml(services)}</span>` : ""}
        ${bandsHtml}
      </div>
      ${alert.url ? `<a href="${escapeHtml(alert.url)}" target="_blank" rel="noopener" class="alert-card-link">Dettagli →</a>` : ""}
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

/**
 * Generate a dynamic countdown badge HTML string.
 * Shows "🔴 In corso" if the strike is active now, or "fra N giorni" / "domani" if upcoming.
 */
function getCountdownBadge(startIso, endIso) {
  if (!startIso) return "";
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : start + 24 * 60 * 60 * 1000; // default to 24h duration

  if (now >= start && now <= end) {
    return `<span class="alert-countdown-badge alert-countdown-badge--active">🔴 In corso</span>`;
  }

  if (now < start) {
    const diffMs = start - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      return `<span class="alert-countdown-badge alert-countdown-badge--upcoming">domani</span>`;
    }
    return `<span class="alert-countdown-badge alert-countdown-badge--upcoming">fra ${diffDays} giorni</span>`;
  }

  return "";
}

function renderAlertCard(alert, category) {
  const services = (alert.affectedServices || []).join(", ");
  const dateRange = formatStrikeDateRange(alert.startDate, alert.endDate);
  const bands = alert.guaranteedBands || "";
  const sourceLabel = { trenord: "Trenord", atm: "ATM Milano" }[alert.source] || alert.source;
  const typeIcon = category === "strike" ? "🚨" : "ℹ️";
  const borderClass = category === "strike" ? "alert-card--strike" : "alert-card--notice";

  const countdownBadge = category === "strike" ? getCountdownBadge(alert.startDate, alert.endDate) : "";

  // Splitta la stringa per virgola e genera chip/pill HTML separati con classe band-chip
  let bandsHtml = "";
  if (bands) {
    const chips = bands.split(",")
      .map(b => b.trim())
      .filter(Boolean)
      .map(b => `<span class="band-chip">${escapeHtml(b)}</span>`)
      .join("");
    bandsHtml = `<div class="alert-card-bands"><span class="alert-card-bands-label">Fasce di garanzia:</span>${chips}</div>`;
  }

  return `<div class="alert-card ${borderClass}">
    <div class="alert-card-header">
      <span class="alert-card-icon">${typeIcon}</span>
      <div class="alert-card-meta">
        <span class="alert-card-source">${escapeHtml(sourceLabel)}</span>
        ${countdownBadge}
      </div>
    </div>
    <h3 class="alert-card-title">${escapeHtml(alert.title)}</h3>
    ${dateRange ? `<div class="alert-card-daterange">${dateRange}</div>` : ""}
    ${alert.description && alert.description !== alert.title ? `<p class="alert-card-desc">${escapeHtml(alert.description.slice(0, 300))}</p>` : ""}
    <div class="alert-card-footer">
      ${services ? `<span class="alert-card-services">${escapeHtml(services)}</span>` : ""}
      ${bandsHtml}
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
  // Uno sciopero è attivo ora se:
  // - Non è terminato (endDate è futura o non definita)
  // - Inizia entro 8 giorni
  if (alert.endDate && new Date(alert.endDate).getTime() < now) return false;
  if (alert.startDate) {
    const start = new Date(alert.startDate).getTime();
    
    // In corso o iniziato nelle ultime 48 ore (se non c'è data di fine)
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    const isInProgress = start >= twoDaysAgo && start <= now;
    
    // Inizia entro 8 giorni
    const isWithin8Days = start > now && start <= now + 8 * 24 * 60 * 60 * 1000;

    return isInProgress || isWithin8Days;
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

function getDismissedMap() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY + "_v2") || "{}");
  } catch (e) {
    return {};
  }
}

function getDismissed() {
  const map = getDismissedMap();
  return Object.keys(map);
}

function cleanDismissed() {
  if (!_alertsData?.alerts) return;
  const activeIds = new Set(_alertsData.alerts.map(a => a.id));
  const dismissed = getDismissedMap();
  let changed = false;
  for (const id of Object.keys(dismissed)) {
    if (!activeIds.has(id)) {
      delete dismissed[id];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(DISMISSED_KEY + "_v2", JSON.stringify(dismissed));
  }
}

function formatAlertDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

/**
 * Format a clear date range string for strikes.
 * Example output: "🚨 21:00 del 17 maggio → 20:59 del 18 maggio 2026"
 * @param {string|null} startIso
 * @param {string|null} endIso
 * @returns {string} HTML-safe formatted range (may contain emoji)
 */
function formatStrikeDateRange(startIso, endIso) {
  if (!startIso && !endIso) return "";

  // Filter out dates that are exactly midnight — likely imprecise/auto-generated
  const isReliable = (isoStr) => {
    if (!isoStr) return false;
    const d = new Date(isoStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    // Midnight UTC (00:00) with 0 minutes = likely a date-only guess
    if (m === 0 && h === 0) return false;
    return true;
  };

  const reliableStart = isReliable(startIso) ? startIso : null;
  const reliableEnd = isReliable(endIso) ? endIso : null;

  if (!reliableStart && !reliableEnd) return "";

  const formatDateTime = (isoStr, includeYear) => {
    try {
      const d = new Date(isoStr);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const day = d.getDate();
      const month = d.toLocaleDateString("it-IT", { month: "long" });
      const year = d.getFullYear();
      return includeYear
        ? `${hh}:${mm} del ${day} ${month} ${year}`
        : `${hh}:${mm} del ${day} ${month}`;
    } catch (e) {
      return "";
    }
  };

  if (reliableStart && reliableEnd) {
    const startD = new Date(reliableStart);
    const endD = new Date(reliableEnd);
    const sameYear = startD.getFullYear() === endD.getFullYear();
    const startStr = formatDateTime(reliableStart, !sameYear);
    const endStr = formatDateTime(reliableEnd, true);
    return `⏰ ${startStr} → ${endStr}`;
  }

  if (reliableStart) {
    return `⏰ dalle ${formatDateTime(reliableStart, true)}`;
  }

  return `⏰ fino alle ${formatDateTime(reliableEnd, true)}`;
}

