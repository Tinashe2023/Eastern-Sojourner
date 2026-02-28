/**
 * ============================================================================
 * EASTERN SOJOURNER — SAFETY HUB CRYPTOGRAPHIC UTILITIES
 * ============================================================================
 *
 * This module provides all cryptographic primitives for the Safety Hub backend:
 *   1. Nonce generation (with QRNG placeholder)
 *   2. ECDSA P-256 signature verification
 *   3. Nonce lifecycle management (create → use → burn)
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  POST-QUANTUM CRYPTOGRAPHY (PQC) — ARCHITECTURAL PLACEHOLDER          ║
 * ║                                                                        ║
 * ║  Current: ECDSA (secp256k1 / P-256) — NIST-approved, widely deployed  ║
 * ║  Future:  ML-DSA (CRYSTALS-Dilithium) — NIST FIPS 204                 ║
 * ║                                                                        ║
 * ║  When PQC libraries mature for Node.js (e.g. liboqs-node), swap the   ║
 * ║  verifySignature() function to use ML-DSA verification. The hybrid     ║
 * ║  approach would verify BOTH classical ECDSA AND ML-DSA signatures,    ║
 * ║  rejecting the payload only if both fail. This ensures backward        ║
 * ║  compatibility while adding quantum resistance.                        ║
 * ║                                                                        ║
 * ║  Reference: NIST Post-Quantum Cryptography Standardization            ║
 * ║  https://csrc.nist.gov/projects/post-quantum-cryptography             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const EC = require('elliptic').ec;

// Initialize ECDSA with P-256 curve (also called prime256v1 / secp256r1)
const ec = new EC('p256');

// ─────────────────────────────────────────────────────────────────────────────
// NONCE STORE — In-memory store with TTL and one-time-use enforcement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory nonce store.
 * Structure: Map<nonceId, { nonce: string, createdAt: number, expiresAt: number, used: boolean, verified: boolean, verificationData: object|null }>
 *
 * PRODUCTION NOTE: Replace with Redis or a database-backed store for
 * horizontal scaling and persistence across restarts.
 */
const nonceStore = new Map();

/** Nonce TTL in milliseconds (5 minutes) */
const NONCE_TTL_MS = 5 * 60 * 1000;

/** Cleanup interval — purge expired nonces every 60 seconds */
setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of nonceStore.entries()) {
        if (now > entry.expiresAt) {
            nonceStore.delete(id);
        }
    }
}, 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// QRNG-READY NONCE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure nonce.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  QUANTUM RANDOM NUMBER GENERATION (QRNG) — PLACEHOLDER                ║
 * ║                                                                        ║
 * ║  Current implementation uses Node.js crypto.randomBytes(), which is    ║
 * ║  backed by the OS CSPRNG (e.g., /dev/urandom on Linux, BCryptGenRandom║
 * ║  on Windows). This provides 256 bits of entropy.                      ║
 * ║                                                                        ║
 * ║  For maximum entropy (true randomness from quantum phenomena), swap   ║
 * ║  the random source below with a QRNG provider:                        ║
 * ║                                                                        ║
 * ║  Option A — Hardware QRNG (ID Quantique Quantis):                     ║
 * ║    const qrng = require('idq-quantis');                               ║
 * ║    const randomBytes = qrng.getRandomBytes(32);                       ║
 * ║                                                                        ║
 * ║  Option B — Cloud QRNG API (ANU Quantum Random Numbers):             ║
 * ║    const response = await fetch('https://qrng.anu.edu.au/API/...);   ║
 * ║    const randomBytes = Buffer.from(response.data, 'hex');             ║
 * ║                                                                        ║
 * ║  Option C — NIST Randomness Beacon:                                   ║
 * ║    const beacon = await fetch('https://beacon.nist.gov/...);          ║
 * ║    // XOR beacon output with local CSPRNG for defense-in-depth        ║
 * ║                                                                        ║
 * ║  The function signature remains the same — only the entropy source    ║
 * ║  changes. No downstream code modifications required.                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @returns {{ nonceId: string, nonce: string, expiresAt: number }}
 */
function generateNonce() {
    const nonceId = uuidv4();

    // ── QRNG SWAP POINT ────────────────────────────────────────────────
    // Replace the line below with your QRNG source.
    // The output must be a 32-byte Buffer (256 bits of entropy).
    const nonceBuffer = crypto.randomBytes(32);
    // ── END QRNG SWAP POINT ────────────────────────────────────────────

    const nonce = nonceBuffer.toString('hex');
    const now = Date.now();
    const expiresAt = now + NONCE_TTL_MS;

    nonceStore.set(nonceId, {
        nonce,
        createdAt: now,
        expiresAt,
        used: false,
        verified: false,
        verificationData: null
    });

    return { nonceId, nonce, expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// NONCE LIFECYCLE — VALIDATION & BURN-AFTER-USE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and consume a nonce (one-time use).
 * This is the core replay-protection mechanism.
 *
 * @param {string} nonceId
 * @returns {{ valid: boolean, nonce: string|null, error: string|null }}
 */
function consumeNonce(nonceId) {
    const entry = nonceStore.get(nonceId);

    if (!entry) {
        return { valid: false, nonce: null, error: 'NONCE_NOT_FOUND' };
    }

    if (Date.now() > entry.expiresAt) {
        nonceStore.delete(nonceId);
        return { valid: false, nonce: null, error: 'NONCE_EXPIRED' };
    }

    if (entry.used) {
        // ──────────────────────────────────────────────────────────────────
        // REPLAY ATTACK DETECTED: This nonce has already been consumed.
        // An attacker may be attempting to replay a previously captured
        // signed payload. Log this event for security monitoring.
        // ──────────────────────────────────────────────────────────────────
        console.warn(`[SECURITY] Replay attack detected for nonceId: ${nonceId}`);
        return { valid: false, nonce: null, error: 'NONCE_ALREADY_USED' };
    }

    // ── BURN THE NONCE ──────────────────────────────────────────────────
    // Mark as used IMMEDIATELY to prevent race conditions in concurrent
    // verification attempts.
    entry.used = true;

    return { valid: true, nonce: entry.nonce, error: null };
}

/**
 * Mark a nonce as verified and store verification data.
 * Used by the web polling endpoint to communicate status.
 *
 * @param {string} nonceId
 * @param {object} verificationData
 */
function markNonceVerified(nonceId, verificationData) {
    const entry = nonceStore.get(nonceId);
    if (entry) {
        entry.verified = true;
        entry.verificationData = verificationData;
    }
}

/**
 * Get the verification status of a nonce.
 * Used by the Safety Hub web page to poll for verification results.
 *
 * @param {string} nonceId
 * @returns {{ found: boolean, verified: boolean, data: object|null }}
 */
function getNonceStatus(nonceId) {
    const entry = nonceStore.get(nonceId);
    if (!entry) {
        return { found: false, verified: false, data: null };
    }
    return {
        found: true,
        verified: entry.verified,
        data: entry.verificationData
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ECDSA SIGNATURE VERIFICATION (+ PQC PLACEHOLDER)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construct the canonical payload string for signing/verification.
 * The signature MUST cover the entire payload to ensure integrity.
 *
 * @param {string} userId
 * @param {string} nonce
 * @param {{ lat: number, lng: number }} gps
 * @param {string} timestamp
 * @returns {string} Canonical payload string
 */
function buildCanonicalPayload(userId, nonce, gps, timestamp) {
    // Deterministic serialization — sorted keys, no whitespace
    return `${userId}|${nonce}|${gps.lat},${gps.lng}|${timestamp}`;
}

/**
 * Verify an ECDSA signature against the canonical payload.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PQC HYBRID VERIFICATION — FUTURE ARCHITECTURE                        ║
 * ║                                                                        ║
 * ║  When ML-DSA (CRYSTALS-Dilithium) is available:                       ║
 * ║                                                                        ║
 * ║  function verifySignature(payload, signatures, publicKeys) {          ║
 * ║    const ecdsaValid = verifyECDSA(payload, signatures.ecdsa,          ║
 * ║                                   publicKeys.ecdsa);                  ║
 * ║    const mldsa_valid = verifyMLDSA(payload, signatures.mldsa,         ║
 * ║                                    publicKeys.mldsa);                 ║
 * ║                                                                        ║
 * ║    // Hybrid mode: Accept if EITHER passes (migration period)         ║
 * ║    // Strict mode: Require BOTH to pass (post-migration)              ║
 * ║    return ecdsaValid || mldsa_valid;  // hybrid                       ║
 * ║    // return ecdsaValid && mldsa_valid; // strict                     ║
 * ║  }                                                                     ║
 * ║                                                                        ║
 * ║  ML-DSA signature verification (placeholder):                         ║
 * ║  function verifyMLDSA(payload, signature, publicKey) {                ║
 * ║    // const dilithium = require('liboqs-node').Dilithium;             ║
 * ║    // return dilithium.verify(payload, signature, publicKey);         ║
 * ║    throw new Error('ML-DSA not yet implemented');                     ║
 * ║  }                                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @param {string} payload — The canonical payload string
 * @param {string} signature — Hex-encoded DER signature
 * @param {string} publicKeyHex — Hex-encoded uncompressed public key
 * @returns {boolean}
 */
function verifySignature(payload, signature, publicKeyHex) {
    try {
        // Hash the payload with SHA-256
        const msgHash = crypto.createHash('sha256').update(payload).digest('hex');

        // Import the public key
        const key = ec.keyFromPublic(publicKeyHex, 'hex');

        // Verify the ECDSA signature
        return key.verify(msgHash, signature);
    } catch (err) {
        console.error('[CRYPTO] Signature verification failed:', err.message);
        return false;
    }
}

/**
 * Generate a demo ECDSA key pair (for testing purposes).
 * In production, keys are generated and stored on the mobile device's Secure Enclave.
 *
 * @returns {{ privateKey: string, publicKey: string }}
 */
function generateTestKeyPair() {
    const key = ec.genKeyPair();
    return {
        privateKey: key.getPrivate('hex'),
        publicKey: key.getPublic('hex')
    };
}

/**
 * Sign a payload with a private key (for testing purposes).
 *
 * @param {string} payload
 * @param {string} privateKeyHex
 * @returns {string} Hex-encoded DER signature
 */
function signPayload(payload, privateKeyHex) {
    const msgHash = crypto.createHash('sha256').update(payload).digest('hex');
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');
    const signature = key.sign(msgHash);
    return signature.toDER('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    generateNonce,
    consumeNonce,
    markNonceVerified,
    getNonceStatus,
    buildCanonicalPayload,
    verifySignature,
    generateTestKeyPair,
    signPayload
};
