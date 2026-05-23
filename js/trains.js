import { TRAIN_ROUTES, TRAIN_STATIONS, TRAIN_DEPARTURES } from "../data/trains.js";

// === Train Connection Slots ===
// Orari verificati su Trenord (maggio 2026)
// Canegrate FS: treni ai minuti :08 e :38, ogni 30 min, identico tutti i giorni
// Legnano FS:   treni ai minuti :12 e :42, ogni 30 min
// Pregnana FS:  treni ai minuti :17 e :47, primo utile 05:47, ultimo 23:47

const TRAIN_SLOTS = {
  "PG102": {
    line: "S6",
    minutes: [15, 45],
    firstTrain: 315,   // 05:15
    lastTrain: 1425,    // 23:45
    note: "dir. Milano Passante"
  },
  "canegrate": {
    line: "S5",
    minutes: [21, 51],
    firstTrain: 351,    // 05:51
    lastTrain: 1401,    // 23:21
    note: "da Canegrate FS dir. Milano"
  },
  "LG090": {
    line: "S5",
    minutes: [12, 42],
    firstTrain: 312,    // 05:12
    lastTrain: 1362,    // 22:42
    note: "dir. Milano Passante"
  },
  "PB090": {
    line: "S5",
    minutes: [13, 43],
    firstTrain: 343,    // 05:43
    lastTrain: 1423,    // 23:43
    note: "dir. Milano Passante"
  },
  "BS090_S5": {
    line: "S5",
    minutes: [3, 33],
    firstTrain: 303,    // 05:03
    lastTrain: 1383,    // 23:03
    note: "dir. Milano Passante"
  },
  "BS090_RE": {
    line: "RE",
    minutes: [20, 50],
    firstTrain: 380,    // 06:20
    lastTrain: 1370,    // 22:50
    note: "dir. Milano"
  },
  "LG090_RE": {
    fixedTrains: [
      { departureMin: 362, line: "RE", note: "2511 dir. Milano P. Garibaldi" },
      { departureMin: 432, line: "RE", note: "2513 dir. Milano P. Garibaldi" },
      { departureMin: 447, line: "RE", note: "Luino → Milano P. Garibaldi" },
      { departureMin: 473, line: "RE", note: "Domodossola → Milano P. Garibaldi" },
      { departureMin: 482, line: "RE", note: "2515 dir. Milano P. Garibaldi" },
      { departureMin: 515, line: "RE", note: "Varese → Milano P. Garibaldi" },
      { departureMin: 542, line: "RE", note: "2517 dir. Milano P. Garibaldi" },
      { departureMin: 602, line: "RE", note: "2519 dir. Milano P. Garibaldi" },
      { departureMin: 662, line: "RE", note: "2521 dir. Milano P. Garibaldi" },
      { departureMin: 722, line: "RE", note: "2523 dir. Milano P. Garibaldi" },
      { departureMin: 782, line: "RE", note: "2525 dir. Milano P. Garibaldi" },
      { departureMin: 842, line: "RE", note: "2527 dir. Milano P. Garibaldi" },
      { departureMin: 902, line: "RE", note: "2529 dir. Milano P. Garibaldi" },
      { departureMin: 962, line: "RE", note: "2531 dir. Milano P. Garibaldi" },
      { departureMin: 1022, line: "RE", note: "2533 dir. Milano P. Garibaldi" },
      { departureMin: 1082, line: "RE", note: "2535 dir. Milano P. Garibaldi" },
      { departureMin: 1142, line: "RE", note: "2537 dir. Milano P. Garibaldi" },
      { departureMin: 1172, line: "RE", note: "Varese → Milano P. Garibaldi" },
      { departureMin: 1202, line: "RE", note: "2539 dir. Milano P. Garibaldi" },
      { departureMin: 1262, line: "RE", note: "2541 dir. Milano P. Garibaldi" },
      { departureMin: 1322, line: "RE", note: "2543 dir. Milano P. Garibaldi" },
      { departureMin: 1397, line: "RE", note: "Varese → Milano P. Garibaldi" }
    ]
  }
};

/**
 * Calculate next trains from a given stop and time, respecting operating hours.
 * @param {string} stopKey - key in TRAIN_SLOTS
 * @param {number} fromMinutes - minutes from midnight (bus arrival)
 * @param {number} count - how many trains to return (default 2)
 * @returns {Array<{line, departureMin, waitMin, note}>}
 */
export function calcNextTrain(stopKey, fromMinutes, count = 2) {
  const slot = TRAIN_SLOTS[stopKey];
  if (!slot) return [];

  const results = [];

  // 1. Pattern-based trains (recurring)
  if (slot.minutes) {
    const hour = Math.floor(fromMinutes / 60);
    for (let h = hour; h < 24; h++) {
      for (const m of slot.minutes) {
        const depMin = h * 60 + m;
        // Must be after bus arrival
        if (depMin <= fromMinutes) continue;
        // Must be within operating hours
        if (slot.firstTrain && depMin < slot.firstTrain) continue;
        if (slot.lastTrain && depMin > slot.lastTrain) continue;

        results.push({
          line: slot.line,
          departureMin: depMin,
          waitMin: depMin - fromMinutes,
          note: slot.note || ""
        });
      }
    }
  }

  // 2. Fixed specific trains
  if (slot.fixedTrains) {
    for (const f of slot.fixedTrains) {
      if (f.departureMin <= fromMinutes) continue;
      results.push({
        line: f.line || slot.line || "Treno",
        departureMin: f.departureMin,
        waitMin: f.departureMin - fromMinutes,
        note: f.note || slot.note || ""
      });
    }
  }

  // Sort all found trains by departure time
  results.sort((a, b) => a.departureMin - b.departureMin);

  return results.slice(0, count);
}

/**
 * Get connection info for a bus stop that has train connections configured.
 */
export function getConnectionInfo(stopKey, busArrivalMin, connectionConfig) {
  if (!connectionConfig) return null;
  const cfg = connectionConfig;
  const trains = calcNextTrain(cfg.slotKey || stopKey, busArrivalMin);
  if (trains.length === 0) return null;

  const best = trains[0];
  return {
    type: cfg.type,
    line: best.line,
    departure: best.departureMin,
    waitMin: best.waitMin,
    allTrains: trains
  };
}

/**
 * Build display string for train connection.
 */
export function formatConnection(conn) {
  if (!conn) return "";
  const dep = window.minsToHHMM ? window.minsToHHMM(conn.departure) : `${Math.floor(conn.departure / 60)}:${String(conn.departure % 60).padStart(2, '0')}`;
  if (conn.waitMin <= 0) return `${conn.type} ${dep}`;
  return `${conn.type} ${dep} (~${conn.waitMin}m)`;
}

/**
 * Canegrate block: next S5/S6 trains with drive time factored in.
 */
export function buildCanegrateBlock(driveMinutes, currentMin) {
  const arrivalAtStation = currentMin + driveMinutes;

  // Trains still departing from the station in the future
  const allFutureTrains = calcNextTrain("canegrate", currentMin);

  // Trains you can still realistically catch by driving there
  const catchableTrains = calcNextTrain("canegrate", arrivalAtStation);

  let justMissedCarTrain = null;
  if (allFutureTrains.length > 0 && catchableTrains.length > 0 && allFutureTrains[0].departureMin !== catchableTrains[0].departureMin) {
    justMissedCarTrain = allFutureTrains[0];
  } else if (allFutureTrains.length > 0 && catchableTrains.length === 0) {
    justMissedCarTrain = allFutureTrains[0];
  }

  if (catchableTrains.length === 0) {
    return { canLeaveIn: null, trains: [], justMissedCarTrain };
  }

  const firstTrain = catchableTrains[0];
  const leaveIn = firstTrain.departureMin - driveMinutes - currentMin;

  return {
    driveMinutes,
    canLeaveIn: leaveIn > 0 ? leaveIn : 0,
    arrivalAtStation,
    trains: catchableTrains,
    justMissedCarTrain,
    // Estimate arrival at Milano Centrale
    milanoArrival: firstTrain.departureMin + 25
  };
}

/**
 * Calculate next trains using GTFS data from a given station, direction, and dayType.
 * @param {string} stationCode - Code of the station (e.g. "CN_FS")
 * @param {string} direction - "to_milano" or "from_milano"
 * @param {string} dayType - "weekday", "saturday", "sunday"
 * @param {number} fromMinutes - minutes from midnight
 * @param {number} count - number of trains to return
 * @returns {Array<{line, color, departureMin, waitMin, note}>}
 */
export function calcNextTrainFromGTFS(stationCode, direction, dayType, fromMinutes, count = 2) {
  const stationData = TRAIN_DEPARTURES[stationCode];
  if (!stationData) return [];

  const results = [];
  const key = `${dayType}_${direction}`;

  for (const [routeId, schedules] of Object.entries(stationData)) {
    const times = schedules[key] || [];
    const routeInfo = TRAIN_ROUTES[routeId] || { name: routeId, color: "#666" };
    for (const min of times) {
      if (min > fromMinutes) {
        results.push({
          line: routeInfo.name,
          color: routeInfo.color,
          departureMin: min,
          waitMin: min - fromMinutes,
          note: direction === "to_milano" ? "dir. Milano" : "da Milano"
        });
      }
    }
  }

  // Sort by departure time
  results.sort((a, b) => a.departureMin - b.departureMin);

  return results.slice(0, count);
}

/**
 * Approximate travel time to Milano from each station.
 */
export function getTravelTimeToMilano(stationCode) {
  const times = {
    "CN_FS": 28,
    "PB_FS": 24,
    "LG_FS": 32,
    "BS_FS": 35,
    "PG_FS": 19,
    "VZ_FS": 22,
    "RH_FS": 15,
    "BSN_FS": 32
  };
  return times[stationCode] || 25;
}

/**
 * Generalized train station block calculating wait times, reach times and catchable trains.
 */
export function buildTrainStationBlock(stationCode, reachMinutes, currentMin, dayType, direction = "to_milano") {
  const arrivalAtStation = currentMin + reachMinutes;

  const allFutureTrains = calcNextTrainFromGTFS(stationCode, direction, dayType, currentMin);
  const catchableTrains = calcNextTrainFromGTFS(stationCode, direction, dayType, arrivalAtStation);

  let justMissedCarTrain = null;
  if (allFutureTrains.length > 0 && catchableTrains.length > 0 && allFutureTrains[0].departureMin !== catchableTrains[0].departureMin) {
    justMissedCarTrain = allFutureTrains[0];
  } else if (allFutureTrains.length > 0 && catchableTrains.length === 0) {
    justMissedCarTrain = allFutureTrains[0];
  }

  if (catchableTrains.length === 0) {
    return { canLeaveIn: null, trains: [], justMissedCarTrain };
  }

  const firstTrain = catchableTrains[0];
  const leaveIn = firstTrain.departureMin - reachMinutes - currentMin;

  const travelTime = getTravelTimeToMilano(stationCode);

  return {
    reachMinutes,
    canLeaveIn: leaveIn > 0 ? leaveIn : 0,
    arrivalAtStation,
    trains: catchableTrains,
    justMissedCarTrain,
    milanoArrival: firstTrain.departureMin + travelTime
  };
}

export { TRAIN_SLOTS };
