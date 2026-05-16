// =============================================================================
// firebase-sync.js – Cloud sync via Firebase Auth + Firestore
// =============================================================================
// Provides Google sign-in and bidirectional sync of user preferences.
// Compatible with GitHub Pages (no backend required).
// Uses Firebase Modular SDK via CDN (imported in index.html).
// =============================================================================

const FIRESTORE_COLLECTION = "users";
const SYNC_DEBOUNCE_MS = 2000;

let _app = null;
let _auth = null;
let _db = null;
let _currentUser = null;
let _syncTimer = null;
let _onAuthChangeCallbacks = [];

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

  const firebaseConfig = {
    apiKey: "AIzaSyDhDzZ0syW0MZXdOhrLKVJ8UPCHkVC7G30",
    authDomain: "trasporti-busto-proj.firebaseapp.com",
    projectId: "trasporti-busto-proj",
    storageBucket: "trasporti-busto-proj.firebasestorage.app",
    messagingSenderId: "1061930969785",
    appId: "1:1061930969785:web:d391bb0cac468b76fc0968",
    measurementId: "G-VKYKDRZ0YQ"
  };

  _app = firebase.initializeApp(firebaseConfig);
  _auth = firebase.auth();
  _db = firebase.firestore();

  // Enable offline persistence for Firestore
  _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === "failed-precondition") {
      console.warn("[FirebaseSync] Persistence failed: multiple tabs open.");
    } else if (err.code === "unimplemented") {
      console.warn("[FirebaseSync] Persistence not available in this browser.");
    }
  });

  // Listen for auth state changes
  _auth.onAuthStateChanged(user => {
    _currentUser = user;
    _onAuthChangeCallbacks.forEach(cb => {
      try { cb(user); } catch (e) { console.error("[FirebaseSync] Auth callback error:", e); }
    });
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Sign in with Google popup.
 * @returns {Promise<object|null>} user object or null
 */
export async function signInWithGoogle() {
  if (!_auth) { initFirebase(); if (!_auth) return null; }
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
 * Save settings to Firestore for the current user.
 * Debounced to avoid excessive writes.
 * @param {object} settings - the full settings object
 */
export function saveToCloud(settings) {
  if (!_currentUser || !_db) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => _doSave(settings), SYNC_DEBOUNCE_MS);
}

async function _doSave(settings) {
  if (!_currentUser || !_db) return;
  try {
    const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
    await docRef.set({
      settings: settings,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      displayName: _currentUser.displayName || "",
      email: _currentUser.email || "",
      photoURL: _currentUser.photoURL || ""
    }, { merge: true });
    console.log("[FirebaseSync] Preferenze salvate nel cloud.");
  } catch (error) {
    console.error("[FirebaseSync] Errore salvataggio cloud:", error);
  }
}

/**
 * Load settings from Firestore for the current user.
 * @returns {Promise<object|null>} settings object or null if not found
 */
export async function loadFromCloud() {
  if (!_currentUser || !_db) return null;
  try {
    const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      console.log("[FirebaseSync] Preferenze caricate dal cloud.");
      return data.settings || null;
    }
    return null;
  } catch (error) {
    console.error("[FirebaseSync] Errore caricamento cloud:", error);
    return null;
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
 * @param {Function} callback - receives (settings) when cloud data changes
 * @returns {Function} unsubscribe function
 */
export function listenForCloudChanges(callback) {
  if (!_currentUser || !_db) return () => {};
  const docRef = _db.collection(FIRESTORE_COLLECTION).doc(_currentUser.uid);
  return docRef.onSnapshot(doc => {
    if (doc.exists && doc.metadata.hasPendingWrites === false) {
      // Only trigger for server-confirmed changes (not local writes)
      const data = doc.data();
      if (data.settings) {
        callback(data.settings);
      }
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
