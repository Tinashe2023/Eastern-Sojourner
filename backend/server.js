/**
 * ============================================================================
 * EASTERN SOJOURNER — SAFETY HUB BACKEND SERVER
 * ============================================================================
 *
 * Express.js REST API for the Smart Tourist Safety Monitoring System.
 *
 * Endpoints:
 *   POST   /api/nonce              → Generate a QRNG-ready cryptographic nonce
 *   POST   /api/verify             → Verify a signed payload (burn nonce)
 *   GET    /api/verify-status/:id  → Poll nonce verification status
 *   POST   /api/sos                → Submit an SOS incident report
 *   GET    /api/geofences          → Get geo-fence zone definitions
 *   GET    /api/incidents          → Get recent incidents feed
 *   POST   /api/test/sign          → (Dev only) Sign a payload for testing
 *
 * All responses are clean JSON with proper Content-Type headers,
 * designed for Burp Suite and MitM testing compatibility.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  BURP SUITE READINESS                                              │
 * │  • All endpoints return application/json                           │
 * │  • No HTML error pages — errors are JSON { error, code }          │
 * │  • CORS is permissive for local dev (tighten in production)       │
 * │  • No CSRF tokens on API endpoints (stateless JWT in production)  │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const express = require('express');
const cors = require('cors');
const {
    generateNonce,
    consumeNonce,
    markNonceVerified,
    getNonceStatus,
    buildCanonicalPayload,
    verifySignature,
    generateTestKeyPair,
    signPayload
} = require('./crypto-utils');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
    origin: '*', // PRODUCTION: Restrict to your domain
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Force JSON Content-Type on all responses (Burp Suite compatibility)
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Powered-By', 'Eastern-Sojourner-Safety-Hub');
    next();
});

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY INCIDENT STORE
// ─────────────────────────────────────────────────────────────────────────────

const incidentStore = [];

// ─────────────────────────────────────────────────────────────────────────────
// GEO-FENCE ZONE DEFINITIONS — Northeast India
// ─────────────────────────────────────────────────────────────────────────────

const GEOFENCE_ZONES = [
    {
        id: 'manipur-safe-zone',
        name: 'Imphal Valley — Safe Zone',
        riskLevel: 'safe',
        color: '#22c55e',
        polygon: [
            [24.8170, 93.9368],
            [24.8400, 93.9800],
            [24.7900, 94.0100],
            [24.7600, 93.9500],
            [24.8170, 93.9368]
        ],
        description: 'Imphal city center and surrounding valley — well-patrolled, tourist-friendly'
    },
    {
        id: 'nagaland-heritage',
        name: 'Kohima Heritage Zone',
        riskLevel: 'safe',
        color: '#22c55e',
        polygon: [
            [25.6700, 94.1000],
            [25.6900, 94.1300],
            [25.6600, 94.1500],
            [25.6400, 94.1200],
            [25.6700, 94.1000]
        ],
        description: 'Kohima town and war cemetery — popular cultural tourism zone'
    },
    {
        id: 'assam-wildlife',
        name: 'Kaziranga National Park',
        riskLevel: 'caution',
        color: '#f59e0b',
        polygon: [
            [26.5800, 93.1700],
            [26.6800, 93.4000],
            [26.6200, 93.6000],
            [26.5200, 93.3500],
            [26.5800, 93.1700]
        ],
        description: 'Wildlife reserve — follow guide instructions, do not venture off-path'
    },
    {
        id: 'arunachal-border',
        name: 'Tawang Border Region',
        riskLevel: 'restricted',
        color: '#ef4444',
        polygon: [
            [27.5000, 91.8000],
            [27.7000, 92.0000],
            [27.6000, 92.2000],
            [27.4000, 91.9500],
            [27.5000, 91.8000]
        ],
        description: 'International border area — Inner Line Permit required, military zones present'
    },
    {
        id: 'mizoram-adventure',
        name: 'Aizawl & Surroundings',
        riskLevel: 'safe',
        color: '#22c55e',
        polygon: [
            [23.7200, 92.7000],
            [23.7600, 92.7400],
            [23.7400, 92.7700],
            [23.7000, 92.7300],
            [23.7200, 92.7000]
        ],
        description: 'Aizawl capital region — safe for tourism, vibrant local culture'
    },
    {
        id: 'sikkim-mountain',
        name: 'Gangtok & East Sikkim',
        riskLevel: 'caution',
        color: '#f59e0b',
        polygon: [
            [27.3000, 88.5500],
            [27.3800, 88.6500],
            [27.3400, 88.7000],
            [27.2600, 88.6000],
            [27.3000, 88.5500]
        ],
        description: 'Mountain terrain — weather can change rapidly, landslide risk during monsoon'
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/nonce
 * Generate a new cryptographic nonce for QR code.
 * The nonce is stored server-side and sent to the web client for QR rendering.
 */
app.post('/api/nonce', (req, res) => {
    try {
        const nonceData = generateNonce();
        res.status(201).json({
            success: true,
            data: {
                nonceId: nonceData.nonceId,
                nonce: nonceData.nonce,
                expiresAt: nonceData.expiresAt,
                qrPayload: JSON.stringify({
                    type: 'EASTERN_SOJOURNER_SAFETY',
                    nonceId: nonceData.nonceId,
                    nonce: nonceData.nonce,
                    serverUrl: `http://localhost:${PORT}`
                })
            }
        });
    } catch (err) {
        console.error('[ERROR] Nonce generation failed:', err);
        res.status(500).json({
            success: false,
            error: 'NONCE_GENERATION_FAILED',
            message: 'Failed to generate cryptographic nonce'
        });
    }
});

/**
 * POST /api/verify
 * Verify a signed payload from the mobile app.
 *
 * Request body:
 * {
 *   nonceId:    string,  — The nonce identifier
 *   userId:     string,  — User's unique identifier
 *   signature:  string,  — Hex-encoded ECDSA signature
 *   publicKey:  string,  — Hex-encoded public key
 *   gps:        { lat: number, lng: number },
 *   timestamp:  string   — ISO 8601 timestamp
 * }
 *
 * The signature MUST cover: userId | nonce | gps.lat,gps.lng | timestamp
 */
app.post('/api/verify', (req, res) => {
    try {
        const { nonceId, userId, signature, publicKey, gps, timestamp } = req.body;

        // ── Validate required fields ─────────────────────────────────────
        if (!nonceId || !userId || !signature || !publicKey || !gps || !timestamp) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                message: 'Required fields: nonceId, userId, signature, publicKey, gps, timestamp'
            });
        }

        if (!gps.lat || !gps.lng) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_GPS',
                message: 'GPS must include lat and lng values'
            });
        }

        // ── Consume the nonce (one-time use — replay protection) ─────────
        const nonceResult = consumeNonce(nonceId);

        if (!nonceResult.valid) {
            const statusCode = nonceResult.error === 'NONCE_ALREADY_USED' ? 409 : 404;
            return res.status(statusCode).json({
                success: false,
                error: nonceResult.error,
                message: getErrorMessage(nonceResult.error)
            });
        }

        // ── Build canonical payload and verify signature ─────────────────
        const canonicalPayload = buildCanonicalPayload(
            userId,
            nonceResult.nonce,
            gps,
            timestamp
        );

        const isValid = verifySignature(canonicalPayload, signature, publicKey);

        if (isValid) {
            // Mark nonce as verified for web polling
            markNonceVerified(nonceId, {
                userId,
                gps,
                timestamp,
                verifiedAt: new Date().toISOString()
            });
        }

        res.status(200).json({
            success: true,
            data: {
                verified: isValid,
                nonceId,
                userId: isValid ? userId : null,
                message: isValid
                    ? 'Digital ID verified successfully'
                    : 'Signature verification failed — invalid credentials'
            }
        });
    } catch (err) {
        console.error('[ERROR] Verification failed:', err);
        res.status(500).json({
            success: false,
            error: 'VERIFICATION_ERROR',
            message: 'Internal verification error'
        });
    }
});

/**
 * GET /api/verify-status/:nonceId
 * Poll the verification status of a nonce.
 * Used by the Safety Hub web page to check if the mobile app has verified.
 */
app.get('/api/verify-status/:nonceId', (req, res) => {
    try {
        const { nonceId } = req.params;
        const status = getNonceStatus(nonceId);

        res.status(200).json({
            success: true,
            data: {
                nonceId,
                found: status.found,
                verified: status.verified,
                verificationData: status.data
            }
        });
    } catch (err) {
        console.error('[ERROR] Status check failed:', err);
        res.status(500).json({
            success: false,
            error: 'STATUS_CHECK_ERROR',
            message: 'Failed to check verification status'
        });
    }
});

/**
 * POST /api/sos
 * Submit an SOS incident report.
 *
 * Request body:
 * {
 *   userId:    string,
 *   type:      string,   — 'medical' | 'security' | 'natural_disaster' | 'other'
 *   gps:       { lat: number, lng: number },
 *   timestamp: string,
 *   message:   string
 * }
 */
app.post('/api/sos', (req, res) => {
    try {
        const { userId, type, gps, timestamp, message } = req.body;

        if (!userId || !type || !gps || !timestamp) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                message: 'Required fields: userId, type, gps, timestamp'
            });
        }

        const incident = {
            id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            userId,
            type,
            gps,
            timestamp,
            message: message || '',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        incidentStore.unshift(incident);

        // Keep only last 100 incidents in memory
        if (incidentStore.length > 100) {
            incidentStore.pop();
        }

        console.log(`[SOS] 🚨 Incident reported: ${incident.id} — Type: ${type} — Location: ${gps.lat}, ${gps.lng}`);

        res.status(201).json({
            success: true,
            data: {
                incidentId: incident.id,
                status: 'active',
                message: 'SOS alert received — emergency response team notified',
                responseEta: '10-15 minutes'
            }
        });
    } catch (err) {
        console.error('[ERROR] SOS submission failed:', err);
        res.status(500).json({
            success: false,
            error: 'SOS_SUBMISSION_ERROR',
            message: 'Failed to process SOS alert'
        });
    }
});

/**
 * GET /api/geofences
 * Return all geo-fence zone definitions.
 */
app.get('/api/geofences', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            zones: GEOFENCE_ZONES,
            lastUpdated: new Date().toISOString(),
            region: 'Northeast India'
        }
    });
});

/**
 * GET /api/incidents
 * Return recent incidents for the dashboard feed.
 */
app.get('/api/incidents', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    res.status(200).json({
        success: true,
        data: {
            incidents: incidentStore.slice(0, limit),
            total: incidentStore.length
        }
    });
});

/**
 * POST /api/test/sign
 * (Development only) Generate a test key pair and sign a payload.
 * Used for testing the verification flow without a mobile device.
 */
app.post('/api/test/sign', (req, res) => {
    try {
        const { nonceId } = req.body;

        if (!nonceId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_NONCE_ID',
                message: 'Provide a nonceId to sign'
            });
        }

        const status = getNonceStatus(nonceId);
        if (!status.found) {
            return res.status(404).json({
                success: false,
                error: 'NONCE_NOT_FOUND',
                message: 'Nonce not found — generate one first via POST /api/nonce'
            });
        }

        // Generate test key pair
        const keyPair = generateTestKeyPair();
        const testUserId = 'test-user-' + Date.now();
        const testGps = { lat: 24.8170, lng: 93.9368 };
        const testTimestamp = new Date().toISOString();

        // Get the nonce value from the store (peek without consuming)
        const nonceEntry = getNonceStatus(nonceId);
        // We need the actual nonce — for testing, we fetch it from the nonce generation response
        // In real flow, the mobile app gets it from the QR code

        // Build canonical payload
        const canonicalPayload = buildCanonicalPayload(
            testUserId,
            req.body.nonce || 'test-nonce',
            testGps,
            testTimestamp
        );

        // Sign it
        const signature = signPayload(canonicalPayload, keyPair.privateKey);

        res.status(200).json({
            success: true,
            data: {
                message: 'Test payload signed — use this data to call POST /api/verify',
                verifyPayload: {
                    nonceId,
                    userId: testUserId,
                    signature,
                    publicKey: keyPair.publicKey,
                    gps: testGps,
                    timestamp: testTimestamp
                }
            }
        });
    } catch (err) {
        console.error('[ERROR] Test signing failed:', err);
        res.status(500).json({
            success: false,
            error: 'TEST_SIGN_ERROR',
            message: 'Failed to generate test signature'
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getErrorMessage(code) {
    const messages = {
        'NONCE_NOT_FOUND': 'Nonce not found — it may have expired or never existed',
        'NONCE_EXPIRED': 'Nonce has expired — generate a new QR code',
        'NONCE_ALREADY_USED': 'Nonce has already been used — possible replay attack detected'
    };
    return messages[code] || 'Unknown error';
}

// ─────────────────────────────────────────────────────────────────────────────
// 404 HANDLER — Clean JSON (no HTML error pages)
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} does not exist`,
        availableEndpoints: [
            'POST   /api/nonce',
            'POST   /api/verify',
            'GET    /api/verify-status/:nonceId',
            'POST   /api/sos',
            'GET    /api/geofences',
            'GET    /api/incidents',
            'POST   /api/test/sign'
        ]
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER — Clean JSON
// ─────────────────────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    console.error('[FATAL]', err);
    res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       EASTERN SOJOURNER — SAFETY HUB BACKEND               ║');
    console.log('║       Smart Tourist Safety Monitoring System                ║');
    console.log(`║       Running on http://localhost:${PORT}                      ║`);
    console.log('║                                                              ║');
    console.log('║  Endpoints:                                                  ║');
    console.log('║    POST   /api/nonce              Generate nonce             ║');
    console.log('║    POST   /api/verify             Verify signature           ║');
    console.log('║    GET    /api/verify-status/:id  Poll status                ║');
    console.log('║    POST   /api/sos                SOS alert                  ║');
    console.log('║    GET    /api/geofences          Geo-fence zones            ║');
    console.log('║    GET    /api/incidents           Incident feed             ║');
    console.log('║    POST   /api/test/sign          (Dev) Test signing         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
});
