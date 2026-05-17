// =============================================================================
// onboarding.js – First-run wizard for personalizing the app
// =============================================================================
// Shows a fullscreen step-by-step wizard on first launch. Produces a
// `userProfile` object that is merged into state.settings and synced to cloud.
// If the user skips or has already completed onboarding, the app works
// identically to before (all existing defaults from config.js apply).
// =============================================================================

import { getStopName } from "./line-config.js";

// ── Zone definitions (Busto Garolfo) ────────────────────────────────────────
const HOME_ZONES = [
  {
    id: "via_buonarroti",
    label: "Via Buonarroti / Centro",
    description: "Fermata principale BT703 – ~3 min a piedi",
    stop: "BT703",
    walkMinutes: 3
  },
  {
    id: "via_rossini",
    label: "Via Rossini / Sud",
    description: "Fermata BT775 – ~5 min a piedi",
    stop: "BT775",
    walkMinutes: 5
  },
  {
    id: "via_montebianco",
    label: "Via Montebianco / Nord",
    description: "Fermata BT956 – ~8 min a piedi",
    stop: "BT956",
    walkMinutes: 8
  },
  {
    id: "piscina",
    label: "Piscina / Via Busto Arsizio",
    description: "Fermate BT949/BT951 – ~4 min a piedi",
    stop: "BT949",
    walkMinutes: 4
  },
  {
    id: "deposito",
    label: "Deposito / Via Busto A. 131",
    description: "Fermata BT999 – ~5 min a piedi",
    stop: "BT999",
    walkMinutes: 5
  }
];

// ── Destination → lines mapping ─────────────────────────────────────────────
const DESTINATIONS = [
  {
    id: "milano_m1",
    label: "Milano via M1 (Molino Dorino)",
    emoji: "🚇",
    lines: ["Z649"],
    lineLabel: "Z649"
  },
  {
    id: "milano_s5_pregnana",
    label: "Milano via S5/S6 (Pregnana FS)",
    emoji: "🚄",
    lines: ["Z649"],
    lineLabel: "Z649"
  },
  {
    id: "legnano",
    label: "Legnano FS",
    emoji: "🚄",
    lines: ["Z627", "Z642"],
    lineLabel: "Z627 · Z642"
  },
  {
    id: "parabiago",
    label: "Parabiago FS",
    emoji: "🚄",
    lines: ["Z644"],
    lineLabel: "Z644"
  },
  {
    id: "busto_arsizio",
    label: "Busto Arsizio FS",
    emoji: "🚄",
    lines: ["Z625"],
    lineLabel: "Z625"
  },
  {
    id: "castano",
    label: "Castano Primo / Arconate",
    emoji: "🏫",
    lines: ["Z647"],
    lineLabel: "Z647"
  },
  {
    id: "canegrate_auto",
    label: "Canegrate FS in auto",
    emoji: "🚗",
    lines: [],
    lineLabel: "S5 treno"
  }
];

// ── Favorite stop derivation per zone ───────────────────────────────────────
// Given a homeZone, derive the best favorite stops for each line/direction.
// Falls back to config.js defaults if not mapped here.
const ZONE_FAVORITES = {
  via_buonarroti: {
    Z649: { outbound: "BT703", return: "BT956" },
    Z627: { outbound: "BT301", return: "BT947" },
    Z644: { outbound: "BT703", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT703" },
    Z642: { outbound: "BT703", return: "BT775" }
  },
  via_rossini: {
    Z649: { outbound: "BT775", return: "BT956" },
    Z627: { outbound: "BT301", return: "BT947" },
    Z644: { outbound: "BT775", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT775" },
    Z642: { outbound: "BT956", return: "BT775" }
  },
  via_montebianco: {
    Z649: { outbound: "BT956", return: "BT956" },
    Z627: { outbound: "BT703", return: "BT947" },
    Z644: { outbound: "BT775", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT775" },
    Z642: { outbound: "BT956", return: "BT775" }
  },
  piscina: {
    Z649: { outbound: "BT949", return: "BT951" },
    Z627: { outbound: "BT703", return: "BT947" },
    Z644: { outbound: "BT775", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT775" },
    Z642: { outbound: "BT956", return: "BT775" }
  },
  deposito: {
    Z649: { outbound: "BT999", return: "BT999" },
    Z627: { outbound: "BT703", return: "BT947" },
    Z644: { outbound: "BT775", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT775" },
    Z642: { outbound: "BT956", return: "BT775" }
  }
};

// ── Wizard State ────────────────────────────────────────────────────────────
let wizardState = {
  step: 1,
  userType: null,        // "resident_bg" | "visitor" | "skip"
  homeZone: null,        // zone id
  destinations: [],      // destination ids
  useCanegrate: false,
  driveCanegrate: 16,
  activeLines: [],
  favoriteStops: {},
  walkMinutes: 6,
  homeStop: null,
  wantNotifications: false
};

let overlayEl = null;
let onCompleteCallback = null;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if onboarding should be shown.
 */
export function shouldShowOnboarding(settings) {
  return !settings?.userProfile?.onboardingVersion;
}

/**
 * Start the onboarding wizard.
 * @param {Function} onComplete - called with the resulting userProfile object
 */
export function startOnboarding(onComplete) {
  onCompleteCallback = onComplete;
  wizardState = {
    step: 1,
    userType: null,
    homeZone: null,
    destinations: [],
    useCanegrate: false,
    driveCanegrate: 16,
    activeLines: [],
    favoriteStops: {},
    walkMinutes: 6,
    homeStop: null,
    wantNotifications: false
  };
  showOverlay();
  renderStep();
}

/**
 * Dismiss the wizard without saving (skip).
 */
export function dismissOnboarding() {
  hideOverlay();
  if (onCompleteCallback) onCompleteCallback(null);
}

// ── Overlay Management ──────────────────────────────────────────────────────

function showOverlay() {
  if (overlayEl) { overlayEl.remove(); }
  overlayEl = document.createElement("div");
  overlayEl.className = "onboarding-overlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.setAttribute("aria-label", "Configurazione iniziale");
  document.body.appendChild(overlayEl);
  requestAnimationFrame(() => overlayEl.classList.add("open"));
}

function hideOverlay() {
  if (!overlayEl) return;
  overlayEl.classList.remove("open");
  setTimeout(() => { overlayEl?.remove(); overlayEl = null; }, 350);
}

// ── Step Rendering ──────────────────────────────────────────────────────────

function renderStep() {
  if (!overlayEl) return;
  const totalSteps = wizardState.userType === "visitor" ? 4 : 5;
  const currentStep = wizardState.step;

  let content = "";
  switch (currentStep) {
    case 1: content = renderStep1(); break;
    case 2: content = wizardState.userType === "visitor" ? renderStep3() : renderStep2(); break;
    case 3: content = wizardState.userType === "visitor" ? renderStep4() : renderStep3(); break;
    case 4: content = wizardState.userType === "visitor" ? renderStep5() : renderStep4(); break;
    case 5: content = renderStep5(); break;
  }

  const progress = Math.round((currentStep / totalSteps) * 100);

  overlayEl.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-progress">
        <div class="onboarding-progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="onboarding-step-indicator">${currentStep} / ${totalSteps}</div>
      ${content}
    </div>
  `;

  bindStepEvents();
}

// ── Step 1: Who are you? ────────────────────────────────────────────────────

function renderStep1() {
  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Benvenuto! 👋</h2>
      <p class="onboarding-subtitle">Personalizziamo l'app per te in pochi secondi.</p>
      <div class="onboarding-choices">
        <button type="button" class="onboarding-choice" data-user-type="resident_bg">
          <span class="onboarding-choice-emoji">🏠</span>
          <span class="onboarding-choice-label">Vivo a Busto Garolfo</span>
          <span class="onboarding-choice-desc">Configurazione completa con zona e fermate</span>
        </button>
        <button type="button" class="onboarding-choice" data-user-type="visitor">
          <span class="onboarding-choice-emoji">🚌</span>
          <span class="onboarding-choice-label">Vengo spesso a/da Busto G.</span>
          <span class="onboarding-choice-desc">Scegli le linee che usi di più</span>
        </button>
        <button type="button" class="onboarding-choice onboarding-choice--subtle" data-user-type="skip">
          <span class="onboarding-choice-emoji">👀</span>
          <span class="onboarding-choice-label">Sto solo provando</span>
          <span class="onboarding-choice-desc">Usa i default, puoi personalizzare dopo</span>
        </button>
      </div>
    </div>
  `;
}

// ── Step 2: Home zone (residents only) ──────────────────────────────────────

function renderStep2() {
  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Da dove parti? 📍</h2>
      <p class="onboarding-subtitle">Scegli la zona più vicina a casa tua per calcolare i tempi a piedi.</p>
      <div class="onboarding-choices">
        ${HOME_ZONES.map(zone => `
          <button type="button" class="onboarding-choice ${wizardState.homeZone === zone.id ? "selected" : ""}" data-home-zone="${zone.id}">
            <span class="onboarding-choice-label">${zone.label}</span>
            <span class="onboarding-choice-desc">${zone.description}</span>
          </button>
        `).join("")}
      </div>
      <div class="onboarding-nav">
        <button type="button" class="onboarding-btn secondary" data-back>← Indietro</button>
        <button type="button" class="onboarding-btn primary" data-next ${!wizardState.homeZone ? "disabled" : ""}>Avanti →</button>
      </div>
    </div>
  `;
}

// ── Step 3: Destinations ────────────────────────────────────────────────────

function renderStep3() {
  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Dove vai di solito? 🎯</h2>
      <p class="onboarding-subtitle">Seleziona una o più destinazioni. Mostreremo solo le linee utili.</p>
      <div class="onboarding-choices onboarding-choices--multi">
        ${DESTINATIONS.map(dest => `
          <button type="button" class="onboarding-choice onboarding-choice--compact ${wizardState.destinations.includes(dest.id) ? "selected" : ""}" data-destination="${dest.id}">
            <span class="onboarding-choice-emoji">${dest.emoji}</span>
            <span class="onboarding-choice-label">${dest.label} <small style="opacity: 0.7; font-weight: 600; font-size: 0.72rem; margin-left: 4px;">${dest.lineLabel}</small></span>
          </button>
        `).join("")}
      </div>
      <div class="onboarding-nav">
        <button type="button" class="onboarding-btn secondary" data-back>← Indietro</button>
        <button type="button" class="onboarding-btn primary" data-next ${wizardState.destinations.length === 0 ? "disabled" : ""}>Avanti →</button>
      </div>
    </div>
  `;
}

// ── Step 4: Confirm stops + walk/drive editable ─────────────────────────────

function renderStep4() {
  // Derive active lines from destinations
  const lines = deriveActiveLines();
  const zone = HOME_ZONES.find(z => z.id === wizardState.homeZone);
  const zoneFavs = ZONE_FAVORITES[wizardState.homeZone] || {};
  const useCanegrate = wizardState.destinations.includes("canegrate_auto");

  // Ensure favoriteStops are populated
  if (Object.keys(wizardState.favoriteStops).length === 0 && wizardState.homeZone) {
    wizardState.favoriteStops = structuredClone(zoneFavs);
  }

  // Build stop options for each line from the ZONE_FAVORITES + known stops
  const ALL_OUTBOUND_STOPS = {
    Z649: ["BT775", "BT703", "BT949", "BT205", "BT999"],
    Z627: ["BT301", "BT703", "BT704", "BT999"],
    Z644: ["BT775", "BT703", "BT205", "BT701"],
    Z625: ["BT947", "BT703", "BT701", "BT702"],
    Z647: ["BT956", "BT703", "BT999"],
    Z642: ["BT956", "BT703", "BT776"]
  };
  const ALL_RETURN_STOPS = {
    Z649: ["BT956", "BT951", "BT776", "BT999"],
    Z627: ["BT947", "BT951", "BT999", "BT701"],
    Z644: ["BT956", "BT776", "BT999"],
    Z625: ["BT301", "BT703", "BT951", "BT701"],
    Z647: ["BT775", "BT703", "BT999"],
    Z642: ["BT775", "BT956", "BT400"]
  };

  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Personalizza ⚙️</h2>
      <p class="onboarding-subtitle">Modifica fermate e tempi di percorrenza. Puoi sempre cambiarli dopo nelle Impostazioni.</p>

      <div class="onboarding-field">
        <label class="onboarding-field-label">Minuti a piedi verso la fermata</label>
        <input type="number" class="onboarding-field-input" data-walk-minutes min="1" max="30" value="${wizardState.walkMinutes}">
        <small style="display: block; margin-top: 6px; color: var(--quiet); font-size: 0.72rem; line-height: 1.4;">
          Tempi medi da casa: Via Buonarroti ~3 min · Piscina ~4 min · Via Rossini ~5 min · Deposito ~5 min · Via Montebianco ~8 min
        </small>
      </div>

      ${useCanegrate ? `
        <div class="onboarding-field">
          <label class="onboarding-field-label">Minuti in auto fino a Canegrate FS</label>
          <input type="number" class="onboarding-field-input" data-drive-canegrate min="1" max="45" value="${wizardState.driveCanegrate}">
        </div>
      ` : ""}

      <div class="onboarding-stops-list">
        ${lines.map(lineId => {
          const outStop = wizardState.favoriteStops[lineId]?.outbound || zoneFavs[lineId]?.outbound || "";
          const retStop = wizardState.favoriteStops[lineId]?.return || zoneFavs[lineId]?.return || "";
          const outOptions = (ALL_OUTBOUND_STOPS[lineId] || [outStop]).filter(Boolean);
          const retOptions = (ALL_RETURN_STOPS[lineId] || [retStop]).filter(Boolean);
          return `
            <div class="onboarding-stop-row">
              <strong class="onboarding-stop-line">${lineId}</strong>
              <div class="onboarding-stop-pair">
                <span class="onboarding-stop-label">Andata:</span>
                <select class="onboarding-field-input" data-fav-stop="${lineId}:outbound" style="min-height: 36px;">
                  ${outOptions.map(code => `<option value="${code}" ${code === outStop ? "selected" : ""}>${getStopName(code)}</option>`).join("")}
                </select>
              </div>
              <div class="onboarding-stop-pair">
                <span class="onboarding-stop-label">Ritorno:</span>
                <select class="onboarding-field-input" data-fav-stop="${lineId}:return" style="min-height: 36px;">
                  ${retOptions.map(code => `<option value="${code}" ${code === retStop ? "selected" : ""}>${getStopName(code)}</option>`).join("")}
                </select>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="onboarding-nav">
        <button type="button" class="onboarding-btn secondary" data-back>← Indietro</button>
        <button type="button" class="onboarding-btn primary" data-next>Avanti →</button>
      </div>
    </div>
  `;
}

// ── Step 5: Notifications + Google sign-in suggestion + finish ───────────────

function renderStep5() {
  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Quasi fatto! 🎉</h2>
      <p class="onboarding-subtitle">Ultime due cose opzionali.</p>

      <div style="margin-bottom: 20px;">
        <p class="onboarding-field-label" style="margin-bottom: 8px;">🔔 Notifiche reminder</p>
        <div class="onboarding-choices">
          <button type="button" class="onboarding-choice onboarding-choice--compact ${wizardState.wantNotifications ? "selected" : ""}" data-notif="yes">
            <span class="onboarding-choice-emoji">✅</span>
            <span class="onboarding-choice-label">Sì, avvisami 5 e 10 min prima</span>
          </button>
          <button type="button" class="onboarding-choice onboarding-choice--compact ${!wizardState.wantNotifications ? "selected" : ""}" data-notif="no">
            <span class="onboarding-choice-emoji">⏭️</span>
            <span class="onboarding-choice-label">No grazie, le attivo dopo</span>
          </button>
        </div>
      </div>

      <div style="padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(var(--accent-rgb), 0.06);">
        <p style="margin: 0 0 6px; font-weight: 750; font-size: 0.88rem; color: var(--text);">☁️ Sincronizza tra dispositivi</p>
        <p style="margin: 0 0 12px; color: var(--muted); font-size: 0.8rem; line-height: 1.4;">Accedi con Google per salvare le preferenze nel cloud e ritrovarle su altri dispositivi. Puoi farlo anche dopo nelle Impostazioni.</p>
        <button type="button" class="onboarding-btn primary" data-google-login style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.84rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Accedi con Google
        </button>
      </div>

      <div class="onboarding-nav">
        <button type="button" class="onboarding-btn secondary" data-back>← Indietro</button>
        <button type="button" class="onboarding-btn primary" data-finish>Inizia! 🚀</button>
      </div>
    </div>
  `;
}

// ── Event Binding ───────────────────────────────────────────────────────────

function bindStepEvents() {
  if (!overlayEl) return;

  // Step 1: user type
  overlayEl.querySelectorAll("[data-user-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      wizardState.userType = btn.dataset.userType;
      if (wizardState.userType === "skip") {
        finishWizard(true);
      } else {
        wizardState.step = 2;
        renderStep();
      }
    });
  });

  // Step 2: home zone
  overlayEl.querySelectorAll("[data-home-zone]").forEach(btn => {
    btn.addEventListener("click", () => {
      wizardState.homeZone = btn.dataset.homeZone;
      const zone = HOME_ZONES.find(z => z.id === wizardState.homeZone);
      if (zone) {
        wizardState.walkMinutes = zone.walkMinutes;
        wizardState.homeStop = zone.stop;
      }
      // Pre-derive favorites for this zone
      const zoneFavs = ZONE_FAVORITES[wizardState.homeZone] || {};
      wizardState.favoriteStops = structuredClone(zoneFavs);
      renderStep();
    });
  });

  // Step 3: destinations (multi-select)
  overlayEl.querySelectorAll("[data-destination]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.destination;
      const idx = wizardState.destinations.indexOf(id);
      if (idx === -1) {
        wizardState.destinations.push(id);
      } else {
        wizardState.destinations.splice(idx, 1);
      }
      wizardState.useCanegrate = wizardState.destinations.includes("canegrate_auto");
      wizardState.activeLines = deriveActiveLines();
      renderStep();
    });
  });

  // Step 4: walk minutes input
  const walkInput = overlayEl.querySelector("[data-walk-minutes]");
  if (walkInput) {
    walkInput.addEventListener("change", () => {
      wizardState.walkMinutes = Math.max(1, Math.min(30, Number(walkInput.value) || 6));
    });
  }

  // Step 4: drive canegrate input
  const driveInput = overlayEl.querySelector("[data-drive-canegrate]");
  if (driveInput) {
    driveInput.addEventListener("change", () => {
      wizardState.driveCanegrate = Math.max(1, Math.min(45, Number(driveInput.value) || 16));
    });
  }

  // Step 4: favorite stop selects
  overlayEl.querySelectorAll("[data-fav-stop]").forEach(select => {
    select.addEventListener("change", () => {
      const [lineId, direction] = select.dataset.favStop.split(":");
      if (!wizardState.favoriteStops[lineId]) wizardState.favoriteStops[lineId] = {};
      wizardState.favoriteStops[lineId][direction] = select.value;
    });
  });

  // Step 5: notifications
  overlayEl.querySelectorAll("[data-notif]").forEach(btn => {
    btn.addEventListener("click", () => {
      wizardState.wantNotifications = btn.dataset.notif === "yes";
      renderStep();
    });
  });

  // Step 5: Google sign-in (optional, non-blocking)
  overlayEl.querySelector("[data-google-login]")?.addEventListener("click", async () => {
    try {
      const { signInWithGoogle } = await import("./firebase-sync.js");
      const user = await signInWithGoogle();
      if (user) {
        const btn = overlayEl.querySelector("[data-google-login]");
        if (btn) {
          btn.textContent = `✓ Connesso come ${user.displayName || user.email}`;
          btn.disabled = true;
          btn.style.opacity = "0.7";
        }
      }
    } catch (e) {
      const btn = overlayEl.querySelector("[data-google-login]");
      if (btn) btn.textContent = "Errore – riprova nelle Impostazioni";
    }
  });

  // Navigation
  overlayEl.querySelector("[data-back]")?.addEventListener("click", () => {
    wizardState.step = Math.max(1, wizardState.step - 1);
    renderStep();
  });

  overlayEl.querySelector("[data-next]")?.addEventListener("click", () => {
    wizardState.step++;
    renderStep();
  });

  overlayEl.querySelector("[data-finish]")?.addEventListener("click", () => {
    finishWizard(false);
  });
}

// ── Finish & Produce Profile ────────────────────────────────────────────────

function finishWizard(skipped) {
  hideOverlay();

  if (skipped) {
    // Produce a minimal profile that marks onboarding as done but changes nothing
    const profile = {
      onboardingVersion: 1,
      completedAt: new Date().toISOString(),
      userType: "skip",
      skipped: true
    };
    if (onCompleteCallback) onCompleteCallback(profile);
    return;
  }

  const activeLines = deriveActiveLines();
  const zone = HOME_ZONES.find(z => z.id === wizardState.homeZone);

  // Build timetableStops: include the user's chosen favorite stops in the
  // visible columns for each line/direction/dayType combination.
  const timetableStops = {};
  for (const lineId of activeLines) {
    const favs = wizardState.favoriteStops[lineId];
    if (!favs) continue;
    timetableStops[lineId] = {};
    // For each day type, set the outbound/return columns to include the favorite
    for (const dayType of ["weekday", "saturday", "sunday"]) {
      if (favs.outbound) {
        const key = `${dayType}_outbound`;
        // We don't override — we just ensure the favorite is included.
        // The actual column list will be resolved by settings.js from config defaults
        // merged with this. We set it to null to signal "use default + ensure favorite".
      }
    }
  }

  const profile = {
    onboardingVersion: 1,
    completedAt: new Date().toISOString(),
    userType: wizardState.userType,
    homeZone: wizardState.homeZone || null,
    homeStop: zone?.stop || null,
    walkMinutes: wizardState.walkMinutes,
    destinations: [...wizardState.destinations],
    activeLines: activeLines,
    useCanegrate: wizardState.useCanegrate,
    driveCanegrate: wizardState.useCanegrate ? wizardState.driveCanegrate : null,
    favoriteStops: structuredClone(wizardState.favoriteStops),
    wantNotifications: wizardState.wantNotifications
  };

  if (onCompleteCallback) onCompleteCallback(profile);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveActiveLines() {
  const lines = new Set();
  for (const destId of wizardState.destinations) {
    const dest = DESTINATIONS.find(d => d.id === destId);
    if (dest) dest.lines.forEach(l => lines.add(l));
  }
  // If no lines derived (e.g. only canegrate_auto), show all
  if (lines.size === 0 && wizardState.destinations.length > 0 &&
      wizardState.destinations.every(d => d === "canegrate_auto")) {
    return []; // empty means "show all" in the consumer
  }
  return [...lines];
}
