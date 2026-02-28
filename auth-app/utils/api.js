/**
 * ============================================================================
 * EASTERN SOJOURNER AUTH — API CLIENT
 * ============================================================================
 *
 * Communicates with the Safety Hub backend server.
 */

// ── Configure the backend URL ──────────────────────────────────────────────
// In production, this would be your deployed server URL.
// For local development, use your machine's local IP (not localhost)
// so the Expo app on a physical device can reach it.
const API_BASE = 'https://eastern-sojourner.onrender.com';

/**
 * POST the signed verification payload to the backend.
 *
 * @param {object} payload
 * @param {string} payload.nonceId   — The nonce identifier from the QR code
 * @param {string} payload.userId    — User's unique identifier
 * @param {string} payload.signature — Hex-encoded ECDSA signature
 * @param {string} payload.publicKey — Hex-encoded public key
 * @param {{ lat: number, lng: number }} payload.gps — GPS coordinates
 * @param {string} payload.timestamp — ISO 8601 timestamp
 * @returns {Promise<object>} Server response
 */
export async function postVerification(payload) {
    try {
        const response = await fetch(`${API_BASE}/api/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        return result;
    } catch (err) {
        console.error('[API] Verification POST failed:', err);
        throw new Error('Failed to connect to Safety Hub server. Ensure the backend is running.');
    }
}

/**
 * Submit an SOS incident report.
 *
 * @param {object} incident
 * @returns {Promise<object>}
 */
export async function postSOS(incident) {
    try {
        const response = await fetch(`${API_BASE}/api/sos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incident),
        });
        return await response.json();
    } catch (err) {
        console.error('[API] SOS POST failed:', err);
        throw new Error('Failed to send SOS alert');
    }
}

export { API_BASE };
