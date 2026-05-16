// =============================================================================
// theme.js – Dark/Light mode toggle
// =============================================================================
// Default theme is the original dark theme. Light is opt-in via the toggle
// button only; the system `prefers-color-scheme` is intentionally not used so
// users on light-mode devices still see the dark UI by default.
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
