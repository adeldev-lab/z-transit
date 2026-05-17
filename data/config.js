// =============================================================================
// config.js – Bus Dashboard: Busto Garolfo
// =============================================================================
//
// MAPPA FERMATE BUSTO GAROLFO (Via Busto Arsizio come asse):
//
// ← Arconate (comune) →
// |
// [BT956: Via Montebianco 17] ← Z649 ritorno, Z642 ritorno, Z647 andata
// [BT703: Via Buonarroti 3]   ← ★ FERMATA PRINCIPALE ANDATA – Z625/Z627/Z642/Z644/Z649-nord
// [BT947: Via Buonarroti 3]   ← Stessa posizione, codice ritorno (Z625/Z627 ritorno)
// [BT951: Via Busto A. 90]    ← Piscina, lato ritorno (~4 min)
// [BT949: Via Busto A. 91]    ← Piscina, lato andata (~4 min)
// [BT999: Via Busto A. 131]   ← Deposito (capolinea)
// [BT205: Via Busto A. fr.48] ← Z649 andata (variante sud, ~6 min)
// [BT775: Via Rossini 35]     ← Z649 andata (variante sud, ~10 min)
// [BT211: Via Parabiago 32]   ← Z649 ultima fermata BG
// ↓
// Casorezzo → Ossona → Arluno → Pregnana FS [PG101] → Cornaredo → Molino Dorino M1 [MD001]
//
// DISTANZE DALLA FERMATA PRINCIPALE:
// BT703 / BT947 (Via Buonarroti 3)  ≈ 2 min ← Fermata principale andata/ritorno
// BT951 (Piscina 90)                ≈ 4 min ← Fermata principale ritorno Z649
// BT949 (Piscina 91)                ≈ 4 min
// BT999 (Deposito)                  ≈ 5 min
// BT956 (Montebianco 17)            ≈ 8 min ← Z649/Z642 ritorno, Z647 andata
// BT205 (V.B.A. fr.48)              ≈ 6 min ← Solo variante sud Z649
// BT775 (Via Rossini 35)            ≈ 10 min ← Solo variante sud Z649
//
// NOTE VARIANTI Z649:
// - Variante SUD (mattina, più corse): Deposito→BT949→BT205→BT775→BT211→Casorezzo
// - Variante NORD (var. Arconate/Mantegazza): Deposito→BT949→BT703→BT400→BT211→Arconate→Casorezzo
// - Ritorno: SEMPRE da Casorezzo→BT215→BT776→BT956→BT951→BT999
// Verifica su Movibus / Moovit quali corse fermano a BT703.
//
// CODICI CONFERMATI DA FONTI PRIMARIE (timetable Movibus):
// BT999 BT949 BT951 BT205 BT775 BT776 BT956 BT215 BT211 BT703 PG101 MD001 MD111 LG090 PB090 BS090
// CODICI INFERITI DALLA POSIZIONE NEL PERCORSO (da verificare in app):
// BT400 BT704 BT701 BT702 BT947
// =============================================================================

export const CFG = {
  version: "4.3.0",
  lastUpdate: "2026-05-17",
  feedValidity: { from: "2026-03-02", to: "2026-06-07" },

  // --------------------------------------------------------------------------
  // Festivi nazionali 2026
  // --------------------------------------------------------------------------
  holidays: [
    "2026-01-01", "2026-01-06", "2026-04-06", "2026-04-25", "2026-05-01",
    "2026-06-02", "2026-08-15", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26"
  ],

  // --------------------------------------------------------------------------
  // Sospensione globale del servizio (agosto)
  // --------------------------------------------------------------------------
  globalInactivity: {
    from: "2026-08-10",
    to: "2026-08-24",
    note: "Sospensione estiva agosto"
  },

  // --------------------------------------------------------------------------
  // Sospensioni per linea
  // Z649: sospeso luglio-agosto (servizio estivo ridotto)
  // Z647: sospeso durante le vacanze scolastiche (servizio scolastico)
  // --------------------------------------------------------------------------
  serviceDisruptions: {
    Z649: [{ from: "2026-07-01", to: "2026-08-31", note: "Sospensione estiva" }],
    Z627: [],
    Z644: [],
    Z625: [],
    Z647: [{ from: "2026-06-15", to: "2026-09-10", note: "Sospensione scolastica" }],
    Z642: []
  },

  // --------------------------------------------------------------------------
  // Profilo casa – Busto Garolfo
  // Nessuna geolocalizzazione: fermate ordinate per praticità a piedi.
  // Fermata principale andata: BT703 (Via Buonarroti Civ. 3) – ~2 min
  // Fermata principale ritorno: BT947 / BT951 (Piscina 90) – ~2-4 min
  // --------------------------------------------------------------------------
  homeProfile: {
    label: "Casa",
    address: "Busto Garolfo",
    //note: "Fermata principale andata: BT703 (~2 min). Ritorno: BT947 (~2 min) o BT951 (~4 min). Z649 ritorno: BT956 (~8 min)."
  },

  // Ordine di visualizzazione delle linee nella UI
  // Z649 prima perché è la linea principale per Milano
  lineOrder: ["Z649", "Z644", "Z627", "Z625", "Z642", "Z647"],

  // --------------------------------------------------------------------------
  // Fermate preferite (una per linea per andata/ritorno)
  // Logica: prendi il bus dove cammini meno
  //
  // Z649 ANDATA: BT775 (variante sud, corse più frequenti al mattino)
  // Z649 RITORNO: BT956 (Via Montebianco 17) – prima fermata BG di rientro
  //
  // Z627 ANDATA: BT301 (Via Buonarroti ang. V. Busto A.) – fermata andata Z627
  // Z627 RITORNO: BT947 (Via Buonarroti civ 3) – fermata di casa in ritorno
  //
  // Z644 ANDATA: BT775 – fermata prima del bivio verso Parabiago
  // Z644 RITORNO: BT956 – prima fermata BG in ritorno da Parabiago
  //
  // Z625 ANDATA: BT947 – lato andata per Busto Arsizio FS
  // Z625 RITORNO: BT301 – lato ritorno da Busto Arsizio
  //
  // Z647 ANDATA: BT956 (Via Montebianco) – Z647 esce verso Arconate da qui
  // Z647 RITORNO: BT775 – lato ritorno verso Busto Garolfo
  //
  // Z642 ANDATA: BT956 – Z642 parte in direzione Legnano da Montebianco
  // Z642 RITORNO: BT775 – lato ritorno da Legnano verso Busto Garolfo
  // --------------------------------------------------------------------------
  favoriteStops: {
    Z649: { outbound: "BT775", return: "BT956" },
    Z627: { outbound: "BT301", return: "BT947" },
    Z644: { outbound: "BT775", return: "BT956" },
    Z625: { outbound: "BT947", return: "BT301" },
    Z647: { outbound: "BT956", return: "BT775" },
    Z642: { outbound: "BT956", return: "BT775" }
  },

  // --------------------------------------------------------------------------
  // Profili per linea
  //
  // outboundHomeStops = fermate da cui parto la mattina (ordinate per comodità)
  // returnHomeStops   = fermate dove scendo tornando a casa
  // compactStops      = fermate chiave mostrate nella vista compatta
  // detailStops       = fermate mostrate nella vista dettaglio
  // timetableStops    = colonne visibili nella griglia orari
  // returnInterchanges = fermate di interscambio sul percorso di ritorno
  // --------------------------------------------------------------------------
  stopProfiles: {

    // ========================================================================
    // Z649 – Busto Garolfo → Arluno → Pregnana M. → Cornaredo → Milano (Molino Dorino M1)
    //
    // PERCORSO ANDATA (principali tappe):
    // BT775(Rossini 35)/BT703(Buonarroti 3) → BT949(Piscina 91) → BT999(Deposito) →
    // [Casorezzo] → [Ossona] → AL195(Arluno Municipio) → PG101(Pregnana FS) →
    // [Cornaredo] → MD001(Molino Dorino M1)
    //
    // PERCORSO RITORNO (principali tappe):
    // MD001 → [Cornaredo] → PG101(Pregnana FS) → AL195(Arluno) →
    // [Casorezzo] → BT215(Parabiago 61) → BT776(Bellini 44) →
    // BT956(Montebianco 17) → BT951(Piscina 90) → BT999(Deposito)
    //
    // NOTE IMPORTANTI:
    // - Il Z649 ha due varianti nel tratto BG: via Busto Arsizio sud (BT205/BT775)
    //   oppure via nord (BT703). Verifica sull'app quali corse fermano a BT703.
    // - Sospeso luglio-agosto (vedi serviceDisruptions).
    // - Corse: feriale, sabato e domenica.
    // ========================================================================
    Z649: {
      // Andata: BT775 è la variante sud (più corse al mattino).
      // BT703 per le corse variante nord (Arconate/Mantegazza).
      // BT949 (Piscina) è alternativa per tutte le varianti (~4 min).
      outboundHomeStops: ["BT775", "BT703", "BT949", "BT205", "BT999"],

      // Ritorno: il Z649 rientra sempre via BT956(Montebianco) → BT951(Piscina) → BT999(Deposito).
      // BT956 è la prima fermata BG di rientro.
      // BT951 è alternativa più vicina ma con meno corse.
      returnHomeStops: ["BT956", "BT951", "BT776", "BT999"],

      // Vista compatta: destinazioni chiave Pregnana FS (S5/S6) e Molino Dorino M1
      compactStops: { outbound: ["PG102", "MD111"], return: ["BT956", "BT999"] },

      // Vista dettaglio: mostra anche Arluno e l'interscambio ferroviario
      detailStops: {
        outbound: ["BT775", "PG102", "MD111"],
        return: ["MD001", "PG101", "BT956", "BT999"]
      },

      // Colonne visibili negli orari
      timetableStops: {
        weekday_outbound: ["BT775", "PG102", "MD111"],
        saturday_outbound: ["BT775", "PG102", "MD111"],
        sunday_outbound: ["BT775", "PG102", "MD111"],
        weekday_return: ["MD001", "PG101", "BT956", "BT999"],
        saturday_return: ["MD001", "PG101", "BT956", "BT999"],
        sunday_return: ["MD001", "PG101", "BT956", "BT999"]
      },

      returnInterchanges: ["MD001", "VH238", "PG101"],

      returnConnectionOrigins: [
        {
          label: "Repubblica",
          via: "S5/S6",
          interchangeStop: "PG101",
          minutesToInterchange: 25
        },
        {
          label: "Molino Dorino M1",
          via: "M1",
          interchangeStop: "MD001",
          minutesToInterchange: 0
        }
      ]
    },

    // ========================================================================
    // Z644 – Arconate → Dairago → Villa Cortese / Busto G. → Parabiago FS
    //
    // PERCORSO (da Arconate a Parabiago):
    // Arconate → Dairago → [Villa Cortese] → BT703(Buonarroti 3) →
    // BT999(Deposito) → [centro BG] → PB090(Parabiago FS)
    //
    // UTILITÀ:
    // - Ottima per raggiungere Parabiago FS → S5 Trenord (Domodossola-Milano-Varese)
    // - Feriale + sabato, no domenica
    // - In ritorno scendi a BT956 (Montebianco) o BT776 (Via Bellini)
    // ========================================================================
    Z644: {
      // BT775 come da favoriteStops; BT703 alternativa più vicina
      outboundHomeStops: ["BT775", "BT703", "BT205", "BT701"],

      // Il Z644 in ritorno (Parabiago→Arconate) passa via BT956(Montebianco) e BT776(Bellini)
      returnHomeStops: ["BT956", "BT776", "BT999"],

      compactStops: { outbound: ["PB090"], return: ["BT956", "BT776"] },
      detailStops: { outbound: ["BT775", "PB090"], return: ["PB090", "BT956", "BT776"] },

      timetableStops: {
        weekday_outbound: ["BT775", "PB090", "PB100"],
        saturday_outbound: ["BT775", "PB090", "PB100"],
        weekday_return: ["PB090", "BT956", "BT776", "BT999"],
        saturday_return: ["PB090", "BT956", "BT776", "BT999"]
      },
      returnInterchanges: ["PB090", "PB101"]
    },

    // ========================================================================
    // Z627 – Castano Primo → Cuggiono → Arconate → Busto G. → Legnano FS
    //
    // PERCORSO (verso Legnano, andata):
    // BT301(Buonarroti ang. V. Busto A.) → BT703(?) → BT999(Deposito) →
    // [Dairago] → [Villa Cortese] → [S.Giorgio su L.] → LG090(Legnano FS) →
    // [oppure prosegue verso Castano Primo / Cuggiono]
    //
    // UTILITÀ:
    // - Legnano FS → S5 Trenord (per Milano P.ta Garibaldi, Varese, ecc.)
    // - Feriale + sabato, no domenica (alcune corse)
    // - In ritorno: BT947 (Via Buonarroti civ.3) – fermata di casa
    // ========================================================================
    Z627: {
      // BT301 come da favoriteStops (andata verso Legnano)
      outboundHomeStops: ["BT301", "BT703", "BT704", "BT999"],

      // Ritorno da Legnano: BT947 è la fermata di casa in ritorno
      returnHomeStops: ["BT947", "BT951", "BT999", "BT701"],

      compactStops: { outbound: ["LG090"], return: ["BT947"] },
      detailStops: {
        outbound: ["BT301", "LG090"],
        return: ["LG090", "BT947", "CT100"]
      },

      timetableStops: {
        weekday_outbound: ["BT301", "LG090"],
        saturday_outbound: ["BT301", "LG090"],
        weekday_return: ["LG090", "BT947", "CT100"],
        saturday_return: ["LG090", "BT947", "CT100"]
      },
      returnInterchanges: ["LG090", "LG091"]
    },

    // ========================================================================
    // Z625 – Villa Cortese / Busto Garolfo → Busto Arsizio FS
    //
    // PERCORSO (verso Busto Arsizio, andata):
    // BT947(Buonarroti civ 3) → BT951 → BS090(Busto Arsizio FS)
    //
    // UTILITÀ:
    // - Busto Arsizio FS → S5 Trenord + Regionale Espresso (RE)
    // - Feriale + sabato (da Villa Cortese)
    // - BT947 confermato come fermata andata Z625
    //
    // NOTA: BT701, BT702 sono codici da verificare in app.
    // ========================================================================
    Z625: {
      // BT947 come da favoriteStops (andata verso Busto Arsizio)
      outboundHomeStops: ["BT947", "BT703", "BT701", "BT702"],

      // Ritorno da Busto Arsizio: BT301 come da favoriteStops
      returnHomeStops: ["BT301", "BT703", "BT951", "BT701"],

      compactStops: { outbound: ["BS090"], return: ["BT301"] },
      detailStops: {
        outbound: ["BT947", "BS090"],
        return: ["BS090", "BT301", "BT704"]
      },

      timetableStops: {
        weekday_outbound: ["BT947", "BS090"],
        saturday_outbound: ["BT947", "BS090"],
        weekday_return: ["BS090", "BT301", "BT704"],
        saturday_return: ["BS090", "BT301", "BT704"]
      },
      returnInterchanges: ["BS090"]
    },

    // ========================================================================
    // Z642 – Magenta → Corbetta → Arluno → Busto G. → Legnano FS
    //
    // PERCORSO (verso Legnano, andata):
    // BT956(Montebianco 17) → [Arluno] → LG090(Legnano FS)
    // [oppure inverso in ritorno da Magenta]
    //
    // UTILITÀ:
    // - Connessione alternativa per Legnano FS (meno frequente di Z627)
    // - Utile anche per Arluno / Magenta (direzione opposta)
    // - In andata: BT956 è la fermata di uscita verso Legnano
    // - In ritorno da Legnano: BT775 (Via Rossini) come da favoriteStops
    // ========================================================================
    Z642: {
      // BT956 come da favoriteStops (andata verso Legnano)
      outboundHomeStops: ["BT956", "BT703", "BT776"],

      // Ritorno da Legnano: BT775 come da favoriteStops
      returnHomeStops: ["BT775", "BT956", "BT400"],

      compactStops: { outbound: ["LG090"], return: ["BT775"] },
      detailStops: {
        outbound: ["BT956", "LG090"],
        return: ["LG090", "BT775", "BT400"]
      },

      timetableStops: {
        weekday_outbound: ["BT956", "LG090"],
        weekday_return: ["LG090", "BT775", "BT400"]
      },
      returnInterchanges: ["LG090", "LG091"]
    },

    // ========================================================================
    // Z647 – Cornaredo → Arluno → Casorezzo → Busto G. → Arconate → Castano Primo
    //
    // PERCORSO (andata, verso Castano/Arconate):
    // BT956(Montebianco 17) → [Arconate] → CT100(Castano Primo)
    //
    // UTILITÀ:
    // - Servizio scolastico/limitato, sospeso giugno-settembre
    // - Utile per Castano Primo o Arconate
    //
    // NOTA: BT956 (Via Montebianco) è la fermata di uscita verso Arconate per Z647.
    // ========================================================================
    Z647: {
      // BT956 come da favoriteStops (andata verso Arconate/Castano)
      outboundHomeStops: ["BT956", "BT703", "BT999"],
      // Ritorno: BT775 come da favoriteStops
      returnHomeStops: ["BT775", "BT703", "BT999"],

      compactStops: { outbound: ["CT100"], return: ["BT775", "BT703"] },
      detailStops: {
        outbound: ["BT956", "CT100"],
        return: ["CT100", "BT775", "BT703"]
      },

      timetableStops: {
        weekday_outbound: ["BT956", "CT100"],
        weekday_return: ["CT100", "BT775", "BT703"]
      },
      returnInterchanges: ["CT100", "CT001"]
    }

  }, // fine stopProfiles

  // --------------------------------------------------------------------------
  // Valori di default per i settings utente
  //
  // walkRossini  = minuti a piedi dalla fermata principale
  //                BT703 (Via Buonarroti 3): ~2-3 min
  // driveCanegrate = minuti in auto fino a Canegrate FS (~3.3 km)
  // --------------------------------------------------------------------------
  defaults: {
    walkRossini: 6,
    driveCanegrate: 16,
    liveDirection: "outbound",
    connectionTightMin: 4,
    connectionGoodMin: 12,
    connectionLongMin: 25
  },

  // --------------------------------------------------------------------------
  // Nessun override visuale specifico (gestito dai profili sopra)
  // --------------------------------------------------------------------------
  displayStopsOverrides: {},

  // --------------------------------------------------------------------------
  // Destinazioni M1 (da Molino Dorino, capolinea Z649)
  // Tempi basati su orari ATM M1
  // --------------------------------------------------------------------------
  m1_destinations: [
    { id: "molino", name: "Molino Dorino", minutesFromMolino: 0 },
    { id: "pagano", name: "Pagano / Buonarroti", minutesFromMolino: 6 },
    { id: "cadorna", name: "Cadorna FNM", minutesFromMolino: 33 },
    { id: "duomo", name: "Duomo", minutesFromMolino: 35 },
    { id: "repubblica", name: "Repubblica", minutesFromMolino: 40 },
    { id: "centrale", name: "Centrale FS", minutesFromMolino: 38 }
  ],

  // --------------------------------------------------------------------------
  // Destinazioni S5/S6 (da Pregnana FS, interscambio Z649)
  // --------------------------------------------------------------------------
  s5s6_destinations: [
    { name: "Bovisa FNM", minutesFromPregnana: 10 },
    { name: "P.ta Garibaldi", minutesFromPregnana: 20 },
    { name: "Repubblica", minutesFromPregnana: 27 },
    { name: "Dateo", minutesFromPregnana: 29 }
  ],

  // --------------------------------------------------------------------------
  // Configurazione interscambi
  // PG101/PG102 = Pregnana Milanese FS (S5/S6 Trenord) – interscambio Z649
  // MD001/MD111 = Molino Dorino M1 – capolinea Z649
  // LG090       = Legnano FS (S5) – capolinea Z627, Z642
  // PB090       = Parabiago FS (S5) – capolinea Z644
  // BS090       = Busto Arsizio FS (S5/RE) – capolinea Z625
  // --------------------------------------------------------------------------
  interchanges: {
    MD001: { label: "Molino Dorino M1", type: "M1" },
    MD111: { label: "Molino Dorino M1", type: "M1" },
    PG101: { label: "Pregnana FS", type: "S5/S6", trainSlot: "PG102" },
    PG102: { label: "Pregnana FS", type: "S5/S6", trainSlot: "PG102" },
    LG090: { label: "Legnano FS", type: "S5", trainSlot: "LG090", trainSlotRE: "LG090_RE" },
    PB090: { label: "Parabiago FS", type: "S5", trainSlot: "PB090" },
    BS090: { label: "Busto Arsizio FS", type: "S5/RE", trainSlot: "BS090_S5", trainSlotRE: "BS090_RE" }
  },

  // --------------------------------------------------------------------------
  // M1 metro frequenza stimata (da Molino Dorino)
  // --------------------------------------------------------------------------
  m1Frequency: {
    peakMin: 4,
    offPeakMin: 7,
    peakHours: [[420, 570], [1020, 1170]], // 07:00-09:30, 17:00-19:30
    note: "M1 ogni ~4 min (punta) / ~7 min (fuori punta)"
  },

  // --------------------------------------------------------------------------
  // Link tempo reale stazioni (RFI iechub / rfi.it)
  // --------------------------------------------------------------------------
  stationLinks: {
    PG102: { label: "Pregnana FS", url: "https://iechub.rfi.it/ArriviPartenze/ArrivalsDepartures/Monitor?placeId=381&arrivals=False" },
    canegrate: { label: "Canegrate FS", url: "https://iechub.rfi.it/arrivipartenze/arrivalsdepartures/Monitor?placeId=858&arrivals=False" },
    LG090: { label: "Legnano FS", url: "https://www.rfi.it/it/stazioni/legnano.html" },
    PB090: { label: "Parabiago FS", url: "https://www.rfi.it/it/stazioni/parabiago.html" },
    BS090: { label: "Busto Arsizio FS", url: "https://www.rfi.it/it/stazioni/busto-arsizio.html" }
  },

  // --------------------------------------------------------------------------
  // Canegrate FS – alternativa treno (S5/R21)
  // --------------------------------------------------------------------------
  canegrate: {
    travelToMilano: 25,
    note: "Stima Canegrate → Cadorna via Trenord",
    stationUrl: "https://iechub.rfi.it/arrivipartenze/arrivalsdepartures/Monitor?placeId=858&arrivals=False"
  }

};