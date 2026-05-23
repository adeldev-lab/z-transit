export function minsToHHMM(mins) {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return "--:--";
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDayType(date, cfg = window._app_config?.CFG) {
  if (cfg?.holidays?.includes(toYMD(date))) return "sunday";
  if (date.getDay() === 0) return "sunday";
  if (date.getDay() === 6) return "saturday";
  return "weekday";
}

export function getDayTypeLabel(dayType) {
  return { weekday: "Feriale", saturday: "Sabato", sunday: "Festivo" }[dayType] || dayType;
}

export function getItalianDayName(date) {
  return ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"][date.getDay()];
}

export function formatWait(minutes) {
  if (minutes <= 0) return "ora";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function getUrgencyState(waitMin) {
  if (waitMin <= 0) return { label: "Partito", css: "missed" };
  if (waitMin <= 3) return { label: "Parti ora", css: "hurry" };
  if (waitMin <= 8) return { label: "Buona finestra", css: "good" };
  return { label: "Hai tempo", css: "calm" };
}

export function getUrgencyClass(waitMin) {
  return `urgency-${getUrgencyState(waitMin).css}`;
}

export function getReachabilityState(busWaitMin, walkMin = 0) {
  if (busWaitMin <= 0) return { label: "Bus gia partito", css: "missed" };
  const margin = busWaitMin - walkMin;
  if (margin < 0) return { label: "Troppo stretto a piedi", css: "hurry" };
  if (margin <= 3) return { label: "Parti subito", css: "hurry" };
  if (margin <= 8) return { label: "Buona finestra", css: "good" };
  return { label: "Hai tempo", css: "calm" };
}

export function getConnectionState(waitMin, cfg) {
  const tight = cfg?.defaults?.connectionTightMin ?? 4;
  const good = cfg?.defaults?.connectionGoodMin ?? 12;
  const long = cfg?.defaults?.connectionLongMin ?? 25;
  if (waitMin < tight) return { label: "stretta", css: "tight" };
  if (waitMin <= good) return { label: "buona", css: "good" };
  if (waitMin <= long) return { label: "comoda", css: "calm" };
  return { label: "lunga", css: "long" };
}

export function getScheduleKey(lineId, dayType, direction) {
  if (lineId === "Z647") return `weekday_${direction}`;
  if (lineId === "Z644") return `${dayType === "saturday" ? "saturday" : "weekday"}_${direction}`;
  return `${dayType}_${direction}`;
}

export function resolveScheduleKeys(lineId, dayType, lineConfig) {
  const config = lineConfig[lineId];
  if (!config) return [];
  if (config.type !== "bidirectional") return [dayType];
  return [getScheduleKey(lineId, dayType, "outbound"), getScheduleKey(lineId, dayType, "return")];
}

export function getScheduleForLine(lineData, scheduleKey) {
  return lineData?.[scheduleKey] || [];
}

export function firstTime(trip) {
  const times = Object.values(trip?.stops || {}).filter(v => v !== null && v !== undefined);
  return times.length ? Math.min(...times) : null;
}

export function lastTime(trip) {
  const times = Object.values(trip?.stops || {}).filter(v => v !== null && v !== undefined);
  return times.length ? Math.max(...times) : null;
}

export function chooseStopForTrip(trip, preferredStop, fallbackStops = []) {
  const stops = trip?.stops || {};
  const candidates = [preferredStop, ...fallbackStops].filter(Boolean);
  for (const code of candidates) {
    if (stops[code] !== undefined && stops[code] !== null) {
      return { stopCode: code, minutes: stops[code], usedFallback: code !== preferredStop };
    }
  }
  const dep = firstTime(trip);
  if (dep === null) return null;
  const code = Object.entries(stops).find(([, v]) => v === dep)?.[0] || null;
  return { stopCode: code, minutes: dep, usedFallback: true };
}

export function getActiveTrips(schedule, fromMinutes, limit = 3, preferredStop = null, fallbackStops = []) {
  const trips = [];
  for (const trip of schedule || []) {
    const chosen = chooseStopForTrip(trip, preferredStop, fallbackStops);
    if (chosen && chosen.minutes > fromMinutes) {
      trips.push({ ...trip, _depMin: chosen.minutes, _depStop: chosen.stopCode, _usedFallback: chosen.usedFallback });
    }
  }
  trips.sort((a, b) => a._depMin - b._depMin);
  return trips.slice(0, limit);
}

export function getRecentlyDeparted(schedule, fromMinutes, windowMin = 30, preferredStop = null, fallbackStops = []) {
  const trips = [];
  for (const trip of schedule || []) {
    const chosen = chooseStopForTrip(trip, preferredStop, fallbackStops);
    if (chosen && chosen.minutes <= fromMinutes && chosen.minutes > fromMinutes - windowMin) {
      trips.push({ ...trip, _depMin: chosen.minutes, _depStop: chosen.stopCode, _usedFallback: chosen.usedFallback });
    }
  }
  trips.sort((a, b) => b._depMin - a._depMin);
  return trips;
}

export function isLineDisrupted(lineId, date, cfg) {
  const today = toYMD(date);
  return Boolean(cfg?.serviceDisruptions?.[lineId]?.some(d => today >= d.from && today <= d.to));
}

export function isGlobalInactive(date, cfg) {
  if (!cfg?.globalInactivity) return false;
  const today = toYMD(date);
  return today >= cfg.globalInactivity.from && today <= cfg.globalInactivity.to;
}

export function hasServiceToday(lineId, dayType, lineConfig, lineData, date, cfg) {
  const config = lineConfig[lineId];
  if (!config || isLineDisrupted(lineId, date, cfg)) return false;
  if (dayType === "saturday" && config.noService?.saturday) return false;
  if (dayType === "sunday" && config.noService?.sunday) return false;
  return resolveScheduleKeys(lineId, dayType, lineConfig).some(key => (lineData[lineId]?.[key]?.length || 0) > 0);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Restituisce la lista delle linee bus visibili scelte dall'utente
 * nel modal "Personalizza LIVE e ORARI" per la città di focus attiva.
 * Se l'utente non ha personalizzato, ritorna le linee predefinite della città.
 * Questa funzione garantisce che i tab Fermate, Notifiche, LIVE e Orari
 * mostrino tutti la stessa lista di linee.
 * @param {object} state - Lo stato globale dell'app
 * @param {object} cfg - La configurazione dell'app (CFG)
 * @returns {string[]} Lista degli ID linea (es. ["Z649", "Z627", ...])
 */
export function getVisibleLines(state, cfg) {
  const focusCity = state?.settings?.focusCity || cfg?.defaults?.focusCity || "BT";
  const followedForCity = state?.settings?.followedLinesByCity?.[focusCity];
  if (Array.isArray(followedForCity) && followedForCity.length > 0) {
    return followedForCity;
  }
  // Fallback: linee predefinite della città
  return cfg?.focusCities?.[focusCity]?.lineOrder || cfg?.lineOrder || [];
}
