// =============================================================================
// crypto-utils.js – Utility Crittografiche Zero-Knowledge per Client PWA
// =============================================================================
// Implementa la cifratura locale AES-256-GCM con derivazione chiavi PBKDF2
// usando esclusivamente le Web Crypto API native del browser.
// =============================================================================

/**
 * Converte un ArrayBuffer in una stringa esadecimale (Hex).
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
function arrayBufferToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

/**
 * Converte una stringa esadecimale (Hex) in un ArrayBuffer.
 * @param {string} hexString 
 * @returns {ArrayBuffer}
 */
function hexToArrayBuffer(hexString) {
  if (hexString.length % 2 !== 0) {
    throw new Error("[Crypto] Stringa hex non valida (lunghezza dispari).");
  }
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return result.buffer;
}

/**
 * Deriva una CryptoKey simmetrica a partire dalla password dell'utente e da un salt.
 * PBKDF2 con SHA-256, 100.000 iterazioni (standard industriale).
 * @param {string} passphrase 
 * @param {ArrayBuffer} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(passphrase);
  
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Cifra un payload JSON arbitrario usando AES-256-GCM.
 * Genera salt e IV in modo pseudo-casuale crittograficamente sicuro sul client.
 * @param {object} payload - L'oggetto da cifrare.
 * @param {string} passphrase - La password segreta dell'utente.
 * @returns {Promise<{ encryptedPayload: string, salt: string, iv: string }>}
 */
export async function encryptPayload(payload, passphrase) {
  if (!passphrase) {
    throw new Error("[Crypto] Passphrase di sincronizzazione mancante.");
  }
  const encoder = new TextEncoder();
  const plainData = encoder.encode(JSON.stringify(payload));
  
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passphrase, salt.buffer);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    plainData
  );
  
  return {
    encryptedPayload: arrayBufferToHex(encrypted),
    salt: arrayBufferToHex(salt.buffer),
    iv: arrayBufferToHex(iv.buffer)
  };
}

/**
 * Decifra un payload stringa Hex utilizzando AES-256-GCM e la passphrase.
 * @param {string} encryptedHex - I dati cifrati in formato hex.
 * @param {string} passphrase - La password segreta dell'utente.
 * @param {string} saltHex - Il salt esadecimale originale.
 * @param {string} ivHex - L'IV esadecimale originale.
 * @returns {Promise<object>} Il payload originale decifrato e decodificato.
 */
export async function decryptPayload(encryptedHex, passphrase, saltHex, ivHex) {
  if (!passphrase) {
    throw new Error("[Crypto] Passphrase di sincronizzazione mancante.");
  }
  const salt = hexToArrayBuffer(saltHex);
  const iv = hexToArrayBuffer(ivHex);
  const encrypted = hexToArrayBuffer(encryptedHex);
  
  const key = await deriveKey(passphrase, salt);
  
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv)
    },
    key,
    new Uint8Array(encrypted)
  );
  
  const decoder = new TextDecoder();
  const plainText = decoder.decode(decrypted);
  return JSON.parse(plainText);
}
