import { STOP_COORDINATES, LINE_COLORS } from './map-data.js';
import { getLineData, getLineConfig, getState, getActiveConfig } from './main.js';
import { getStopName, RETURN_DESTINATIONS } from './line-config.js';
import { getVisibleLines } from './utils.js';
import { CFG } from '../data/config.js';
import { TRAIN_STATIONS } from '../data/trains.js';

let map = null;
let markers = {};
let trainMarkers = {};
let stopLineIndex = null; // { stopCode: { lineId: Set<direction> } }
let activeLineFilter = null; // null = mostra tutto, Set = linee selezionate
let filterControl = null;

export function initMap() {
  const mapFab = document.getElementById('map-fab');
  const mapClose = document.getElementById('map-close');
  
  if (mapFab) {
    mapFab.addEventListener('click', () => openMap());
  }
  
  if (mapClose) {
    mapClose.addEventListener('click', () => closeMap());
  }
}

function computeStopLines() {
  const lineData = getLineData();
  const lineConfig = getLineConfig();
  const stopLines = {};
  
  for (const stopCode in STOP_COORDINATES) {
    stopLines[stopCode] = {};
  }
  
  for (const [lineId, lineInfo] of Object.entries(lineData)) {
    for (const scheduleKey in lineInfo) {
      const dest = lineConfig[lineId]?.destination || 'Esterna';
      const returnDest = RETURN_DESTINATIONS[lineId] || 'Busto G.';
      const direction = scheduleKey.includes('return') ? `Dir. ${returnDest}` : `Dir. ${dest}`;
      const trips = lineInfo[scheduleKey];
      for (const trip of trips) {
        for (const stopCode in trip.stops) {
          if (stopLines[stopCode]) {
            if (!stopLines[stopCode][lineId]) {
              stopLines[stopCode][lineId] = new Set();
            }
            stopLines[stopCode][lineId].add(direction);
          }
        }
      }
    }
  }
  return stopLines;
}

/**
 * Restituisce le linee che servono una fermata.
 */
function getLinesForStop(stopCode) {
  if (!stopLineIndex) return [];
  return Object.keys(stopLineIndex[stopCode] || {});
}

/**
 * Determina se un marker bus deve essere visibile in base al filtro attivo.
 */
function isStopVisible(stopCode) {
  if (!activeLineFilter) return true; // nessun filtro = tutto visibile
  const lines = getLinesForStop(stopCode);
  return lines.some(l => activeLineFilter.has(l));
}

/**
 * Determina se un marker treno deve essere visibile in base al filtro.
 */
function isTrainStationVisible(stationCode) {
  if (!activeLineFilter) return true;
  return activeLineFilter.has("__trains__");
}

/**
 * Applica il filtro corrente mostrando/nascondendo i marker.
 */
function applyFilter() {
  for (const [code, marker] of Object.entries(markers)) {
    if (isStopVisible(code)) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  }
  for (const [code, marker] of Object.entries(trainMarkers)) {
    if (isTrainStationVisible(code)) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  }
}

/**
 * Crea il pannello di filtro linee nella mappa.
 */
function createFilterControl() {
  const state = getState();
  const visibleBusLines = getVisibleLines(state, CFG);
  const visibleTrains = state?.settings?.visibleTrains || [];
  const allBusLines = Object.keys(LINE_COLORS).sort();

  // Default: linee visibili nell'app + treni
  activeLineFilter = new Set([...visibleBusLines, "__trains__"]);

  const control = L.control({ position: 'topright' });
  control.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-filter-panel');
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    div.innerHTML = buildFilterHTML(allBusLines, visibleBusLines);
    bindFilterEvents(div, allBusLines, visibleBusLines);
    return div;
  };
  return control;
}

function buildFilterHTML(allBusLines, visibleBusLines) {
  const trainChecked = activeLineFilter.has("__trains__") ? "checked" : "";

  const lineCheckboxes = allBusLines.map(id => {
    const checked = activeLineFilter.has(id) ? "checked" : "";
    const color = LINE_COLORS[id] || "#888";
    const isDefault = visibleBusLines.includes(id);
    return `<label class="map-filter-line ${isDefault ? "" : "map-filter-other"}" data-line-id="${id}">
      <input type="checkbox" value="${id}" ${checked}>
      <span class="map-filter-dot" style="background:${color};"></span>
      <span>${id}</span>
    </label>`;
  }).join("");

  return `
    <div class="map-filter-header">
      <button type="button" class="map-filter-toggle" aria-label="Filtro linee" title="Filtro linee">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
      </button>
    </div>
    <div class="map-filter-body" style="display:none;">
      <div class="map-filter-search">
        <input type="text" placeholder="Cerca linea..." class="map-filter-input">
      </div>
      <div class="map-filter-actions">
        <button type="button" class="map-filter-btn" data-action="all">Tutte</button>
        <button type="button" class="map-filter-btn" data-action="default">Solo preferite</button>
        <button type="button" class="map-filter-btn" data-action="none">Nessuna</button>
      </div>
      <div class="map-filter-list">
        <label class="map-filter-line map-filter-train">
          <input type="checkbox" value="__trains__" ${trainChecked}>
          <span class="map-filter-dot" style="background:#E40314;"></span>
          <span>🚆 Stazioni FS</span>
        </label>
        ${lineCheckboxes}
      </div>
    </div>
  `;
}

function bindFilterEvents(div, allBusLines, visibleBusLines) {
  const toggle = div.querySelector('.map-filter-toggle');
  const body = div.querySelector('.map-filter-body');
  const searchInput = div.querySelector('.map-filter-input');

  toggle.addEventListener('click', () => {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    div.classList.toggle('map-filter-open', !isOpen);
  });

  // Ricerca
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toUpperCase();
    div.querySelectorAll('.map-filter-line').forEach(label => {
      const lineId = label.dataset.lineId || "";
      const text = label.textContent.toUpperCase();
      if (!query || text.includes(query) || lineId.includes(query)) {
        label.style.display = '';
      } else {
        label.style.display = 'none';
      }
    });
  });

  // Checkbox change
  div.querySelectorAll('.map-filter-list input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        activeLineFilter.add(cb.value);
      } else {
        activeLineFilter.delete(cb.value);
      }
      applyFilter();
    });
  });

  // Azioni rapide
  div.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'all') {
        activeLineFilter = new Set([...allBusLines, "__trains__"]);
      } else if (action === 'default') {
        activeLineFilter = new Set([...visibleBusLines, "__trains__"]);
      } else if (action === 'none') {
        activeLineFilter = new Set();
      }
      // Aggiorna checkbox
      div.querySelectorAll('.map-filter-list input[type="checkbox"]').forEach(cb => {
        cb.checked = activeLineFilter.has(cb.value);
      });
      applyFilter();
    });
  });
}

export async function openMap(targetStopCode = null) {
  if (typeof L === 'undefined') {
    alert("Impossibile caricare la mappa. Controlla la connessione internet.");
    return;
  }

  const mapOverlay = document.getElementById('map-overlay');
  if (!mapOverlay) return;
  
  mapOverlay.classList.add('open');
  mapOverlay.setAttribute('aria-hidden', 'false');
  
  if (!map) {
    // Carica tutte le linee per avere dati completi
    try {
      const { ensureAllLinesLoaded } = await import('./main.js');
      await ensureAllLinesLoaded();
    } catch (e) {
      console.warn("[Mappa] Impossibile caricare tutte le linee:", e);
    }

    const activeCFG = getActiveConfig(getState(), CFG);
    const centerCoords = activeCFG?.activeCityConfig?.center || [45.5476, 8.8837];
    map = L.map('map-container', {
      zoomControl: false
    }).setView(centerCoords, 14);
    
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Calcola indice fermate → linee
    stopLineIndex = computeStopLines();
    
    // Crea marker bus (senza aggiungerli alla mappa — applyFilter li gestisce)
    for (const [code, coords] of Object.entries(STOP_COORDINATES)) {
      const lineIds = Object.keys(stopLineIndex[code] || {});
      const primaryLine = lineIds[0] || "Z649";
      const color = LINE_COLORS[primaryLine] || "#22d3ee";
      
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="width: 100%; height: 100%; border-radius: 50%; background-color: ${color};"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });
      
      const name = getStopName(code);
      const lineTagsHtml = lineIds.map(l => {
        const dirs = Array.from(stopLineIndex[code][l]).join(' / ');
        return `<span class="line-tag" style="background: ${LINE_COLORS[l] || '#eee'};">${l} (${dirs})</span>`;
      }).join('');
      
      const marker = L.marker(coords, { icon: customIcon });
      marker.bindPopup(`
        <strong>${name}</strong>
        <small>${code}</small>
        <div class="line-tags">${lineTagsHtml || '<span style="color:#a8b3c7">Nessuna linea trovata</span>'}</div>
        <a class="directions-btn" href="https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}" target="_blank" rel="noopener">
          🧭 Direzioni
        </a>
      `);
      
      markers[code] = marker;
    }

    // Crea marker treni
    for (const [code, station] of Object.entries(TRAIN_STATIONS)) {
      const coords = [station.lat, station.lon];
      const trainIcon = L.divIcon({
        className: 'custom-map-marker-train',
        html: `<div style="width: 100%; height: 100%; border-radius: 4px; background-color: #E40314; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px;" title="${station.name} FS">🚆</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11]
      });
      
      const marker = L.marker(coords, { icon: trainIcon });
      marker.bindPopup(`
        <strong>${station.name} FS</strong>
        <small>${code}</small>
        <div style="margin-top: 4px; margin-bottom: 8px; font-size: 0.72rem; color: var(--muted); font-weight: 500;">Stazione Ferroviaria (Trenord)</div>
        <a class="directions-btn" href="https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}" target="_blank" rel="noopener">
          🧭 Direzioni
        </a>
      `);
      
      trainMarkers[code] = marker;
    }

    // Aggiungi filtro
    filterControl = createFilterControl();
    filterControl.addTo(map);

    // Applica filtro iniziale (mostra solo linee preferite + treni)
    applyFilter();

    // Legenda
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      const state = getState();
      const visLines = getVisibleLines(state, CFG);
      let labels = ['<strong style="display:block;margin-bottom:6px;font-size:0.85rem">Linee</strong>'];
      for (const line of visLines) {
        const color = LINE_COLORS[line];
        if (color) {
          labels.push(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.75rem;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${color};"></span>
            ${line}
          </div>`);
        }
      }
      labels.push(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.75rem;margin-top:6px;border-top:1px solid #eee;padding-top:4px;">
        <span style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:3px;background-color:#E40314;color:white;font-size:8px;">🚆</span>
        Stazioni FS
      </div>`);
      div.innerHTML = labels.join('');
      return div;
    };
    legend.addTo(map);
  }
  
  // Ricalcola dimensione mappa
  setTimeout(() => {
    map.invalidateSize();
    
    if (targetStopCode && (markers[targetStopCode] || trainMarkers[targetStopCode])) {
      const marker = markers[targetStopCode] || trainMarkers[targetStopCode];
      // Assicurati che il marker sia visibile
      if (!map.hasLayer(marker)) marker.addTo(map);
      map.setView(marker.getLatLng(), 17, { animate: true });
      marker.openPopup();
    } else if (targetStopCode) {
      alert(`La fermata ${targetStopCode} non è ancora tracciata sulla mappa.`);
    }
  }, 350);
}

export function closeMap() {
  const mapOverlay = document.getElementById('map-overlay');
  if (mapOverlay) {
    mapOverlay.classList.remove('open');
    mapOverlay.setAttribute('aria-hidden', 'true');
  }
}
