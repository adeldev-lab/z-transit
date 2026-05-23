// =============================================================================
// line-registry.js – Lazy-loading registry for all line timetable data
// =============================================================================
// Instead of importing all 24 data files at startup, this module provides
// on-demand loading. Only the lines needed for the active focus city are
// fetched, keeping initial load fast.
// =============================================================================

/**
 * Registry mapping lineId → dynamic import function.
 * Each entry returns a Promise that resolves to the line's DATA object.
 */
const LINE_REGISTRY = {
  Z601: () => import("../data/z601.js").then(m => m.Z601_DATA),
  Z602: () => import("../data/z602.js").then(m => m.Z602_DATA),
  Z603: () => import("../data/z603.js").then(m => m.Z603_DATA),
  Z606: () => import("../data/z606.js").then(m => m.Z606_DATA),
  Z611: () => import("../data/z611.js").then(m => m.Z611_DATA),
  Z612: () => import("../data/z612.js").then(m => m.Z612_DATA),
  Z616: () => import("../data/z616.js").then(m => m.Z616_DATA),
  Z617: () => import("../data/z617.js").then(m => m.Z617_DATA),
  Z618: () => import("../data/z618.js").then(m => m.Z618_DATA),
  Z619: () => import("../data/z619.js").then(m => m.Z619_DATA),
  Z620: () => import("../data/z620.js").then(m => m.Z620_DATA),
  Z621: () => import("../data/z621.js").then(m => m.Z621_DATA),
  Z622: () => import("../data/z622.js").then(m => m.Z622_DATA),
  Z625: () => import("../data/z625.js").then(m => m.Z625_DATA),
  Z627: () => import("../data/z627.js").then(m => m.Z627_DATA),
  Z636: () => import("../data/z636.js").then(m => m.Z636_DATA),
  Z641: () => import("../data/z641.js").then(m => m.Z641_DATA),
  Z642: () => import("../data/z642.js").then(m => m.Z642_DATA),
  Z643: () => import("../data/z643.js").then(m => m.Z643_DATA),
  Z644: () => import("../data/z644.js").then(m => m.Z644_DATA),
  Z646: () => import("../data/z646.js").then(m => m.Z646_DATA),
  Z647: () => import("../data/z647.js").then(m => m.Z647_DATA),
  Z649: () => import("../data/z649.js").then(m => m.Z649_DATA),
  Z6C3: () => import("../data/z6c3.js").then(m => m.Z6C3_DATA),
};

/** In-memory cache of already-loaded line data */
const _cache = {};

/** Currently loading promise (to avoid duplicate parallel loads) */
let _loadingPromise = null;

/**
 * Load timetable data for the specified lines.
 * Results are cached — subsequent calls for already-loaded lines return instantly.
 *
 * @param {string[]} lineIds - Array of line IDs to load (e.g. ["Z649", "Z644"])
 * @returns {Promise<object>} - Object mapping lineId → data (e.g. { Z649: {...}, Z644: {...} })
 */
export async function loadLines(lineIds) {
  const toLoad = lineIds.filter(id => !_cache[id] && LINE_REGISTRY[id]);

  if (toLoad.length > 0) {
    const promises = toLoad.map(async (id) => {
      try {
        _cache[id] = await LINE_REGISTRY[id]();
      } catch (e) {
        console.warn(`[LineRegistry] Failed to load ${id}:`, e);
        _cache[id] = null;
      }
    });
    await Promise.all(promises);
  }

  // Build result from cache
  const result = {};
  for (const id of lineIds) {
    if (_cache[id]) result[id] = _cache[id];
  }
  return result;
}

/**
 * Load all lines for a given focus city configuration.
 * @param {object} cfg - The full app config (CFG)
 * @param {string} focusCity - Focus city code (e.g. "BT", "LG")
 * @returns {Promise<object>} - Loaded line data
 */
export async function loadLinesForCity(cfg, focusCity) {
  const cityCfg = cfg.focusCities?.[focusCity] || cfg.focusCities?.["BT"];
  const lineOrder = cityCfg?.lineOrder || cfg.lineOrder;
  return loadLines(lineOrder);
}

/**
 * Load a single line on demand (e.g. when user searches for a line outside their city).
 * @param {string} lineId
 * @returns {Promise<object|null>}
 */
export async function loadSingleLine(lineId) {
  if (_cache[lineId]) return _cache[lineId];
  if (!LINE_REGISTRY[lineId]) return null;
  try {
    _cache[lineId] = await LINE_REGISTRY[lineId]();
    return _cache[lineId];
  } catch (e) {
    console.warn(`[LineRegistry] Failed to load ${lineId}:`, e);
    return null;
  }
}

/**
 * Get currently cached line data (synchronous).
 * Returns whatever has been loaded so far.
 * @returns {object}
 */
export function getCachedLineData() {
  const result = {};
  for (const [id, data] of Object.entries(_cache)) {
    if (data) result[id] = data;
  }
  return result;
}

/**
 * Check if a specific line is already loaded.
 * @param {string} lineId
 * @returns {boolean}
 */
export function isLineLoaded(lineId) {
  return !!_cache[lineId];
}

/**
 * Get all available line IDs in the registry.
 * @returns {string[]}
 */
export function getAllLineIds() {
  return Object.keys(LINE_REGISTRY);
}
