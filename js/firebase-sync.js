// =============================================================================
// firebase-sync.js – Cloud sync via Firebase Auth + Firestore
// =============================================================================
// Provides Google sign-in and bidirectional sync of user preferences.
// Compatible with GitHub Pages (no backend required).
// Uses Firebase Modular SDK via CDN (imported in index.html).
// =============================================================================

import { firebaseConfig } from "./firebase-config.js";
import { encryptPayload, decryptPayload } from "./crypto-utils.js";
import { migrateAndSanitize } from "./migration.js";

const FIRESTORE_COLLECTION = "users";
const SYNC_DEBOUNCE_MS = 2000;

let _app = null;
let _auth = null;
let _db = null;
let _currentUser = null;
let _syncTimer = null;
let _onAuthChangeCallbacks = [];
// Last successful local write timestamp (ms epoch), used by
// `listenForCloudChanges` to filter own-device snapshot echoes (B7-echo).
let _lastWriteTimestamp = 0;
// 5 seconds: comfortably wider than typical Firestore round-trip + clock skew
// but short enough not to swallow remote updates from a real second device.
const OWN_WRITE_ECHO_WINDOW_MS = 5000;

let _syncPassphrase = null;

/**
 * Imposta la passphrase crittografica per la sincronizzazione Zero-Knowledge.
 * La memorizza temporaneamente anche nel sessionStorage per persistere al refresh.
 */
export function setSyncPassphrase(passphrase) {
  _syncPassphrase = passphrase;
  if (passphrase) {
    sessionStorage.setItem("trasporti_sync_passphrase", passphrase);
  } else {
    sessionStorage.removeItem("trasporti_sync_passphrase");
  }
}

/**
 * Ottiene la passphrase crittografica attualmente memorizzata.
 */
export function getSyncPassphrase() {
  if (!_syncPassphrase) {
    _syncPassphrase = sessionStorage.getItem("trasporti_sync_passphrase");
  }
  return _syncPassphrase;
}


// ── Initialization ──────────────────────────────────────────────────────────

/**
 * Initialize Firebase with the project config.
 * Must be called after Firebase SDK scripts are loaded.
 */
export function initFirebase() {
  if (_app) return; // Already initialized

  const firebase = window.firebase;
  if (!firebase) {
    console.warn("[FirebaseSync] Firebase SDK not loaded yet.");
    return;
  }

  try {
    _app = firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("[FirebaseSync] Errore initializeApp:", e);
    return;
  }

  try {
    if (typeof firebase.auth === "function") {
      _auth = firebase.auth();
    } else {
      console.warn("[FirebaseSync] Firebase Auth SDK non caricato o bloccato.");
    }
  } catch (e) {
    console.error("[FirebaseSync] Errore inizializzazione Auth:", e);
  }

  try {
    if (typeof firebase.firestore === "function") {
      _db = firebase.firestore();
      
      // Enable offline persistence for Firestore
      _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === "failed-precondition") {
          console.warn("[FirebaseSync] Persistence failed: multiple tabs open.");
        } else if (err.code === "unimplemented") {
          console.warn("[FirebaseSync] Persistence not available in this browser.");
        }
      });
    } else {
      console.warn("[FirebaseSync] Firebase Firestore SDK non caricato o bloccato.");
    }
  } catch (e) {
    console.error("[FirebaseSync] Errore inizializzazione Firestore:", e);
  }

  // Listen for auth state changes
  if (_auth) {
    _auth.onAuthStateChanged(user => {
      _currentUser = user;
      if (!user) {
        setSyncPassphrase(null); // Clear the passphrase if the user is logged out or session expires
      }
      _onAuthChangeCallbacks.forEach(cb => {
        try { cb(user); } catch (e) { console.error("[FirebaseSync] Auth callback error:", e); }
      });
    });
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Sign in with Google popup.
 * @returns {Promise<object|null>} user object or null
 */
export async function signInWithGoogle() {
  if (!_auth) { initFirebase(); if (!_auth) return null; }
  
  // Ask the user to set a passphrase if none is currently configured
  let passphrase = getSyncPassphrase();
  if (!passphrase) {
    const wantEncrypt = confirm(
      "Sicurezza Sincronizzazione:\n\n" +
      "Desideri impostare una passphrase per crittografare i tuoi dati nel cloud prima dell'invio (Zero-Knowledge)?\n\n" +
      "[OK] Imposta passphrase ora (Consigliato per la massima privacy)\n" +
      "[Annulla] Procedi senza crittografia (i dati saranno salvati sul server non criptati)"
    );
    if (wantEncrypt) {
      const pwd = prompt("Inserisci una Passphrase di Sincronizzazione (almeno 4 caratteri) per proteggere i tuoi dati:");
      if (pwd === null) {
        return null; // Abort login flow entirely
      }
      const trimmed = pwd.trim();
      if (trimmed.length < 4) {
        alert("La passphrase inserita è troppo corta (minimo 4 caratteri). Accesso annullato.");
        return null; // Abort login flow entirely
      }
      setSyncPassphrase(trimmed);
    } else {
      if (!confirm("Sei sicuro di voler salvare le tue preferenze nel cloud in chiaro (non criptate)?")) {
        return null; // Abort login flow entirely
      }
    }
  }

  try {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    const result = await _auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") return null;
    console.error("[FirebaseSync] Sign-in error:", error);
    throw error;
  }
}

/**
 * Sign out.
 */
export async function signOut() {
  if (!_auth) return;
  await _auth.signOut();
  _currentUser = null;
  setSyncPassphrase(null); // Clear the passphrase upon explicit sign out
}

/**
 * Get the currently signed-in user.
 * @returns {object|null}
 */
export function getCurrentUser() {
  return _currentUser;
}

/**
 * Register a callback for auth state changes.
 * @param {Function} callback - receives (user) or (null)
 */
export function onAuthStateChanged(callback) {
  _onAuthChangeCallbacks.push(callback);
  // Immediately call with current state if already initialized
  if (_auth) callback(_currentUser);
}

// ── Firestore Sync ──────────────────────────────────────────────────────────

/**
 * Save the user's preference payload to Firestore.
 * Debounced to avoid excessive writes.
 * @param {object} payload - `{ settings, notifications }` (B16).
 *   For backwards compatibility, a bare settings object is also accepted
 *   and silently wrapped as `{ settings: payload }` so older callers do
 *   not regress while consumers are migrated.
 */
export function saveToCloud(payload) {
  if (!_currentUser || !_db) return;
  // Tolerate the legacy single-argument shape: callers that still pass
  // `state.settings` directly will keep working until they are migrated.
  const normalized = (payload && typeof payload === "object" &&
    ("settings" in payload || "notifications" in payload))
    ? {
        settings: payload.settings ?? null,
        notifications: payload.notifications ?? null
      }
    : { settings: payload ?? null, notifications: null };
  if (_syncTimer) clearTimeout(_syncTimer);
  window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "pending" } }));
  _syncTimer = setTimeout(() => _doSave(normalized), SYNC_DEBOUNCE_MS);
}

async function _doSave(payload) {
  if (!_currentUser || !_db) return;
  window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "syncing" } }));
  try {
    const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
    const passphrase = getSyncPassphrase();
    
    let dbPayload = {};
    if (passphrase) {
      // Zero-Knowledge Encryption path
      const cleanPayload = {
        settings: payload.settings,
        notifications: payload.notifications,
        schemaVersion: "1.0.0"
      };
      const encrypted = await encryptPayload(cleanPayload, passphrase);
      dbPayload = {
        encryptedPayload: encrypted.encryptedPayload,
        salt: encrypted.salt,
        iv: encrypted.iv,
        isEncrypted: true,
        // Nullify plain fields to delete any previous clear-text data
        settings: null,
        notifications: null
      };
    } else {
      // Plain path (legacy fallback)
      dbPayload = {
        settings: payload.settings,
        notifications: payload.notifications,
        isEncrypted: false
      };
    }
    
    await docRef.set({
      ...dbPayload,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      displayName: _currentUser.displayName || "",
      email: _currentUser.email || "",
      photoURL: null // Set to null to explicitly overwrite and delete any existing Google profile pictures on the server
    }, { merge: true });
    
    // Record the moment the write was acknowledged locally so the
    // snapshot listener can ignore the echo Firestore will deliver
    // back to this same client (B7-echo).
    _lastWriteTimestamp = Date.now();
    console.log("[FirebaseSync] Preferenze salvate nel cloud " + (passphrase ? "(CRIPTATE)" : "(IN CHIARO)") + ".");
    window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "synced" } }));
  } catch (error) {
    console.error("[FirebaseSync] Errore salvataggio cloud:", error);
    window.dispatchEvent(new CustomEvent("trasporti:sync-status", { detail: { status: "error" } }));
  }
}


/**
 * Load settings + notifications from Firestore for the current user.
 * @returns {Promise<{settings: object|null, notifications: object|null}|null>}
 *   `null` only when no document exists; otherwise an object with both keys
 *   (each may individually be `null` if the document predates the migration).
 */
export async function loadFromCloud() {
  if (!_currentUser || !_db) return null;
  try {
    const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      
      if (data.isEncrypted || data.encryptedPayload) {
        const passphrase = getSyncPassphrase();
        if (!passphrase) {
          console.warn("[FirebaseSync] Dati cloud cifrati ma nessuna passphrase locale impostata.");
          return { isEncrypted: true };
        }
        try {
          const decrypted = await decryptPayload(data.encryptedPayload, passphrase, data.salt, data.iv);
          console.log("[FirebaseSync] Preferenze caricate e DECIFRATE dal cloud.");
          return await migrateAndSanitize(decrypted, window._app_config?.CFG || {});
        } catch (e) {
          console.error("[FirebaseSync] Errore decrittografia in loadFromCloud:", e);
          throw new Error("passphrase_incorrect");
        }
      } else {
        // Plain legacy data loading
        const legacyPayload = {
          settings: data.settings ?? null,
          notifications: data.notifications ?? null,
          schemaVersion: data.schemaVersion || "0.0.0"
        };
        console.log("[FirebaseSync] Preferenze legacy caricate dal cloud.");
        return await migrateAndSanitize(legacyPayload, window._app_config?.CFG || {});
      }
    }
    return null;
  } catch (error) {
    console.error("[FirebaseSync] Errore caricamento cloud:", error);
    throw error;
  }
}


/**
 * Delete cloud data for the current user.
 */
export async function deleteCloudData() {
  if (!_currentUser || !_db) return;
  try {
    const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
    await docRef.delete();
    console.log("[FirebaseSync] Dati cloud eliminati.");
  } catch (error) {
    console.error("[FirebaseSync] Errore eliminazione cloud:", error);
  }
}

/**
 * Listen for real-time changes from cloud (other devices).
 * @param {Function} callback - receives `{ settings, notifications }` when
 *   the cloud document changes due to a remote write. Own-device echoes
 *   are filtered both by `metadata.hasPendingWrites` and by comparing
 *   `updatedAt` against `_lastWriteTimestamp` within a short window.
 * @returns {Function} unsubscribe function
 */
export function listenForCloudChanges(callback) {
  if (!_currentUser || !_db) return () => {};
  const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
  return docRef.onSnapshot(async doc => {
    if (!doc.exists) return;
    if (doc.metadata.hasPendingWrites !== false) return;
    const data = doc.data();
    
    // Own-write echo filter (B7-echo): Firestore replays our own committed
    // write back to us as a server-confirmed snapshot. Compare the doc's
    // `updatedAt` server timestamp against the last local write moment;
    // if they fall inside the echo window, drop the callback.
    const updatedAtMs = data?.updatedAt?.toMillis?.();
    if (
      typeof updatedAtMs === "number" &&
      _lastWriteTimestamp > 0 &&
      Math.abs(updatedAtMs - _lastWriteTimestamp) < OWN_WRITE_ECHO_WINDOW_MS
    ) {
      return;
    }
    
    if (data.isEncrypted || data.encryptedPayload) {
      const passphrase = getSyncPassphrase();
      if (!passphrase) {
        console.warn("[FirebaseSync] Modifiche cloud rilevate ma il sync è bloccato (manca passphrase locale).");
        window.dispatchEvent(new CustomEvent("trasporti:sync-locked"));
        return;
      }
      try {
        const decrypted = await decryptPayload(data.encryptedPayload, passphrase, data.salt, data.iv);
        const migrated = await migrateAndSanitize(decrypted, window._app_config?.CFG || {});
        callback(migrated);
      } catch (e) {
        console.error("[FirebaseSync] Rilevato errore decrittografia in ascolto modifiche cloud:", e);
        window.dispatchEvent(new CustomEvent("trasporti:sync-error-passphrase"));
      }
    } else {
      const legacyPayload = {
        settings: data.settings ?? null,
        notifications: data.notifications ?? null,
        schemaVersion: data.schemaVersion || "0.0.0"
      };
      const migrated = await migrateAndSanitize(legacyPayload, window._app_config?.CFG || {});
      callback(migrated);
    }
  }, error => {
    console.error("[FirebaseSync] Listener error:", error);
  });
}


// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if Firebase is initialized and ready.
 */
export function isFirebaseReady() {
  return !!_app && !!_auth && !!_db;
}

/**
 * Get sync status for UI display.
 */
export function getSyncStatus() {
  if (!_app) return { status: "not_initialized", label: "Non inizializzato" };
  if (!_currentUser) return { status: "signed_out", label: "Non connesso" };
  return { status: "connected", label: `Connesso come ${_currentUser.displayName || _currentUser.email}` };
}
