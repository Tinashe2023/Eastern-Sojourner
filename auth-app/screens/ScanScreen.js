/**
 * ============================================================================
 * QR CODE SCANNER SCREEN
 * ============================================================================
 *
 * Scans QR codes from the Safety Hub web platform.
 * After scanning, triggers biometric re-verification, then signs the nonce
 * and POSTs the signed payload to the backend.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import {
    getOrCreateKeyPair,
    getUserId,
    buildCanonicalPayload,
    signPayload,
} from '../utils/crypto';
import { postVerification } from '../utils/api';

export default function ScanScreen({ navigation }) {
    const isFocused = useIsFocused();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Point camera at the Safety Hub QR code');

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, []);

    /**
     * Handle a scanned QR code barcode.
     */
    async function handleBarCodeScanned({ data }) {
        if (scanned || processing) return;
        setScanned(true);
        setProcessing(true);
        setStatusMessage('QR code detected! Processing...');

        try {
            // ── Step 1: Parse QR payload ─────────────────────────────────
            let qrData;
            try {
                qrData = JSON.parse(data);
            } catch {
                throw new Error('Invalid QR code — not a Safety Hub challenge');
            }

            if (qrData.type !== 'EASTERN_SOJOURNER_SAFETY') {
                throw new Error('This QR code is not from the Safety Hub');
            }

            setStatusMessage('🔒 Biometric re-verification required...');

            // ── Step 2: Biometric re-verification ────────────────────────
            // Critical security step: re-verify biometrics before ANY
            // cryptographic signing operation
            const bioResult = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify identity to sign this challenge',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
                fallbackLabel: 'Use Passcode',
            });

            if (!bioResult.success) {
                throw new Error('Biometric verification failed — signing aborted');
            }

            setStatusMessage('✅ Biometric verified. Signing payload...');

            // ── Step 3: Get keys and user ID ─────────────────────────────
            const { privateKey, publicKey } = await getOrCreateKeyPair();
            const userId = await getUserId();

            // ── Step 4: Get GPS location ─────────────────────────────────
            setStatusMessage('📍 Acquiring GPS location...');
            let gps = { lat: 0, lng: 0 };
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });
                    gps = {
                        lat: parseFloat(location.coords.latitude.toFixed(6)),
                        lng: parseFloat(location.coords.longitude.toFixed(6)),
                    };
                }
            } catch (locErr) {
                console.warn('[SCAN] GPS not available, using default:', locErr);
            }

            // ── Step 5: Build and sign the canonical payload ─────────────
            const timestamp = new Date().toISOString();
            const canonicalPayload = buildCanonicalPayload(
                userId,
                qrData.nonce,
                gps,
                timestamp
            );

            setStatusMessage('✍️ Signing with ECDSA P-256...');
            const signature = signPayload(canonicalPayload, privateKey);

            // ── Step 6: POST to backend ──────────────────────────────────
            setStatusMessage('📡 Sending to Safety Hub server...');
            const result = await postVerification({
                nonceId: qrData.nonceId,
                userId,
                signature,
                publicKey,
                gps,
                timestamp,
            });

            // ── Step 7: Navigate to result screen ────────────────────────
            navigation.replace('Status', {
                success: result.success && result.data?.verified,
                data: {
                    userId,
                    nonceId: qrData.nonceId,
                    gps,
                    timestamp,
                    message: result.data?.message || 'Verification complete',
                },
            });
        } catch (err) {
            console.error('[SCAN] Error:', err);
            Alert.alert('Verification Failed', err.message, [
                {
                    text: 'Scan Again',
                    onPress: () => {
                        setScanned(false);
                        setProcessing(false);
                        setStatusMessage('Point camera at the Safety Hub QR code');
                    },
                },
            ]);
            setProcessing(false);
        }
    }

    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.statusText}>Requesting camera permission...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Camera Access Required</Text>
                <Text style={styles.statusText}>
                    Eastern Sojourner Auth needs camera access to scan QR codes from the Safety Hub.
                </Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Camera Access</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Camera View */}
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
            </View>

            {/* Status Bar */}
            <View style={styles.statusBar}>
                {processing && (
                    <ActivityIndicator
                        size="small"
                        color="#6366f1"
                        style={{ marginRight: 8 }}
                    />
                )}
                <Text style={styles.statusText}>{statusMessage}</Text>
            </View>

            {/* Bottom Info */}
            <View style={styles.infoBar}>
                <Text style={styles.infoText}>
                    🛡️ ECDSA P-256 • PQC Ready • Biometric Protected
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraContainer: {
        flex: 1,
        width: '100%',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scanFrame: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#6366f1',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderTopLeftRadius: 8,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 3,
        borderRightWidth: 3,
        borderTopRightRadius: 8,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
        borderBottomLeftRadius: 8,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderBottomRightRadius: 8,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
    },
    statusText: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
    },
    infoBar: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#0f172a',
    },
    infoText: {
        color: '#475569',
        fontSize: 11,
        textAlign: 'center',
    },
    title: {
        color: '#e2e8f0',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#6366f1',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 25,
        marginTop: 20,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
