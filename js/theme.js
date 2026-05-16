// =============================================================================
// theme.js – Dark/Light mode toggle
// =============================================================================
// Saves preference to localStorage. Falls back to system preference.
// =============================================================================

const STORAGE_KEY = "trasporti_theme";

export function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  updateIcon(toggle);

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    updateIcon(toggle);
    updateThemeColor(next);
  });

  // Listen for system preference changes (if no manual override)
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    if (localStorage.getItem(STORAGE_KEY)) return; // Manual override takes precedence
    const theme = e.matches ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    updateIcon(toggle);
    updateThemeColor(theme);
  });
}

function updateIcon(toggle) {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  toggle.textContent = theme === "dark" ? "☀️" : "🌙";
  toggle.setAttribute("aria-label", theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro");
}

function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f8fafc" : "#101828");
  }
}
