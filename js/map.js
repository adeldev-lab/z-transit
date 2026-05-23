import { STOP_COORDINATES, LINE_COLORS } from './map-data.js';
import { getLineData, getLineConfig, getState, getActiveConfig } from './main.js';
import { getStopName, RETURN_DESTINATIONS } from './line-config.js';
import { CFG } from '../data/config.js';
import { TRAIN_STATIONS } from '../data/trains.js';

let map = null;
let markers = {};


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
  // Trova tutte le linee e i versi che servono ogni fermata in STOP_COORDINATES
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
    // Prima di creare la mappa e i marker, assicuriamoci che tutte le linee siano caricate
    // in modo che tutte le fermate mostrino correttamente le linee che le servono
    try {
      const { ensureAllLinesLoaded } = await import('./main.js');
      await ensureAllLinesLoaded();
    } catch (e) {
      console.warn("[Mappa] Impossibile caricare tutte le linee:", e);
    }

    // Inizializza la mappa
    // Centro sulla città di focus attiva
    const activeCFG = getActiveConfig(getState(), CFG);
    const centerCoords = activeCFG?.activeCityConfig?.center || [45.5476, 8.8837];
    map = L.map('map-container', {
      zoomControl: false // Spostiamo lo zoom in basso a sinistra
    }).setView(centerCoords, 14);
    
    L.control.zoom({
      position: 'bottomleft'
    }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Crea i marker
    const stopLines = computeStopLines();
    
    for (const [code, coords] of Object.entries(STOP_COORDINATES)) {
      const lineIds = Object.keys(stopLines[code] || {});
      const primaryLine = lineIds[0] || "Z649";
      const color = LINE_COLORS[primaryLine] || "#22d3ee"; // Cyan fallback
      
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="width: 100%; height: 100%; border-radius: 50%; background-color: ${color};"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });
      
      const name = getStopName(code);
      const lineTagsHtml = lineIds.map(l => {
        const dirs = Array.from(stopLines[code][l]).join(' / ');
        return `<span class="line-tag" style="background: ${LINE_COLORS[l] || '#eee'};">${l} (${dirs})</span>`;
      }).join('');
      
      const marker = L.marker(coords, { icon: customIcon }).addTo(map);
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

    // Aggiungi marker per le stazioni dei treni (Stazioni FS)
    for (const [code, station] of Object.entries(TRAIN_STATIONS)) {
      const coords = [station.lat, station.lon];
      const trainIcon = L.divIcon({
        className: 'custom-map-marker-train',
        html: `<div style="width: 100%; height: 100%; border-radius: 4px; background-color: #E40314; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px;" title="${station.name} FS">🚆</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11]
      });
      
      const marker = L.marker(coords, { icon: trainIcon }).addTo(map);
      marker.bindPopup(`
        <strong>${station.name} FS</strong>
        <small>${code}</small>
        <div style="margin-top: 4px; margin-bottom: 8px; font-size: 0.72rem; color: var(--muted); font-weight: 500;">Stazione Ferroviaria (Trenord)</div>
        <a class="directions-btn" href="https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}" target="_blank" rel="noopener">
          🧭 Direzioni
        </a>
      `);
      
      markers[code] = marker;
    }

    // Aggiungi legenda
    const legend = L.control({position: 'bottomleft'}); // Moved to bottomleft to avoid cutoff
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      let labels = ['<strong style="display:block;margin-bottom:6px;font-size:0.85rem">Linee</strong>'];
      for (const [line, color] of Object.entries(LINE_COLORS)) {
        labels.push(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.75rem;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${color};"></span>
          ${line}
        </div>`);
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
  
  // Ricalcola dimensione mappa a causa dell'animazione CSS
  setTimeout(() => {
    map.invalidateSize();
    
    if (targetStopCode && markers[targetStopCode]) {
      const marker = markers[targetStopCode];
      map.setView(marker.getLatLng(), 17, { animate: true });
      marker.openPopup();
    } else if (targetStopCode) {
      alert(`La fermata ${targetStopCode} non è ancora tracciata sulla mappa.`);
    }
  }, 350); // Attendere fine transizione CSS
}

export function closeMap() {
  const mapOverlay = document.getElementById('map-overlay');
  if (mapOverlay) {
    mapOverlay.classList.remove('open');
    mapOverlay.setAttribute('aria-hidden', 'true');
  }
}
