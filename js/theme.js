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
  const sunSvg = `<svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><span style="display: none;">☀️</span>`;
  const moonSvg = `<svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg><span style="display: none;">🌙</span>`;

  toggle.innerHTML = theme === "dark" ? sunSvg : moonSvg;
  toggle.setAttribute("aria-label", theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro");
}

function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f8fafc" : "#101828");
  }
}
