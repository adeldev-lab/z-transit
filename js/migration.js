// =============================================================================
// migration.js – Pipeline di Migrazione Client-Side (Schema Versioning)
// =============================================================================
// Gestisce l'evoluzione dello schema delle preferenze dell'utente, eseguendo
// upgrade sequenziali e applicando la sanificazione per preservare la consistenza.
// =============================================================================

export const CURRENT_SCHEMA_VERSION = "1.0.0";

/**
 * Migra e normalizza il payload recuperato (dal cloud o da file esterno)
 * alla versione più recente dello schema dati utilizzata dall'app.
 * @param {object} payload - `{ settings, notifications, schemaVersion }`
 * @param {object} cfg - Configurazione attiva dell'app
 * @returns {Promise<object>} Payload migrato e sanificato `{ settings, notifications, schemaVersion }`
 */
export async function migrateAndSanitize(payload, cfg) {
  if (!payload) return null;

  // Clona profondamente per evitare mutazioni collaterali involontarie
  const data = JSON.parse(JSON.stringify(payload));
  
  // Se l'oggetto non ha una versione, assumiamo sia lo schema iniziale legacy
  let version = data.schemaVersion || "0.0.0";

  // Pipeline di aggiornamento incrementale (per futuri update):
  // Example of future migration:
  // if (compareVersions(version, "1.1.0") < 0) {
  //   console.log("[Migration] Upgrade schema dati da " + version + " a 1.1.0");
  //   data.settings.someNewField = data.settings.someOldField || "default";
  //   delete data.settings.someOldField;
  //   version = "1.1.0";
  // }

  // Importazioni dinamiche per rompere i cicli di dipendenza al boot-time
  const { sanitizeSettings } = await import("./settings.js");
  const { getNotificationConfig, sanitizeNotifications } = await import("./notifications.js");

  // Applica la versione dello schema corrente
  data.schemaVersion = CURRENT_SCHEMA_VERSION;

  // Sanifica e valida ciascuna entità per garantire che includa tutti i campi necessari
  data.settings = sanitizeSettings(data.settings, cfg);
  data.notifications = sanitizeNotifications(data.notifications || getNotificationConfig());

  return data;
}


/**
 * Confronta due stringhe di versione semantiche (es: "1.0.0" e "1.2.0").
 * Ritorna -1 se v1 < v2, 1 se v1 > v2, 0 se sono identiche.
 * @param {string} v1 
 * @param {string} v2 
 * @returns {number}
 */
export function compareVersions(v1, v2) {
  const parts1 = String(v1).split('.').map(Number);
  const parts2 = String(v2).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}
