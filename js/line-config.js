export const LINE_CONFIG = {
  // ══════════════════════════════════════════════════════════════════════════
  // Linee originali (area Busto Garolfo)
  // ══════════════════════════════════════════════════════════════════════════
  Z649: {
    label: "Z649 - Molino Dorino M1",
    shortName: "Z649",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["BT775", "PG102", "MD111"],
    connections: {
      PG102: { type: "S5/S6", slotKey: "PG102" },
      PG101: { type: "S5/S6", slotKey: "PG102" },
      MD111: { type: "M1" },
      MD001: { type: "M1" }
    },
    showInLive: true,
    noService: { saturday: false, sunday: false },
    notes: "Linea principale per Pregnana FS e Molino Dorino. Alcune corse feriali sono brevi."
  },
  Z644: {
    label: "Z644 - Arconate <-> Parabiago FS",
    shortName: "Z644",
    destination: "Parabiago FS",
    type: "bidirectional",
    referenceStops: ["BT775", "PB090"],
    connections: { PB090: { type: "S5", slotKey: "PB090" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Linea utile per Parabiago FS. Nessun servizio festivo."
  },
  Z627: {
    label: "Z627 - Busto Garolfo / Cuggiono -> Legnano FS",
    shortName: "Z627",
    destination: "Legnano FS",
    type: "bidirectional",
    referenceStops: ["BT703", "LG090"],
    connections: { LG090: { type: "S5", slotKey: "LG090" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Linea per Legnano FS. Alcune corse scolastiche hanno percorso ridotto."
  },
  Z625: {
    label: "Z625 -> Busto Arsizio FS",
    shortName: "Z625",
    destination: "Busto Arsizio FS",
    type: "bidirectional",
    referenceStops: ["BT701", "BS090"],
    connections: {
      BS090: { type: "S5/RE", slotKey: "BS090_S5" },
      BS090_RE: { type: "RE", slotKey: "BS090_RE", stopCode: "BS090" }
    },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Linea verso Busto Arsizio FS. Alcune corse non raggiungono tutte le fermate."
  },
  Z642: {
    label: "Z642 - Busto G. / Villa Cortese -> Legnano FS",
    shortName: "Z642",
    destination: "Legnano FS",
    type: "bidirectional",
    referenceStops: ["BT776", "LG090"],
    connections: { LG090: { type: "S5", slotKey: "LG090" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Linea lunga con corse feriali e scolastiche."
  },
  Z647: {
    label: "Z647 - Busto Garolfo <-> Castano Primo",
    shortName: "Z647",
    destination: "Castano Primo",
    type: "bidirectional",
    referenceStops: ["BT956", "CT100"],
    connections: {},
    showInLive: true,
    noService: { saturday: true, sunday: true },
    notes: "Linea scolastica feriale."
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Linee rete estesa (Legnano, Rho, Magenta, Cuggiono, ecc.)
  // ══════════════════════════════════════════════════════════════════════════
  Z601: {
    label: "Z601 - Legnano → Rho → Molino Dorino M1",
    shortName: "Z601",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["LG003", "RH001", "MD111"],
    connections: { MD111: { type: "M1" }, MD001: { type: "M1" } },
    showInLive: true,
    noService: { saturday: false, sunday: false },
    notes: "Via Sempione. Servizio feriale, sabato e festivo."
  },
  Z602: {
    label: "Z602 - Legnano → Milano via A8",
    shortName: "Z602",
    destination: "Milano",
    type: "bidirectional",
    referenceStops: ["LG003", "ML002"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Linea veloce via autostrada A8."
  },
  Z603: {
    label: "Z603 - S.V. Olona/Nerviano → Milano via A8",
    shortName: "Z603",
    destination: "Milano",
    type: "bidirectional",
    referenceStops: ["SV001", "NR001", "ML002"],
    connections: {},
    showInLive: true,
    noService: { saturday: true, sunday: true },
    notes: "Solo feriale. Via autostrada."
  },
  Z606: {
    label: "Z606 - Cerro Maggiore → Rho → Milano",
    shortName: "Z606",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["CR001", "RH001", "MD111"],
    connections: { MD111: { type: "M1" }, MD001: { type: "M1" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Poche corse. Sabato limitato."
  },
  Z611: {
    label: "Z611 - Legnano → Canegrate → Parabiago",
    shortName: "Z611",
    destination: "Parabiago",
    type: "bidirectional",
    referenceStops: ["LG090", "CN001", "PB090"],
    connections: { LG090: { type: "S5" }, PB090: { type: "S5" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento locale Legnano-Canegrate-Parabiago."
  },
  Z612: {
    label: "Z612 - Legnano → Cerro M. → Lainate → Arese",
    shortName: "Z612",
    destination: "Arese Il Centro",
    type: "bidirectional",
    referenceStops: ["LG003", "CR001", "AR999"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento per Arese Il Centro commerciale."
  },
  Z616: {
    label: "Z616 - Rho FS → Pregnana M. FS",
    shortName: "Z616",
    destination: "Pregnana FS",
    type: "bidirectional",
    referenceStops: ["RH100", "PG100"],
    connections: { PG100: { type: "S5/S6" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Navetta Rho-Pregnana. Solo andata nel GTFS."
  },
  Z617: {
    label: "Z617 - Origgio/Lainate → Molino Dorino M1",
    shortName: "Z617",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["OR001", "LN010", "MD111"],
    connections: { MD111: { type: "M1" }, MD001: { type: "M1" } },
    showInLive: true,
    noService: { saturday: false, sunday: false },
    notes: "Da Origgio e Lainate verso Milano M1."
  },
  Z618: {
    label: "Z618 - Rogorotto → Vanzago → Pogliano → Rho",
    shortName: "Z618",
    destination: "Rho",
    type: "bidirectional",
    referenceStops: ["RG001", "VZ001", "RH001"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento locale verso Rho."
  },
  Z619: {
    label: "Z619 - Plesso Maggiolini e Cavalleri",
    shortName: "Z619",
    destination: "Scuole",
    type: "bidirectional",
    referenceStops: ["PB090", "LG003"],
    connections: {},
    showInLive: true,
    noService: { saturday: true, sunday: true },
    notes: "Linea scolastica."
  },
  Z620: {
    label: "Z620 - Magenta → Corbetta → Vittuone → Molino Dorino M1",
    shortName: "Z620",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["MG888", "CB021", "VT022", "MD111"],
    connections: { MD111: { type: "M1" }, MD001: { type: "M1" } },
    showInLive: true,
    noService: { saturday: false, sunday: false },
    notes: "Linea principale Magenta-Milano. Servizio completo."
  },
  Z621: {
    label: "Z621 - Cuggiono → Inveruno → Ossona → Molino Dorino M1",
    shortName: "Z621",
    destination: "Molino Dorino M1",
    type: "bidirectional",
    referenceStops: ["CG999", "IN127", "MD111"],
    connections: { MD111: { type: "M1" }, MD001: { type: "M1" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Da Cuggiono/Inveruno verso Milano M1."
  },
  Z622: {
    label: "Z622 - Cuggiono → Inveruno → Ossona → Vittuone",
    shortName: "Z622",
    destination: "Vittuone",
    type: "bidirectional",
    referenceStops: ["CG999", "IN127", "VT010"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento Cuggiono-Vittuone."
  },
  Z636: {
    label: "Z636 - Nosate → Castano P. → Vanzaghello → Legnano",
    shortName: "Z636",
    destination: "Legnano FS",
    type: "bidirectional",
    referenceStops: ["NS099", "CT100", "LG090"],
    connections: { LG090: { type: "S5" } },
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Da Nosate/Castano verso Legnano. Poche corse."
  },
  Z641: {
    label: "Z641 - Castano P. → Turbigo → Bernate → Magenta",
    shortName: "Z641",
    destination: "Magenta FS",
    type: "bidirectional",
    referenceStops: ["CT100", "TB050", "MG561"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento Castano-Magenta via Turbigo."
  },
  Z643: {
    label: "Z643 - Vittuone → Arluno → Ossona/Parabiago → Villa Cortese",
    shortName: "Z643",
    destination: "Villa Cortese",
    type: "bidirectional",
    referenceStops: ["VT010", "AL185", "VC005"],
    connections: {},
    showInLive: true,
    noService: { saturday: true, sunday: true },
    notes: "Solo feriale. Collegamento locale."
  },
  Z646: {
    label: "Z646 - Castano P. → Cuggiono → Marcallo → Magenta",
    shortName: "Z646",
    destination: "Magenta FS",
    type: "bidirectional",
    referenceStops: ["CT100", "CG999", "MG561"],
    connections: {},
    showInLive: true,
    noService: { saturday: false, sunday: true },
    notes: "Collegamento Castano-Magenta via Cuggiono."
  },
  Z6C3: {
    label: "Z6C3 - S.V. Olona → Cerro Maggiore → Milano A8",
    shortName: "Z6C3",
    destination: "Milano",
    type: "bidirectional",
    referenceStops: ["SV001", "CR001", "ML002"],
    connections: {},
    showInLive: true,
    noService: { saturday: true, sunday: true },
    notes: "Solo feriale. Diretto via autostrada A8."
  }
};

export const RETURN_DESTINATIONS = {
  Z649: "Busto Garolfo",
  Z644: "Arconate",
  Z627: "Cuggiono / Busto G.",
  Z625: "Villa Cortese / Busto G.",
  Z642: "Busto G. / Villa Cortese",
  Z647: "Busto Garolfo",
  Z601: "Legnano",
  Z602: "Legnano",
  Z603: "S.V. Olona / Nerviano",
  Z606: "Cerro Maggiore",
  Z611: "Legnano",
  Z612: "Legnano",
  Z616: "Rho FS",
  Z617: "Origgio / Lainate",
  Z618: "Rogorotto",
  Z619: "Legnano / Parabiago",
  Z620: "Magenta",
  Z621: "Cuggiono",
  Z622: "Cuggiono",
  Z636: "Nosate / Castano P.",
  Z641: "Castano Primo",
  Z643: "Vittuone",
  Z646: "Castano Primo",
  Z6C3: "S.V. Olona"
};

for (const [lineId, dest] of Object.entries(RETURN_DESTINATIONS)) {
  if (LINE_CONFIG[lineId]) {
    LINE_CONFIG[lineId].returnDestination = dest;
  }
}

export const STOP_NAMES = {
  // ── Arconate ──
  AC035: "Arconate, Concordia fr. 13",
  AC127: "Arconate, Beata Vergine/Dei Pioppi",
  AC128: "Arconate, Beata Vergine/Dei Tigli",
  AC625: "Arconate, Concordia 9",
  AC627: "Arconate, Legnano 28",
  AC628: "Arconate, Legnano 11",
  AC802: "Arconate, Varese 44",
  AC809: "Arconate, Varese/Moina",
  AC811: "Arconate, Volta/XXIV Maggio",

  // ── Arluno ──
  AL028: "Arluno, Mazzini/Don Sturzo",
  AL029: "Arluno, Mazzini 6",
  AL040: "Arluno, Giovanni XXIII 43",
  AL050: "Arluno, Turati fr. 58",
  AL051: "Arluno, Via Turati civico 58",
  AL185: "Arluno, Piazza De Gasperi",
  AL195: "Arluno, A. De Gasperi,Municipio",
  AL196: "Arluno, Marconi 118",
  AL201: "Arluno, Mazzini 7",
  AL501: "Arluno, Pozzo Bonelli fr. Chiesa",
  AL801: "Arluno, Via ADUA ang. GIovanni XXIII",
  AL802: "Arluno, Via ADUA ang. Giovanni XXIII",

  // ── AR ──
  AR999: "Arese, Luraghi/Alfa Romeo,Il Centro",

  // ── BA ──
  BA005: "Bareggio, Novara/Roma",
  BA008: "Bareggio, Novara/Monte Rosa",
  BA019: "Bareggio, Milano/Leoncavallo",
  BA029: "Bareggio, Milano 17",

  // ── Buscate ──
  BC211: "Buscate, Milano 26",
  BC250: "Buscate, Milano 19/P. Micca",
  BC801: "Buscate, SP34 28",
  BC802: "Buscate, SP34 fr. 28",

  // ── BE ──
  BE010: "Bernate Ticino, Italia,Casate",
  BE011: "Bernate Ticino, IV Novembre 1D,Casate",
  BE012: "Bernate T., Roma 55",
  BE013: "Bernate Ticino, Roma fr. 22",
  BE014: "Bernate Ticino, V. Veneto 12",
  BE503: "Bernate Ticino, Roma fr. 23",
  BE504: "Bernate T., Roma 48",
  BE505: "Bernate Ticino, IV Novembre 6,Casate",
  BE506: "Bernate Ticino, Milano 36,Casate",

  // ── BF ──
  BF285: "Boffalora Sopra Ticino, S. Defendente 2",
  BF295: "Boffalora Sopra Ticino, Roma 28",
  BF305: "Boffalora Sopra Ticino, Roma 20",
  BF306: "Boffalora Sopra Ticino, S. Defendente 9",

  // ── BI ──
  BI101: "Magnago, A. Diaz 25",
  BI102: "Magnago, A. Diaz 10",

  // ── BR ──
  BR001: "Pogliano Milanese, SS33,Barbaiana",
  BR011: "Lainate, Sempione 12,Barbaiana",
  BR023: "Lainate, della Pace 5",
  BR033: "Lainate,Roma fr. 60-64/S.Virginia fr. 39",
  BR042: "Lainate, S.Virginia fr. 33-39/Delle Rose",
  BR044: "Lainate, Della Pace 29/Gramsci",
  BR072: "Lainate, S.Virginia fr. 33/Delle Rose",
  BR073: "Lainate, Della Pace 18/Villoresi",
  BR074: "Lainate, Roma fr. 88-89/S.V. Sempione",
  BR083: "Lainate, Della Pace 27/Villoresi",
  BR084: "Lainate, Roma fr. 60-71/Meda",

  // ── Busto Arsizio ──
  BS001: "Busto Arsizio, XX Settembre/Marconi",
  BS003: "Busto Arsizio, Trento/Crespi 1,Centro",
  BS011: "Busto Arsizio, Trento 7,Centro",
  BS027: "Busto Arsizio, Cadorna/Piemonte",
  BS057: "Busto Arsizio, Castelfidardo 2",
  BS071: "Busto Arsizio, Stelvio,ITC E.Tosi",
  BS085: "Busto Arsizio, Zappellini",
  BS087: "Busto Arsizio, Boccaccio 88,Borsano",
  BS090: "Busto Arsizio, V. Liberta',Stazione FS",
  BS118: "Busto Arsizio, Toscana fr. 94,Borsano",
  BS212: "Busto Arsizio, Solaro 2/Italia,Ospedale",
  BS451: "Busto Arsizio, Boccaccio 89-101/Lodi",
  BS452: "Busto Arsizio, Ugo Foscolo fr. 8",
  BS455: "Busto Arsizio, Boccaccio 51/Ferrini",
  BS456: "Busto Arsizio, Boccaccio/Ferrini",
  BS555: "Busto Arsizio, Toscana 94,Borsano",

  // ── Busto Garolfo ──
  BT205: "Busto Garolfo, Busto A. fr. 48",
  BT211: "Busto Garolfo, Parabiago 32",
  BT215: "Busto Garolfo, Parabiago 61",
  BT300: "Busto G., Giacomo Matteotti 5",
  BT301: "Busto Garolfo, Buonarroti/Busto A.",
  BT400: "Busto G., Giacomo Matteotti 6",
  BT701: "Busto Garolfo, Curiel",
  BT702: "Busto Garolfo, Don Longoni/Cellini",
  BT703: "Busto Garolfo, Buonarroti/Carroccio",
  BT704: "Busto Garolfo, Curiel/De Amicis",
  BT775: "Busto Garolfo, Giacomo Rossini 35",
  BT776: "Busto Garolfo, Vincenzo Bellini 44",
  BT947: "Busto Garolfo, Buonarroti 3",
  BT949: "Busto Garolfo, Per Busto A 91,Piscina",
  BT951: "Busto Garolfo, Per Busto A. 90,Piscina",
  BT956: "Busto Garolfo, Montebianco fr. 17",
  BT999: "Busto Garolfo, Busto A. 131,Deposito",

  // ── Corbetta ──
  CB021: "Corbetta, Simone Da Corbetta",
  CB022: "Corbetta, Milano,La Pobbia",
  CB023: "Corbetta, Milano,La Pobbia",
  CB053: "S.S. Ticino, Borletti/Stazione",
  CB080: "S.S. Ticino, Borletti/Stazione",
  CB088: "Corbetta, XXV Aprile",
  CB098: "Corbetta, Simone Da Corbetta/S. Ambrogio",
  CB099: "Corbetta, Beretta/Volta",
  CB111: "Corbetta, XXV Aprile",

  // ── Cornaredo ──
  CD071: "Cornaredo, Dubini,S.Pietro all'Olmo",
  CD072: "Cornaredo, Milano/Garibaldi",
  CD074: "Cornaredo, Dubini 14",
  CD079: "Cornaredo, Milano/Garibaldi",
  CD081: "Cornaredo, Milano/S.Siro",
  CD150: "Cornaredo, S.Carlo/Ponti",
  CD155: "Cornaredo, S.Carlo/Ponti",
  CD160: "Cornaredo, Mazzini/Ricciotti",
  CD166: "Cornaredo, Mazzini/Ricciotti",
  CD901: "Cornaredo, Milano/Cascina Torretta",
  CD910: "Cornaredo, Milano,Cas.na Torretta",

  // ── Cuggiono ──
  CG111: "Cuggiono, C. Stucchi 7,Castelletto",
  CG143: "Cuggiono, Della Vittoria fr.  12",
  CG149: "Cuggiono, S. Rocco 89",
  CG150: "Cuggiono, S. Giorgio 8",
  CG178: "Cuggiono, Manzoni 1",
  CG190: "Cuggiono, Fermo 34,Ospedale",
  CG250: "Cuggiono, Garibaldi fr. 32",
  CG251: "Cuggiono, Garibaldi 64",
  CG511: "Cuggiono, C. Stucchi fr. 9,Castelletto",
  CG702: "Cuggiono, Manzon/De Agostini",
  CG998: "Cuggiono, IV Novembre 36",
  CG999: "Cuggiono, IV Novembre/XI Settembre",

  // ── CL ──
  CL001: "Cerro Maggiore, S. Bartolomeo,Cantalupo",
  CL002: "Cerro Maggiore, Risorgimento/Perego",
  CL005: "Cerro Maggiore, Calvi/S. Bartolomeo",
  CL011: "Cerro Maggiore, S. Bartolomeo,Cantalupo",
  CL012: "Cerro Maggiore, Risorgimento/Perego",

  // ── CN ──
  CN001: "Canegrate, XXIV Maggio/Trieste",
  CN002: "Canegrate, IV Novembre/Garibaldi",
  CN006: "Canegrate, F.lli Bandiera/Somalia",
  CN016: "Canegrate, F.lli Bandiera/Somalia",
  CN017: "Canegrate, IV Novembre/Garibaldi",
  CN018: "Canegrate, XXIV Maggio/Donatori",
  CN103: "Canegrate, Magenta/Gran Sasso",
  CN104: "Canegrate, Magenta/Vesuvio",
  CN105: "Canegrate, Magenta 31",
  CN118: "Canegrate, F. Bandiera",
  CN218: "Canegrate, F. Bandiera 56/Isonzo",

  // ── CR ──
  CR001: "Cerro Maggiore, Bernocchi/Condordia",
  CR002: "Cerro Maggiore, Cappuccini 53",
  CR003: "Cerro Maggiore, Cappuccini,C. Dei Frati",
  CR004: "Cerro Maggiore, Roma",
  CR005: "Cerro Maggiore, Lampugnani",
  CR006: "Cerro Maggiore, IV Novembre/Torino",
  CR007: "Cerro Maggiore, Colombo/IV Novembre",
  CR008: "Cerro Maggiore, IV Novembre/Carso",
  CR015: "Cerro Maggiore, XX Settembre,Chiesetta",
  CR022: "Cerro Maggiore, Cappuccini 42",
  CR033: "Cerro Maggiore, Cappuccini,C. Dei Frati",
  CR066: "Cerro Maggiore, IV Novembre/Arno",
  CR077: "Cerro Maggiore, C. Colombo/IV Novembre",
  CR080: "Cerro Maggiore, T. E Trieste/Cottolengo",
  CR088: "Cerro Maggiore, IV Novembre/Asiago",
  CR089: "Cerro Maggiore, Trento T./Canova",

  // ── Castano Primo ──
  CT001: "Castano Primo, Don Milani",
  CT011: "Castano Primo, Don Milani 1,IIS Torno",
  CT021: "Castano Primo, Per Buscate/Saverio Nitti",
  CT027: "Castano Primo, Per Buscate fr. S. Nitti",
  CT050: "Castano Primo, Tadino 16",
  CT100: "Castano Primo, Stazione,Stazione FS",
  CT110: "Castano Primo, Garibaldi",

  // ── Casorezzo ──
  CZ010: "Casorezzo, Busto Garolfo/S. Salvatore",
  CZ070: "Casorezzo, Ossona",
  CZ080: "Casorezzo, Bertani fr. 19",
  CZ088: "Casorezzo, Bertani/Parabiago",
  CZ093: "Casorezzo, E. Mattei fr. 1",
  CZ094: "Casorezzo, Arluno/Delle Chiuse",
  CZ097: "Casorezzo, Parabiago 47",

  // ── Dairago ──
  DG097: "Dairago, Verdi 24",
  DG099: "Dairago, Verdi 13",
  DG141: "Dairago, Damiano,Municipio",
  DG142: "Dairago, Damiano Chiesa 11",
  DG801: "Dairago, Della Circonvallazione/Zara",
  DG807: "Dairago, Circonvallazione 48",

  // ── GB ──
  GB038: "Nerviano, S. Francesco,Garbatola",

  // ── Inveruno ──
  IN127: "Inveruno, Varese/Don Paganini",
  IN128: "Inveruno, V.Varese/Don Paganini",
  IN235: "Inveruno, Lombardia/Magenta",
  IN275: "Inveruno, Lombardia/Liguria",
  IN285: "Inveruno, Marconi 57",
  IN350: "Inveruno, Lombardia 5",
  IN351: "Inveruno, Lombardia fr. 7",
  IN375: "Inveruno, XXIV Maggio,Furato",
  IN401: "Ossona, SP34,Furato",
  IN402: "Inveruno, Europa/Milano",
  IN403: "Inveruno, Marconi fr. 65",
  IN433: "Inveruno, Del Carso/XXIV Maggio",
  IN801: "Inveruno, Einaudi fr. 2",
  IN802: "Inveruno, Einaudi 6",

  // ── Legnano ──
  LG001: "Legnano, Sempione,Ospedale",
  LG002: "Legnano, Sempione 111,Madonnina,Istituti",
  LG003: "Legnano, Tosi fr. 3",
  LG004: "Legnano, P. Micca 3/Cairoli",
  LG005: "Legnano, XXIX Maggio 180,S. Martino",
  LG006: "Legnano, Pietro Micca 59",
  LG015: "Legnano, XXIX Maggio 102/Mazzini",
  LG025: "Legnano, XX Settembre,S. Giorgio S.L",
  LG029: "Legnano, XX Settembre/S.M. Del Carso",
  LG051: "Legnano, Cadorna/Baracca",
  LG052: "Cerro Maggiore, Tessa,Ingr. Autostrada",
  LG057: "Legnano, Tessa/Cadorna",
  LG058: "Legnano, Cadorna/Trivulzio",
  LG061: "Legnano, XX Settembre/S.Bernardino",
  LG066: "Legnano, Pietro Micca 29",
  LG090: "Legnano, del Popolo 9,Stazione FS",
  LG091: "Legnano, del Popolo",
  LG112: "Legnano, Guerciotti/Gorizia",
  LG147: "Legnano, Grigna,Ospedale",
  LG150: "Legnano, Montenevoso/Berchet",
  LG171: "Legnano, Sempione fr. 37,Ospedale",
  LG172: "Legnano, Sempione 72,Madonnina",
  LG173: "Legnano, Tosi 3",
  LG332: "Legnano, Novara 35,Liceo Scientifico",
  LG335: "Legnano, Novara 32-35,Liceo Scientifico",
  LG336: "Legnano, Venegoni 116-118/Montecassino",
  LG337: "Legnano, Venegoni 83/Bologna",
  LG508: "Legnano, Milano/S.Caterina",
  LG522: "Legnano, Cadorna,Uscita Autostrada",
  LG611: "Legnano, XX Settembre/S.Bernardino",
  LG805: "Legnano, XX Settembre 7",
  LG807: "Legnano, V.Veneto/XX Settembre",
  LG990: "Legnano, Monumento,Stazione FS",

  // ── LN ──
  LN010: "Lainate, Matteotti/Rimembranze 28",
  LN018: "Lainate, Italia",
  LN019: "Lainate, Re Umberto/Kennedy dir.Origgio",
  LN021: "Lainate, Re Umberto/Chiesa dir. Lainate",
  LN024: "Lainate, L. Da Vinci 30",
  LN025: "Lainate, Bramante fr. 2,Scuole",
  LN028: "Lainate, F Filzi/Palladio",
  LN030: "Lainate, Padre Clerici/Rimembranze",
  LN031: "Lainate, Gorizia 32",
  LN032: "Lainate, Lamarmora 10/ Matteotti",
  LN033: "Lainate, Lamarmora fr. N. Bixio",
  LN035: "Lainate, Re Umberto/Lamarmora",
  LN041: "Lainate, Barbaiana,Grancia",
  LN043: "Lainate, Pagliera fr. 24,Grancia",
  LN050: "Lainate, Rho/Lepetit,Ing.Autostrade",
  LN071: "Lainate, Barbaiana 14",
  LN079: "Lainate, V. Veneto,Biblioteca",
  LN081: "Lainate, De Gasperi,Cementificio",
  LN082: "Lainate, De Gasperi",
  LN088: "Lainate, Pagliera 28,Grancia",
  LN179: "Lainate, Italia 47",
  LN183: "Lainate, L. Da Vinci/Bramante",
  LN500: "Lainate, Manzoni/Rho",

  // ── MC ──
  MC010: "Marcallo Con Casone, Varese fr. 14",
  MC011: "Marcallo Con Casone, Roma 68",
  MC020: "Marcallo Con Casone, Roma fr. 72",
  MC021: "Marcallo Con Casone, Varese 16",
  MC050: "Marcallo Con Casone, A. Moro",
  MC801: "Marcallo Con Casone, Roma 159",
  MC802: "Marcallo Con Casone, Roma 172",

  // ── Milano ──
  MD001: "Milano, Molino Dorino M1",
  MD111: "Milano, Molino Dorino M1",

  // ── Magenta ──
  MG306: "Magenta, Novara/Pellico,Carabinieri",
  MG401: "Magenta, Tragella dir. Rossini",
  MG402: "Magenta, Tragella",
  MG501: "Magenta, Novara 15",
  MG502: "Magenta, Cavallari 28",
  MG559: "Magenta, De Medici 36,Ponte Nuovo",
  MG561: "Magenta, Brocca 41,Stazione FS",
  MG601: "Magenta, Espinasse 7-9",
  MG701: "Magenta, Milano 8",
  MG703: "Magenta, Novara/Pellico,Carabinieri",
  MG704: "Magenta, Leopardi/Italia",
  MG705: "Magenta, De Medici fr. 30,Ponte Nuovo",
  MG708: "Magenta, Novara fr. 17",
  MG720: "Magenta, Brocca fr. 49,Stazione FS",
  MG756: "Magenta, Leopardi/Italia",
  MG796: "Magenta, Dello Stadio fr.  35",
  MG797: "Magenta, Dello Stadio 35",
  MG798: "Magenta, Dello Stadio 17/Pastrengo",
  MG799: "Magenta, dello Stadio 22",
  MG801: "Magenta, Cavallari 39",
  MG802: "Magenta, Espinasse 36",
  MG871: "Magenta, Milano 101",
  MG888: "Magenta, Tobagi",

  // ── ML ──
  ML002: "Milano, Sempione,Zona Rai",
  ML003: "Milano, Firenze",
  ML004: "Milano, Certosa/Monteceneri",
  ML005: "Milano, Accursio/Certosa",
  ML022: "Milano, Sempione,Zona Rai",
  ML023: "Milano, Firenze",
  ML024: "Milano, Certosa/Monteceneri",
  ML025: "Milano, Certosa/Accursio",
  ML111: "Milano, Jacini,Cadorna",
  ML115: "Milano, Gadio,Parco Sempione",
  ML200: "Milano, Del Ghisallo/Ai Laghi",
  ML801: "Milano, Del Ghisallo/Ai Laghi",

  // ── MM ──
  MM101: "Magnago, Rimembranze Fronte/Trento",
  MM102: "Magnago, General Cantore 9",
  MM103: "Magnago, Cadorna 14-16",
  MM204: "Magnago, Cadorna Fronte/Tommaseo",

  // ── Mantegazza ──
  MN001: "Vanzago, Roma 63",
  MN011: "Vanzago, Roma fr. 63",
  MN015: "Arluno, S. Francesco",
  MN021: "Arluno, S. Francesco",

  // ── MS ──
  MS010: "Mesero, Garibaldi fr. 17",
  MS011: "Mesero, Garibaldi 15",

  // ── NR ──
  NR001: "Nerviano, SS33,La Torre",
  NR005: "Nerviano, SS33,La Colorina",
  NR010: "Nerviano, SP109,Supermercato",
  NR011: "Nerviano, Giovanni XXIII,Ex Mattatoio",
  NR012: "Nerviano, Kennedy/S.Anna,Rotonda",
  NR013: "Nerviano, Kennedy",
  NR014: "Nerviano, Pasubio/Battisti",
  NR015: "Nerviano, Toniolo/Crivelli",
  NR016: "Nerviano, Cogliati/Vittoria",
  NR031: "Nerviano, SS33,La Guardia",
  NR033: "Nerviano, Pasubio/Marzorati",
  NR040: "Nerviano, SS33,La Guardia",
  NR041: "Nerviano, Milano,La Torre",
  NR042: "Nerviano, Sempione/Matteotti",
  NR045: "Nerviano, SP109 fr. Supermercato",
  NR090: "Nerviano, Pasteur,Parcheggio",
  NR101: "Nerviano, Pasubio/Battisti",
  NR102: "Nerviano, Kennedy",
  NR103: "Nerviano, Kennedy/S.Anna",
  NR104: "Nerviano, Giovanni XXIII,Mattatoio",
  NR150: "Nerviano, Pasubio/Marzorati",
  NR801: "Nerviano, De Gasperi/Vivaldi",
  NR802: "Nerviano, Europa,Selex",

  // ── NS ──
  NS010: "Nosate, Ponte Castano 20",
  NS011: "Turbigo, Nosate 65",
  NS050: "Nosate, Ponte Castano fr.  20",
  NS099: "Nosate, Ponte Di Castano,Capolinea",

  // ── Olcella ──
  OC113: "Busto Garolfo, Olcella/Montebello 16",
  OC114: "Busto Garolfo, Olcella/Montebello 11",

  // ── OR ──
  OR001: "Origgio, Verdi",
  OR002: "Origgio, Immacolata",
  OR003: "Origgio, A.Manzoni fr. 18",
  OR004: "Origgio, Cascina Muschiona fr. 35",
  OR011: "Origgio, G.Verdi",
  OR043: "Origgio, Dante Alighieri 82",
  OR044: "Origgio, Cascina Muschiona 35",
  OR047: "Origgio, Croce 3",
  OR073: "Origgio, Don Minzoni",

  // ── Ossona ──
  OS001: "Ossona, Patriotti fr. 118 A",
  OS011: "Ossona, Patrioti 4",
  OS021: "Ossona, Europa 82,Asmonte",
  OS022: "Ossona, Baracca 11",
  OS023: "S.S. Ticino, SP34 fr. 300",
  OS033: "Arluno, SP34 300",
  OS034: "Ossona, Baracca 8",
  OS035: "Ossona, Europa 64,Asmonte",

  // ── Parabiago ──
  PB001: "Parabiago, SS33,S.Lorenzo di Parabiago",
  PB009: "Parabiago, Alfieri/S. Ambrogio",
  PB011: "Parabiago, Sempione",
  PB015: "Parabiago, Principe Omodeo/Foscolo",
  PB021: "Parabiago, Manara,Costa Di S. Lorenzo",
  PB023: "Parabiago, Maggiolini Lato Chiesa",
  PB024: "Parabiago, Ugo Foscolo 96",
  PB059: "Parabiago, Manara,Costa Di S. Lorenzo",
  PB081: "Parabiago, Unione",
  PB090: "Parabiago, S. Pisoni,Autostazione FS",
  PB100: "Parabiago, Spagliardi,Maggiolini",
  PB101: "Parabiago, Spagliardi,Maggiolini",
  PB701: "Viale Lombardia FRONTE Eurospin PROVVISORIA",
  PB702: "Viale Lombardia lato EuroSpin PROVVISORIA",

  // ── Pregnana Milanese ──
  PG005: "Pregnana M., Roma/Olivetti",
  PG008: "Pregnana M., Marconi/Gorizia",
  PG009: "Pregnana M., Giovanni XXIII 55",
  PG030: "Pregnana M., Roma/Lombardia",
  PG031: "Pregnana M., Roma/Carducci",
  PG055: "Pregnana M., Roma 17/Olivetti",
  PG099: "Pregnana M., Giovanni XXIII 16",
  PG100: "Pregnana M., Costituzione 1,Staz. FS",
  PG101: "Pregnana M., Marconi fr. 67,Stazione FS",
  PG102: "Pregnana M., Marconi fr. 146,Stazione FS",
  PG111: "Pregnana Milanese, Costituzione,Staz. FS",

  // ── PM ──
  PM001: "Pogliano Milanese, SS33,Bettolino",
  PM002: "Pogliano Milanese, Nazario Sauro/Mazzini",
  PM003: "Pogliano Milanese, Europa/Mercato",
  PM008: "Pogliano Milanese, Oberdan 10",
  PM022: "Pogliano Milanese, Nazario Sauro,Chiesa",
  PM033: "Pogliano Milanese, Europa 13",
  PM041: "Pogliano Milanese, Sempione,Bettolino",
  PM088: "Pogliano Milanese, Oberdan fr. 10",

  // ── PR ──
  PR001: "Pero, Sempione 97",
  PR002: "Pero, SS33 241/Borromei,Cerchiate",
  PR009: "Pero, SS33,Cerchiate,Fiera",
  PR010: "Pero, SS del Sempione/Pisacane",
  PR017: "Pero, SS del Sempione/Pisacane",
  PR019: "Pero, SS33,Cerchiate,Fiera",
  PR041: "Pero, Sempione 108,Centro",
  PR042: "Pero, SS del Sempione/Battisti,Cerchiate",

  // ── RB ──
  RB018: "Robecchetto c.Induno, Magenta 5",
  RB061: "Robecchetto c.Induno, Magenta 48",
  RB119: "Robecchetto c.Induno, Umberto I 129",
  RB120: "Robecchetto c.Induno, Umberto I 5",
  RB483: "Robecchetto c.Induno, Umberto I 14",

  // ── Rogorotto ──
  RG001: "Arluno, S. Caterina 5",
  RG011: "Arluno, S. Caterina 4",

  // ── RH ──
  RH001: "Rho, Europa/Canova",
  RH002: "Rho, Europa 129/Marconi,Pasque',Istituto",
  RH003: "Rho, Europa/Lainate,Santuario",
  RH004: "Rho, Europa,Ospedale",
  RH005: "Rho, Europa/D'Aquino",
  RH011: "Rho, Europa",
  RH016: "Rho, Lainate 68/Cavour,ITC Mattei",
  RH022: "Rho, Europa fr. 133/Marconi,Paque'",
  RH023: "Rho, Europa/Lainate,Santuario",
  RH024: "Rho, Europa/Cadorna,Ospedale",
  RH025: "Rho, Europa/D'Aquino",
  RH027: "Rho, Europa/Canova",
  RH039: "Rho, Europa",
  RH097: "Rho, Magenta fr. Prati",
  RH098: "Rho, A. Volta fr. 50",
  RH099: "Rho, Magenta/Prati",
  RH100: "Rho, SS33,La Lira,Stazione FS",
  RH110: "Rho, Ratti 88,Liceo Majorana",
  RH116: "Rho, Lainate 66/Cavour,ITC Mattei",
  RH117: "Rho, Europa fr.194,Pome'",
  RH118: "Rho, Europa 194/Bersaglio",
  RH119: "Rho, Ratti 85/Treviso,Liceo Majorana",
  RH121: "Rho, Capuana fr. 3/Mattei",
  RH135: "Rho, Buon Gesu' 39",
  RH150: "Rho, Liberta' fr. Stazione",
  RH200: "Rho, Capuana 50/Giusti",

  // ── SD ──
  SD005: "Sedriano, Giovanni XXIII fr. 26",
  SD006: "Sedriano, Fagnani/Europa",
  SD012: "Sedriano, Giovanni XXIII 26",
  SD060: "Sedriano, Don Minzoni/Galilei",
  SD066: "Sedriano, Fagnani/Europa",
  SD085: "Sedriano, Magenta 11",
  SD091: "Sedriano, Magenta fr.  11",

  // ── S. Giorgio su Legnano ──
  SG001: "Legnano, XX Settembre",
  SG002: "S. Giorgio Su Legnano, IV Novembre",
  SG003: "S. Giorgio Su Legnano, Milano 46",
  SG033: "Canegrate, Milano 37",
  SG034: "S. Giorgio Su Legnano, Pasubio 17",
  SG035: "Legnano, XX Settembre",
  SG050: "S. Giorgio Su Legnano, Restelli  5",
  SG182: "S. Giorgio Su Legnano, Roma 3/Acquedotto",
  SG801: "S. Giorgio Su Legnano, Boccaccio/Magenta",
  SG807: "S. Giorgio Su Legnano, Roma fr. Vinci",

  // ── SI ──
  SI003: "Nerviano, Rismondi,S.Ilario Milanese",
  SI004: "Nerviano, Trento/Duca Di Pistoia",
  SI005: "Nerviano, Garibaldi/Chiesa",
  SI010: "Nerviano, Garibaldi/Castiglioni",
  SI020: "Nerviano, Garibaldi/Castiglioni",
  SI033: "Nerviano, Guareschi,Cimitero",
  SI333: "Nerviano, Guareschi,Cimitero",
  SI801: "Nerviano, Rismondi,S.Ilario Milanese",

  // ── SV ──
  SV001: "S.V. Olona, Roma 75",
  SV002: "S.V. Olona, Italia",
  SV003: "S.V. Olona, SS33 del Sempione",
  SV005: "S.V. Olona, F. D'Assisi/Sempione",
  SV007: "S.V. Olona, Sempione/Pisacane",
  SV011: "S.V. Olona, SS33 del Sempione/Parini",
  SV018: "S.V. Olona, SS33 del Sempione/Piave",
  SV022: "S.V. Olona, Italia",
  SV100: "S.V. Olona, Roma",

  // ── TB ──
  TB050: "Turbigo, Nosate fr. 6",
  TB051: "Turbigo, Roma 59",
  TB055: "Turbigo, Villoresi 42",
  TB078: "Turbigo, Villoresi 45",
  TB079: "Turbigo, Allea Comunale 9",
  TB080: "Turbigo, Roma fr. 59",
  TB081: "Turbigo, Nosate 6",
  TB090: "Turbigo, Allea Comunale 12",

  // ── S. Stefano Ticino ──
  TI033: "S.S. Ticino, Repubblica fr. 28/Dante",
  TI111: "S.S. Ticino, Della Stazione 10,Staz. FS",
  TI211: "S.S. Ticino, Della Stazione 5,Staz. FS",
  TI333: "S.S. Ticino, Repubblica",

  // ── TM ──
  TM005: "Settimo Milanese, Gramsci 32",
  TM006: "Settimo Milanese, Gramsci 6",
  TM015: "Settimo Milanese, Gramsci/Foscolo",
  TM035: "Settimo Milanese, Gramsci",
  TM036: "Milano, Gramsci dir. Magenta",

  // ── Villa Cortese ──
  VC005: "Villa Cortese, Canov/Buonarroti",
  VC006: "Villa Cortese, Canova/Perugino",
  VC050: "Villa Cortese, A.Da Giussano 32",
  VC051: "Villa Cortese, A.Da Giussano 50",
  VC801: "Villa Cortese, Pietro Micca 17",
  VC807: "Villa Cortese, Pietro Micca 38",

  // ── Vighignolo/Settimo M. ──
  VH237: "Settimo Milanese, Mereghetti 22/Airaghi",
  VH238: "Settimo Milanese, Mereghetti/Airaghi",

  // ── VL ──
  VL037: "Nerviano, Tonale,P. Villoresi",

  // ── VN ──
  VN101: "Vanzaghello, Milano 1/S.Rocco",
  VN102: "Vanzaghello, Roma 8",
  VN103: "Vanzaghello, Roma 36,Stazione FN",
  VN201: "Vanzaghello, Roma 71,Stazione FN",
  VN202: "Vanzaghello, Roma 23",
  VN203: "Vanzaghello, S. Rocco fr. 45",

  // ── VP ──
  VP005: "Parabiago, Casorezzo 20",
  VP009: "Parabiago, Casorezzo 15",

  // ── VS ──
  VS005: "Parabiago, S. Sebastiano 102",
  VS010: "Parabiago, Barbanti",

  // ── VT ──
  VT010: "Vittuone, Gandhi fr. 3,Stazione",
  VT011: "Vittuone, Zara 40",
  VT018: "Vittuone, Milano 7",
  VT022: "Vittuone, Milano 22",
  VT028: "Vittuone, Milano/V. Veneto",
  VT030: "Vittuone, Cadorna/Mazzini",
  VT100: "Vittuone, Gandhi 1,Stazione",
  VT111: "Vittuone, Zara fr. 34",
  VT222: "Vittuone, Milano fr. 22",

  // ── VZ ──
  VZ001: "Vanzago, Ferrario,Cimitero",
  VZ002: "Vanzago, Garibaldi fr. 2",
  VZ004: "Vanzago, Milano fr. 3",
  VZ011: "Vanzago, Ferrario,Cimitero",
  VZ033: "Vanzago, Garibaldi,Scuole",
  VZ999: "Via Monasterolo (cimitero)",
};

export function getStopName(code) {
  const fullName = STOP_NAMES[code] || code;
  return shortenStopName(fullName);
}

export function shortenStopName(name) {
  if (!name || typeof name !== "string") return name;
  let short = name;

  // Accorciamento dei prefissi delle città
  short = short.replace(/^Busto Garolfo,\s*/i, "Busto G. ");
  short = short.replace(/^Busto G\.,\s*/i, "Busto G. ");
  short = short.replace(/^Villa Cortese,\s*/i, "Villa C. ");
  short = short.replace(/^Dairago,\s*/i, "Dairago ");
  short = short.replace(/^Arconate,\s*/i, "Arconate ");
  short = short.replace(/^Legnano,\s*/i, "Legnano ");
  short = short.replace(/^Parabiago,\s*/i, "Parabiago ");
  short = short.replace(/^Busto Arsizio,\s*/i, "Busto A. ");
  short = short.replace(/^Casorezzo,\s*/i, "Casorezzo ");
  short = short.replace(/^Arluno,\s*/i, "Arluno ");
  short = short.replace(/^Pregnana M\.,\s*/i, "Pregnana ");
  short = short.replace(/^Pregnana Milanese,\s*/i, "Pregnana ");
  short = short.replace(/^Cornaredo,\s*/i, "Cornaredo ");
  short = short.replace(/^Settimo Milanese,\s*/i, "Settimo ");
  short = short.replace(/^Milano,\s*/i, "Milano ");
  short = short.replace(/^Magenta,\s*/i, "Magenta ");
  short = short.replace(/^S\.S\. Ticino,\s*/i, "S. Stefano ");
  short = short.replace(/^Inveruno,\s*/i, "Inveruno ");
  short = short.replace(/^Cuggiono,\s*/i, "Cuggiono ");
  short = short.replace(/^Buscate,\s*/i, "Buscate ");
  short = short.replace(/^Castano Primo,\s*/i, "Castano P. ");
  short = short.replace(/^S\. Giorgio Su Legnano,\s*/i, "S. Giorgio ");
  short = short.replace(/^S\. Giorgio,\s*/i, "S. Giorgio ");
  short = short.replace(/^Olcella,\s*/i, "Olcella ");
  // Nuove città dalla rete estesa
  short = short.replace(/^Rho,\s*/i, "Rho ");
  short = short.replace(/^Nerviano,\s*/i, "Nerviano ");
  short = short.replace(/^Pero,\s*/i, "Pero ");
  short = short.replace(/^Pogliano Milanese,\s*/i, "Pogliano ");
  short = short.replace(/^S\.V\. Olona,\s*/i, "S.V. Olona ");
  short = short.replace(/^Lainate,\s*/i, "Lainate ");
  short = short.replace(/^Arese,\s*/i, "Arese ");
  short = short.replace(/^Bareggio,\s*/i, "Bareggio ");
  short = short.replace(/^Bernate Ticino,\s*/i, "Bernate T. ");
  short = short.replace(/^Bernate T\.,\s*/i, "Bernate T. ");
  short = short.replace(/^Boffalora Sopra Ticino,\s*/i, "Boffalora ");
  short = short.replace(/^Canegrate,\s*/i, "Canegrate ");
  short = short.replace(/^Cerro Maggiore,\s*/i, "Cerro M. ");
  short = short.replace(/^Corbetta,\s*/i, "Corbetta ");
  short = short.replace(/^Magnago,\s*/i, "Magnago ");
  short = short.replace(/^Marcallo Con Casone,\s*/i, "Marcallo ");
  short = short.replace(/^Mesero,\s*/i, "Mesero ");
  short = short.replace(/^Nosate,\s*/i, "Nosate ");
  short = short.replace(/^Origgio,\s*/i, "Origgio ");
  short = short.replace(/^Ossona,\s*/i, "Ossona ");
  short = short.replace(/^Robecchetto c\.Induno,\s*/i, "Robecchetto ");
  short = short.replace(/^Sedriano,\s*/i, "Sedriano ");
  short = short.replace(/^Turbigo,\s*/i, "Turbigo ");
  short = short.replace(/^Vanzaghello,\s*/i, "Vanzaghello ");
  short = short.replace(/^Vanzago,\s*/i, "Vanzago ");
  short = short.replace(/^Vittuone,\s*/i, "Vittuone ");

  // Rimozione dei nomi propri o parole superflue per rendere i nomi compatti nella UI
  short = short.replace(/\b(Giacomo|Vincenzo|Damiano|Pietro|Alessandro|Beata Vergine\/Dei|Giovanni XXIII|Pozzo Bonelli fr\.)\b/gi, "");

  // Uniformazione dei caratteri e rimozione degli spazi in eccesso
  short = short.replace(/\s+/g, " ").trim();

  // Sostituzione delle barre inclinate con "a." (es. "Buonarroti/Busto A." -> "Buonarroti a. Busto A.")
  short = short.replace(/\//g, " a. ");

  // Standardizzazione delle abbreviazioni "fr." in "fr"
  short = short.replace(/\bfr\.(?!\w)/gi, "fr");

  return short;
}
