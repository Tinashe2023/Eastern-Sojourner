# SECURITY RESEARCH — Smart Tourist Safety Monitoring & Incident Response System

**Project**: Eastern Sojourner Safety Hub  
**Author**: Tinashe Hando  
**Architecture**: AI-Powered Safety • Geo-Fencing • Blockchain Digital ID  
**Cryptographic Framework**: ECDSA P-256 (current) + ML-DSA / CRYSTALS-Dilithium (PQC-ready)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Threat Model](#2-threat-model)
3. [Classical Attack Resistance](#3-classical-attack-resistance)
4. [Post-Quantum Cryptography Readiness](#4-post-quantum-cryptography-readiness)
5. [QRNG Architecture](#5-qrng-architecture)
6. [Biometric Security Model](#6-biometric-security-model)
7. [Burp Suite Testing Guide](#7-burp-suite-testing-guide)
8. [Vulnerability Testing Architecture](#8-vulnerability-testing-architecture)
9. [References](#9-references)

---

## 1. System Overview

The Safety Hub ecosystem consists of three components:

| Component | Role | Crypto Operations |
|---|---|---|
| **Safety Hub (Web)** | Generates QR codes, displays dashboard | Nonce generation, status polling |
| **Node.js Backend** | Issues nonces, verifies signatures | QRNG nonce gen, ECDSA verification, nonce lifecycle |
| **Auth App (Mobile)** | Biometric gate, QR scan, payload signing | ECDSA key generation, payload signing |

### Authentication Flow

```
Web (Safety Hub)          Backend Server          Mobile (Auth App)
     │                         │                         │
     │── POST /api/nonce ─────▶│                         │
     │◀── { nonceId, nonce } ──│                         │
     │                         │                         │
     │  [Render QR Code]       │                         │
     │                         │                         │
     │                         │       [User Scans QR]   │
     │                         │                         │
     │                         │   [Biometric Gate ✓]    │
     │                         │                         │
     │                         │   [Build payload]       │
     │                         │   userId|nonce|gps|time │
     │                         │                         │
     │                         │   [ECDSA Sign]          │
     │                         │                         │
     │                         │◀── POST /api/verify ────│
     │                         │    { nonceId, userId,   │
     │                         │      signature, pubKey, │
     │                         │      gps, timestamp }   │
     │                         │                         │
     │                         │── [Verify Signature] ──▶│
     │                         │── [Burn Nonce] ────────▶│
     │                         │                         │
     │── GET /verify-status ──▶│                         │
     │◀── { verified: true } ──│                         │
     │                         │                         │
     │  [Show Dashboard]       │                         │
```

---

## 2. Threat Model

### 2.1 Adversary Capabilities

| Adversary | Capability | Threat |
|---|---|---|
| **Network Eavesdropper** | Passive interception of HTTP traffic | Read nonces, signatures, and payloads |
| **Active MitM** | Modify traffic in transit (Burp Suite proxy) | Alter GPS, timestamp, or replay payloads |
| **Replay Attacker** | Capture and re-send previously valid payloads | Impersonate verified tourist |
| **Rogue Device** | Compromised mobile device | Extract private keys from storage |
| **Quantum Adversary** (future) | Shor's algorithm on quantum computer | Break ECDSA key recovery, forge signatures |

### 2.2 Assets Under Protection

- **Tourist Identity**: Cryptographic key pairs tied to biometric verification
- **Location Data**: GPS coordinates embedded in signed payloads
- **Nonce Integrity**: One-time-use challenge tokens
- **SOS Integrity**: Emergency alerts must be authentic

---

## 3. Classical Attack Resistance

### 3.1 Interception (MitM) Attack

**Threat**: An attacker intercepts the QR code nonce or the signed payload in transit.

**Mitigations**:
- **TLS/HTTPS** (production): All API traffic must use HTTPS with certificate pinning
- **Payload Signing**: Even if intercepted, the payload cannot be modified without the private key. The signature covers the **entire payload** — `userId | nonce | gps.lat,gps.lng | timestamp`
- **Nonce Binding**: The intercepted nonce is useless without the private key to sign it

**Residual Risk**: In the current HTTP dev environment, interception is trivial. This is mitigated in production by HTTPS.

### 3.2 Replay Attack

**Threat**: An attacker captures a valid signed payload and re-submits it.

**Mitigations**:

```
┌─────────────────────────────────────────────────────────────┐
│  BURN-AFTER-USE NONCE MECHANISM                             │
│                                                             │
│  1. Server generates nonce with unique ID and 5-min TTL     │
│  2. On first verification, nonce is marked as `used = true` │
│  3. Second attempt with same nonceId → 409 Conflict         │
│  4. Expired nonces are garbage collected every 60 seconds   │
│                                                             │
│  Key code (crypto-utils.js):                                │
│    if (entry.used) {                                        │
│      console.warn('[SECURITY] Replay attack detected');     │
│      return { valid: false, error: 'NONCE_ALREADY_USED' };  │
│    }                                                        │
│    entry.used = true; // BURN immediately                   │
└─────────────────────────────────────────────────────────────┘
```

**Defense in Depth**:
- Nonce TTL (5 minutes) limits the window of opportunity
- Timestamp in the payload allows server-side freshness checks
- In production, nonces would be stored in Redis with atomic operations to prevent race conditions

### 3.3 Signature Forgery

**Threat**: An attacker creates a valid signature without the private key.

**Mitigations**:
- ECDSA P-256 provides 128-bit security level
- Breaking requires solving the Elliptic Curve Discrete Logarithm Problem (ECDLP)
- Private key never leaves the device — stored in Secure Store (hardware-backed when available)
- Biometric verification required before every signing operation

### 3.4 GPS Spoofing

**Threat**: An attacker provides fake GPS coordinates.

**Mitigations**:
- GPS is included in the signed payload — cannot be modified after signing
- Server-side geo-fence zone validation can flag impossible location changes
- Future enhancement: Cross-reference with cell tower data or Wi-Fi positioning

---

## 4. Post-Quantum Cryptography Readiness

### 4.1 The Quantum Threat

Current ECDSA P-256 signatures are vulnerable to **Shor's algorithm** on a sufficiently powerful quantum computer. A quantum computer with ~2,330 logical qubits could break P-256 in polynomial time.

**Timeline**: NIST estimates cryptographically relevant quantum computers (CRQCs) could arrive by 2030-2040.

### 4.2 ML-DSA (CRYSTALS-Dilithium) Architecture

The system is architected for a hybrid transition to **ML-DSA** (Module-Lattice-Based Digital Signature Algorithm), standardized as **NIST FIPS 204**.

| Property | ECDSA P-256 | ML-DSA-65 (Dilithium3) |
|---|---|---|
| Security Level | 128-bit classical | NIST Level 3 (quantum-resistant) |
| Public Key Size | 64 bytes | 1,952 bytes |
| Signature Size | 64 bytes | 3,293 bytes |
| Quantum Safe | ❌ No | ✅ Yes |
| Performance | Very fast | Fast (lattice-based) |

### 4.3 Hybrid Verification Architecture

The codebase contains documented placeholders for a hybrid signing strategy:

**Phase 1 (Current)**: ECDSA-only
```
signature = ECDSA(payload, privateKey)
verify(payload, signature, publicKey)  // ECDSA only
```

**Phase 2 (Migration)**: Hybrid ECDSA + ML-DSA
```
signatures = {
  ecdsa: ECDSA(payload, ecdsaPrivKey),
  mldsa: MLDSA(payload, mldsaPrivKey)
}
// Accept if EITHER passes (backward compatible)
verified = verifyECDSA(...) || verifyMLDSA(...)
```

**Phase 3 (Post-Migration)**: ML-DSA-only
```
signature = MLDSA(payload, privateKey)
verify(payload, signature, publicKey)  // ML-DSA only
```

### 4.4 Implementation Readiness

Placeholder locations in the codebase:

| File | Location | Purpose |
|---|---|---|
| `backend/crypto-utils.js` | `verifySignature()` | Server-side hybrid verification |
| `auth-app/utils/crypto.js` | `signPayload()` | Client-side hybrid signing |
| `auth-app/utils/crypto.js` | `getOrCreateKeyPair()` | ML-DSA key generation and storage |

When ML-DSA libraries become available for Node.js/React Native (e.g., `liboqs-node`, `pqc-dilithium`), the swap requires:
1. Add ML-DSA key generation alongside ECDSA
2. Generate both signatures in `signPayload()`
3. Verify both in `verifySignature()`
4. Update payload format to include both signatures

---

## 5. QRNG Architecture

### 5.1 Why Quantum Randomness Matters

Classical CSPRNGs (Cryptographically Secure Pseudo-Random Number Generators) produce **pseudo-random** numbers from deterministic algorithms. While computationally secure, they are theoretically predictable if the internal state is compromised.

**QRNG** (Quantum Random Number Generation) produces **true randomness** from quantum mechanical phenomena (e.g., photon detection, vacuum fluctuations), providing information-theoretically secure entropy.

### 5.2 Pluggable Entropy Architecture

The nonce generation function has a documented **QRNG SWAP POINT**:

```javascript
// ── QRNG SWAP POINT ────────────────────────────────────
// Current: crypto.randomBytes(32) — OS CSPRNG (256 bits)
// Future:  Replace with QRNG source:
//
// Option A — Hardware QRNG (ID Quantique Quantis)
// Option B — Cloud QRNG API (ANU QRNG Service)
// Option C — NIST Randomness Beacon (XOR with local CSPRNG)
const nonceBuffer = crypto.randomBytes(32);
// ── END QRNG SWAP POINT ────────────────────────────────
```

The function signature remains unchanged — only the entropy source changes. No downstream code modifications required.

---

## 6. Biometric Security Model

### 6.1 Device-Local Verification

Biometric data (FaceID mesh, fingerprint minutiae) **NEVER leaves the device**:

```
┌────────────────────────────────────────────┐
│  MOBILE DEVICE                             │
│  ┌──────────────────────────────────────┐  │
│  │  Secure Enclave / TEE               │  │
│  │  • Biometric template stored here   │  │
│  │  • Private key stored here          │  │
│  │  • Signing happens here             │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  App ─── biometric check ───▶ Enclave     │
│      ◀── yes/no ─────────────             │
│                                            │
│  No biometric data is ever transmitted!    │
└────────────────────────────────────────────┘
```

### 6.2 Dual-Verification

Biometric verification is required at TWO points:
1. **App Launch**: BiometricGate screen blocks all access
2. **Before Signing**: ScanScreen re-verifies before any `signPayload()` call

This prevents scenarios where the phone is unlocked and handed to someone else.

---

## 7. Burp Suite Testing Guide

### 7.1 Setup

1. Start the backend: `cd backend && node server.js`
2. Configure Burp Suite proxy on `localhost:8080`
3. Point the web browser to use the Burp proxy
4. All Safety Hub API calls will be intercepted

### 7.2 Test Cases

#### Test 1: Nonce Generation
```bash
POST http://localhost:3000/api/nonce
Content-Type: application/json

# Expected: 201 Created
# Response: { success: true, data: { nonceId, nonce, expiresAt, qrPayload } }
```

#### Test 2: Valid Verification
```bash
# First generate a test signature:
POST http://localhost:3000/api/test/sign
Content-Type: application/json
{"nonceId": "<from step 1>", "nonce": "<from step 1>"}

# Then verify:
POST http://localhost:3000/api/verify
Content-Type: application/json
{<payload from test/sign response>}

# Expected: 200 OK, { verified: true }
```

#### Test 3: Replay Attack (nonce reuse)
```bash
# Re-send the SAME verify payload from Test 2
POST http://localhost:3000/api/verify
Content-Type: application/json
{<same payload>}

# Expected: 409 Conflict
# Response: { error: "NONCE_ALREADY_USED" }
```

#### Test 4: Tampered Payload
```bash
# Modify the GPS coordinates in the payload before sending
# The signature will no longer match

# Expected: 200 OK, { verified: false }
```

#### Test 5: Expired Nonce
```bash
# Wait 5+ minutes after generating a nonce, then try to verify

# Expected: 404, { error: "NONCE_EXPIRED" }
```

### 7.3 Response Format

All endpoints return clean JSON with consistent structure:
```json
{
  "success": true|false,
  "data": { ... },       // Present on success
  "error": "ERROR_CODE", // Present on failure
  "message": "Human-readable description"
}
```

**Headers**: `Content-Type: application/json`, `X-Content-Type-Options: nosniff`

---

## 8. Vulnerability Testing Architecture

### 8.1 Replay Protection Verification

```
Test Procedure:
1. POST /api/nonce → Save nonceId
2. POST /api/test/sign with nonceId → Save verifyPayload
3. POST /api/verify with verifyPayload → Should return verified: true
4. POST /api/verify with SAME verifyPayload → Should return 409 NONCE_ALREADY_USED
5. Check server logs for "[SECURITY] Replay attack detected" warning
```

### 8.2 Integrity Check Verification

```
Test Procedure:
1. Generate valid signed payload via /api/test/sign
2. Modify ONE field (e.g., change GPS lat by 0.001)
3. POST /api/verify with modified payload
4. Verify signature fails (verified: false)
5. Confirm the signature covers userId + nonce + GPS + timestamp
```

### 8.3 Nonce Expiration Test

```
Test Procedure:
1. POST /api/nonce → Save nonceId
2. Wait 5 minutes (TTL = 300,000ms)
3. POST /api/verify with expired nonceId
4. Verify response: NONCE_EXPIRED
```

---

## 9. References

| Standard | Description |
|---|---|
| **NIST FIPS 204** | ML-DSA (CRYSTALS-Dilithium) Digital Signature Standard |
| **NIST FIPS 186-5** | ECDSA (Elliptic Curve Digital Signature Algorithm) |
| **NIST SP 800-90A** | Recommendation for Random Number Generation |
| **ISO/IEC 30107** | Biometric Presentation Attack Detection |
| **OWASP Mobile Top 10** | Mobile Application Security Risks |
| **NIST PQC Project** | https://csrc.nist.gov/projects/post-quantum-cryptography |

---

*Document generated for the Smart Tourist Safety Monitoring & Incident Response System, MDoNER Project.*
