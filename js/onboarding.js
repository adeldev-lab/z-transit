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
    lines: ["Z649"]
  },
  {
    id: "milano_s5_pregnana",
    label: "Milano via S5/S6 (Pregnana FS)",
    emoji: "🚄",
    lines: ["Z649"]
  },
  {
    id: "legnano",
    label: "Legnano FS",
    emoji: "🚄",
    lines: ["Z627", "Z642"]
  },
  {
    id: "parabiago",
    label: "Parabiago FS",
    emoji: "🚄",
    lines: ["Z644"]
  },
  {
    id: "busto_arsizio",
    label: "Busto Arsizio FS",
    emoji: "🚄",
    lines: ["Z625"]
  },
  {
    id: "castano",
    label: "Castano Primo / Arconate",
    emoji: "🏫",
    lines: ["Z647"]
  },
  {
    id: "canegrate_auto",
    label: "Canegrate FS in auto",
    emoji: "🚗",
    lines: []
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
            <span class="onboarding-choice-label">${dest.label}</span>
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

// ── Step 4: Confirm stops + Canegrate ───────────────────────────────────────

function renderStep4() {
  // Derive active lines from destinations
  const lines = deriveActiveLines();
  const zone = HOME_ZONES.find(z => z.id === wizardState.homeZone);
  const zoneFavs = ZONE_FAVORITES[wizardState.homeZone] || {};
  const useCanegrate = wizardState.destinations.includes("canegrate_auto");

  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Conferma fermate 🚏</h2>
      <p class="onboarding-subtitle">Abbiamo pre-selezionato le fermate migliori per la tua zona. Puoi cambiarle.</p>
      <div class="onboarding-stops-list">
        ${lines.map(lineId => {
          const favs = zoneFavs[lineId] || {};
          const outStop = wizardState.favoriteStops[lineId]?.outbound || favs.outbound || "";
          const retStop = wizardState.favoriteStops[lineId]?.return || favs.return || "";
          return `
            <div class="onboarding-stop-row">
              <strong class="onboarding-stop-line">${lineId}</strong>
              <div class="onboarding-stop-pair">
                <span class="onboarding-stop-label">Andata:</span>
                <span class="onboarding-stop-value">${getStopName(outStop)}</span>
              </div>
              <div class="onboarding-stop-pair">
                <span class="onboarding-stop-label">Ritorno:</span>
                <span class="onboarding-stop-value">${getStopName(retStop)}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ${useCanegrate ? `
        <div class="onboarding-field">
          <label class="onboarding-field-label">Minuti in auto fino a Canegrate FS</label>
          <input type="number" class="onboarding-field-input" data-drive-canegrate min="1" max="45" value="${wizardState.driveCanegrate}">
        </div>
      ` : ""}
      <div class="onboarding-nav">
        <button type="button" class="onboarding-btn secondary" data-back>← Indietro</button>
        <button type="button" class="onboarding-btn primary" data-next>Avanti →</button>
      </div>
    </div>
  `;
}

// ── Step 5: Notifications + finish ──────────────────────────────────────────

function renderStep5() {
  return `
    <div class="onboarding-content">
      <h2 class="onboarding-title">Notifiche 🔔</h2>
      <p class="onboarding-subtitle">Vuoi ricevere un avviso prima della partenza dei bus che segui?</p>
      <div class="onboarding-choices">
        <button type="button" class="onboarding-choice ${wizardState.wantNotifications ? "selected" : ""}" data-notif="yes">
          <span class="onboarding-choice-emoji">✅</span>
          <span class="onboarding-choice-label">Sì, attiva reminder</span>
          <span class="onboarding-choice-desc">5 e 10 min prima della partenza</span>
        </button>
        <button type="button" class="onboarding-choice ${!wizardState.wantNotifications ? "selected" : ""}" data-notif="no">
          <span class="onboarding-choice-emoji">⏭️</span>
          <span class="onboarding-choice-label">No grazie, le attivo dopo</span>
          <span class="onboarding-choice-desc">Puoi sempre attivarle nelle Impostazioni</span>
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

  // Step 4: drive canegrate input
  const driveInput = overlayEl.querySelector("[data-drive-canegrate]");
  if (driveInput) {
    driveInput.addEventListener("change", () => {
      wizardState.driveCanegrate = Math.max(1, Math.min(45, Number(driveInput.value) || 16));
    });
  }

  // Step 5: notifications
  overlayEl.querySelectorAll("[data-notif]").forEach(btn => {
    btn.addEventListener("click", () => {
      wizardState.wantNotifications = btn.dataset.notif === "yes";
      renderStep();
    });
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

  const profile = {
    onboardingVersion: 1,
    completedAt: new Date().toISOString(),
    userType: wizardState.userType,
    homeZone: wizardState.homeZone || null,
    homeStop: zone?.stop || null,
    walkMinutes: zone?.walkMinutes || 6,
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
