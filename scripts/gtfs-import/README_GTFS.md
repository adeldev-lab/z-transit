# GTFS → Trasporti Busto Garolfo: Script di Conversione

## Panoramica

Questi script convertono i dati GTFS ufficiali di Movibus nei file `data/z*.js` e `data/config.js` usati dall'app. Servono per aggiornare gli orari quando Movibus pubblica un nuovo feed GTFS.

## Quando usarli

- Il feed GTFS attuale (2026-03-06) scade il **7 giugno 2026**
- Movibus pubblica un nuovo feed ogni ~3 mesi
- Scarica il nuovo feed da: https://www.movibus.it (sezione open data / GTFS)
- Oppure cerca "Movibus GTFS" su Google — il file è un .zip con i .txt standard

## Prerequisiti

- Node.js 18+ installato
- Nessuna dipendenza esterna (usa solo moduli nativi Node.js)

## Uso

```bash
# 1. Scarica il nuovo feed GTFS e scompattalo in una cartella
#    Es: C:\Users\nasar\Downloads\2026-06-08_Movibus\

# 2. Esegui lo script principale passando il percorso del feed
node scripts/gtfs-import/convert.mjs "C:\Users\nasar\Downloads\2026-06-08_Movibus"

# 3. I file generati vengono scritti in data/ (sovrascrivono i precedenti)
#    - data/z649.js
#    - data/z644.js
#    - data/z627.js
#    - data/z625.js
#    - data/z647.js
#    - data/z642.js

# 4. (Opzionale) Aggiorna anche le fermate e coordinate
node scripts/gtfs-import/update-stops.mjs "C:\Users\nasar\Downloads\2026-06-08_Movibus"
#    - Aggiorna js/line-config.js (STOP_NAMES)
#    - Aggiorna js/map-data.js (STOP_COORDINATES)

# 5. (Opzionale) Aggiorna le date di validità in config.js
node scripts/gtfs-import/update-calendar.mjs "C:\Users\nasar\Downloads\2026-06-08_Movibus"
#    - Stampa a console le date festive e i periodi di servizio
#    - NON modifica config.js automaticamente (le sospensioni estive vanno verificate manualmente)
```

## Struttura file

```
scripts/gtfs-import/
├── README_GTFS.md           ← Questo file
├── convert.mjs         ← Script principale: GTFS → data/z*.js
├── update-stops.mjs    ← Aggiorna STOP_NAMES e STOP_COORDINATES
├── update-calendar.mjs ← Analizza calendar_dates e stampa report
└── lib/
    ├── parse-csv.mjs   ← Parser CSV generico (no dipendenze)
    ├── gtfs-reader.mjs ← Legge e indicizza i file GTFS
    └── trip-builder.mjs← Costruisce gli oggetti trip nel formato dell'app
```

## Formato output (data/z*.js)

Ogni file esporta un oggetto con chiavi `weekday_outbound`, `weekday_return`, `saturday_outbound`, ecc. Ogni valore è un array di trip:

```js
export const Z649_DATA = {
  weekday_outbound: [
    { stops: { BT999: 300, BT949: 302, BT775: 304, ... MD111: 353 }, validity: "FR5" },
    ...
  ],
  weekday_return: [...],
  saturday_outbound: [...],
  ...
};
```

I tempi sono in **minuti dall'inizio del giorno** (es. 05:00 = 300, 21:20 = 1280).

## Mappatura GTFS → App

| GTFS | App |
|------|-----|
| `route_id` H220 | Z649 |
| `route_id` H216 | Z644 |
| `route_id` H211 | Z627 |
| `route_id` H210 | Z625 |
| `route_id` H218 | Z647 |
| `route_id` H214 | Z642 |
| `direction_id` 0 | outbound |
| `direction_id` 1 | return |
| `service_id` FR5_* | weekday (feriale tutto l'anno) |
| `service_id` FI5_* | weekday (feriale invernale) |
| `service_id` SC5_* | weekday (scolastico) |
| `service_id` SAB_* / SIS_* | saturday |
| `service_id` FES_* | sunday |

## Note importanti

1. **Non toccare config.js automaticamente** — contiene configurazioni manuali (stopProfiles, interchanges, m1_destinations, canegrate, homeProfile) che non derivano dal GTFS
2. **Verificare le sospensioni estive** — il GTFS copre solo ~3 mesi, le sospensioni luglio-agosto vanno confermate manualmente ogni anno
3. **I codici fermata (stop_code) sono stabili** — Movibus usa gli stessi codici BT*, LG*, PG*, MD* tra un feed e l'altro
4. **Corse scolastiche (SC5)** — hanno un campo `validity: "SC5"` nel progetto; l'app le mostra/nasconde in base al periodo scolastico
5. **Dopo la conversione** — bumpa `CACHE_NAME` in `sw.js` e `cfg.version` / `cfg.lastUpdate` in `data/config.js`
