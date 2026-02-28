/**
 * ============================================================================
 * EASTERN SOJOURNER AUTH — CRYPTOGRAPHIC UTILITIES
 * ============================================================================
 *
 * Key pair generation, payload signing, and key storage for the mobile app.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  POST-QUANTUM CRYPTOGRAPHY (PQC) — ARCHITECTURAL PLACEHOLDER          ║
 * ║                                                                        ║
 * ║  CURRENT IMPLEMENTATION: ECDSA with secp256k1/P-256                   ║
 * ║  FUTURE IMPLEMENTATION:  ML-DSA (CRYSTALS-Dilithium, NIST FIPS 204)   ║
 * ║                                                                        ║
 * ║  HYBRID SIGNING ARCHITECTURE (Future):                                ║
 * ║  ─────────────────────────────────────────────────────────────────     ║
 * ║  When ML-DSA libraries are available for React Native, the signing     ║
 * ║  flow will produce TWO signatures per payload:                        ║
 * ║                                                                        ║
 * ║    signedPayload = {                                                   ║
 * ║      payload: "userId|nonce|gps|timestamp",                           ║
 * ║      signatures: {                                                     ║
 * ║        ecdsa: ecdsaSign(payload, ecdsaPrivKey),    // Classical       ║
 * ║        mldsa: mldsaSign(payload, mldsaPrivKey)     // Post-Quantum    ║
 * ║      },                                                                ║
 * ║      publicKeys: {                                                     ║
 * ║        ecdsa: ecdsaPubKey,                                            ║
 * ║        mldsa: mldsaPubKey                                             ║
 * ║      }                                                                 ║
 * ║    }                                                                   ║
 * ║                                                                        ║
 * ║  The server verifies BOTH signatures. During migration, either one    ║
 * ║  passing is sufficient (hybrid mode). Post-migration, both must pass  ║
 * ║  (strict mode).                                                        ║
 * ║                                                                        ║
 * ║  KEY STORAGE (Future):                                                ║
 * ║  ECDSA keys → Device Secure Enclave (hardware-backed)                 ║
 * ║  ML-DSA keys → Secure Enclave when supported, else encrypted storage ║
 * ║                                                                        ║
 * ║  MIGRATION PATH:                                                       ║
 * ║  1. v1.0 (current): ECDSA-only signing                               ║
 * ║  2. v2.0: Hybrid ECDSA + ML-DSA signing                              ║
 * ║  3. v3.0: ML-DSA-only signing (when ECDSA deprecated)                ║
 * ║                                                                        ║
 * ║  Reference: NIST FIPS 204 — Module-Lattice-Based Digital Signature    ║
 * ║  https://csrc.nist.gov/pubs/fips/204/final                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// NOTE: Polyfills (react-native-get-random-values, Buffer) are loaded
// globally in App.js BEFORE this module is imported.

import * as SecureStore from 'expo-secure-store';
import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

// Initialize ECDSA with P-256 curve
const ecInstance = new EC('p256');

// Secure Store keys
const PRIVATE_KEY_STORE = 'es_auth_private_key';
const PUBLIC_KEY_STORE = 'es_auth_public_key';
const USER_ID_STORE = 'es_auth_user_id';

/**
 * Generate or retrieve the ECDSA key pair.
 *
 * Keys are stored in the device's Secure Store (backed by Keychain on iOS,
 * Keystore on Android — hardware-backed when available).
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  SECURE ENCLAVE INTEGRATION (Production Enhancement)              ║
 * ║                                                                    ║
 * ║  For maximum security, generate keys INSIDE the Secure Enclave:   ║
 * ║                                                                    ║
 * ║  iOS: Use SecKeyCreateRandomKey with kSecAttrTokenIDSecureEnclave ║
 * ║  Android: Use KeyGenParameterSpec.Builder.setIsStrongBoxBacked()  ║
 * ║                                                                    ║
 * ║  This ensures the private key NEVER leaves the hardware module.   ║
 * ║  Current implementation stores the key in software-encrypted      ║
 * ║  secure storage, which is sufficient for demo purposes.           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @returns {Promise<{ privateKey: string, publicKey: string }>}
 */
export async function getOrCreateKeyPair() {
    try {
        // Check if keys already exist
        const existingPrivKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORE);
        const existingPubKey = await SecureStore.getItemAsync(PUBLIC_KEY_STORE);

        if (existingPrivKey && existingPubKey) {
            return { privateKey: existingPrivKey, publicKey: existingPubKey };
        }

        // Generate new key pair
        const keyPair = ecInstance.genKeyPair();
        const privateKey = keyPair.getPrivate('hex');
        const publicKey = keyPair.getPublic('hex');

        // Store in Secure Store
        await SecureStore.setItemAsync(PRIVATE_KEY_STORE, privateKey);
        await SecureStore.setItemAsync(PUBLIC_KEY_STORE, publicKey);

        // Generate a User ID
        const userId = 'ES-' + Date.now().toString(36).toUpperCase() + '-' +
            Math.random().toString(36).substr(2, 6).toUpperCase();
        await SecureStore.setItemAsync(USER_ID_STORE, userId);

        console.log('[CRYPTO] New key pair generated and stored in Secure Store');
        return { privateKey, publicKey };
    } catch (err) {
        console.error('[CRYPTO] Key generation failed:', err);
        throw new Error('Failed to generate cryptographic keys');
    }
}

/**
 * Get the stored user ID.
 * @returns {Promise<string>}
 */
export async function getUserId() {
    let userId = await SecureStore.getItemAsync(USER_ID_STORE);
    if (!userId) {
        userId = 'ES-' + Date.now().toString(36).toUpperCase() + '-' +
            Math.random().toString(36).substr(2, 6).toUpperCase();
        await SecureStore.setItemAsync(USER_ID_STORE, userId);
    }
    return userId;
}

/**
 * Build the canonical payload string for signing.
 * The signature MUST cover the full payload for integrity.
 *
 * @param {string} userId
 * @param {string} nonce
 * @param {{ lat: number, lng: number }} gps
 * @param {string} timestamp
 * @returns {string}
 */
export function buildCanonicalPayload(userId, nonce, gps, timestamp) {
    return `${userId}|${nonce}|${gps.lat},${gps.lng}|${timestamp}`;
}

/**
 * Sign a payload with the device's private key.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PQC HYBRID SIGNING — FUTURE IMPLEMENTATION                      ║
 * ║                                                                    ║
 * ║  async function signPayloadHybrid(payload, ecdsaPrivKey, mldsaKey) ║
 * ║  {                                                                 ║
 * ║    const ecdsaSig = signECDSA(payload, ecdsaPrivKey);             ║
 * ║    const mldsaSig = signMLDSA(payload, mldsaKey);                 ║
 * ║    return {                                                        ║
 * ║      ecdsa: ecdsaSig,                                             ║
 * ║      mldsa: mldsaSig  // ML-DSA (Dilithium) signature            ║
 * ║    };                                                              ║
 * ║  }                                                                 ║
 * ║                                                                    ║
 * ║  function signMLDSA(payload, privateKey) {                        ║
 * ║    // const dilithium = require('pqc-dilithium');                 ║
 * ║    // return dilithium.sign(payload, privateKey);                 ║
 * ║    throw new Error('ML-DSA not yet available for React Native');  ║
 * ║  }                                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @param {string} payload — The canonical payload string
 * @param {string} privateKeyHex — Hex-encoded private key
 * @returns {string} Hex-encoded DER signature
 */
export function signPayload(payload, privateKeyHex) {
    try {
        // SHA-256 hash of the payload (pure JS — React Native compatible)
        const msgHash = sha256(payload);

        // Sign with ECDSA
        const key = ecInstance.keyFromPrivate(privateKeyHex, 'hex');
        const signature = key.sign(msgHash);

        return signature.toDER('hex');
    } catch (err) {
        console.error('[CRYPTO] Signing failed:', err);
        throw new Error('Failed to sign payload');
    }
}

/**
 * Delete all stored keys (for testing/reset).
 */
export async function clearKeys() {
    await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE);
    await SecureStore.deleteItemAsync(PUBLIC_KEY_STORE);
    await SecureStore.deleteItemAsync(USER_ID_STORE);
    console.log('[CRYPTO] All keys cleared from Secure Store');
}
