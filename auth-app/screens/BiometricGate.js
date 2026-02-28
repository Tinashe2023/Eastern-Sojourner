/**
 * ============================================================================
 * BIOMETRIC GATE SCREEN
 * ============================================================================
 *
 * The first screen the user sees. Requires FaceID or Fingerprint verification
 * before any cryptographic operations are allowed.
 *
 * This screen acts as the "identity gate" — no key access or signing can
 * occur until the user passes biometric authentication.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export default function BiometricGate({ navigation }) {
    const [isChecking, setIsChecking] = useState(true);
    const [biometricType, setBiometricType] = useState(null);
    const [isAvailable, setIsAvailable] = useState(false);

    useEffect(() => {
        checkBiometricSupport();
    }, []);

    /**
     * Check if the device supports biometric authentication.
     */
    async function checkBiometricSupport() {
        try {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

            setIsAvailable(compatible && enrolled);

            // Determine biometric type
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricType('FaceID');
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricType('Fingerprint');
            } else {
                setBiometricType('Biometric');
            }
        } catch (err) {
            console.error('[BIO] Hardware check failed:', err);
            setIsAvailable(false);
        }
        setIsChecking(false);
    }

    /**
     * Initiate biometric authentication.
     * On success, navigate to the QR Scanner screen.
     */
    async function authenticate() {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify your identity to access Eastern Sojourner Auth',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
                fallbackLabel: 'Use Passcode',
            });

            if (result.success) {
                // Biometric verified — allow access to cryptographic operations
                navigation.replace('Scanner');
            } else {
                Alert.alert(
                    'Authentication Failed',
                    'Biometric verification is required to sign cryptographic challenges. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        } catch (err) {
            console.error('[BIO] Authentication error:', err);
            Alert.alert('Error', 'An error occurred during biometric authentication.');
        }
    }

    if (isChecking) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Checking biometric hardware...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Logo Area */}
            <View style={styles.logoContainer}>
                <Text style={styles.logoIcon}>🏔️</Text>
                <Text style={styles.logoText}>Eastern Sojourner</Text>
                <Text style={styles.logoSubtext}>Auth</Text>
            </View>

            {/* Biometric Card */}
            <View style={styles.card}>
                <View style={styles.iconCircle}>
                    <Text style={styles.biometricIcon}>
                        {biometricType === 'FaceID' ? '👤' : '🔒'}
                    </Text>
                </View>

                <Text style={styles.title}>Identity Verification</Text>
                <Text style={styles.subtitle}>
                    {isAvailable
                        ? `Verify with ${biometricType} to access your Digital ID and sign cryptographic challenges.`
                        : 'Biometric authentication is not available on this device. Please enable Face ID or Fingerprint in your device settings.'}
                </Text>

                {isAvailable ? (
                    <TouchableOpacity style={styles.authButton} onPress={authenticate}>
                        <Text style={styles.authButtonText}>
                            {biometricType === 'FaceID' ? '👤 ' : '🔒 '}
                            Verify with {biometricType}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.authButton, styles.disabledButton]}
                        disabled
                    >
                        <Text style={styles.authButtonText}>Biometrics Unavailable</Text>
                    </TouchableOpacity>
                )}

                {/* Security badge */}
                <View style={styles.securityBadge}>
                    <Text style={styles.badgeText}>
                        🛡️ PQC-Ready • ECDSA P-256 • Secure Enclave
                    </Text>
                </View>
            </View>

            {/* Footer */}
            <Text style={styles.footerText}>
                Your biometric data never leaves this device.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 16,
        fontSize: 14,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#e2e8f0',
        letterSpacing: 1,
    },
    logoSubtext: {
        fontSize: 16,
        fontWeight: '300',
        color: '#6366f1',
        letterSpacing: 3,
        textTransform: 'uppercase',
    },
    card: {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    biometricIcon: {
        fontSize: 36,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#e2e8f0',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    authButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    disabledButton: {
        backgroundColor: '#334155',
    },
    authButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    securityBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    badgeText: {
        color: '#22c55e',
        fontSize: 11,
        fontWeight: '500',
    },
    footerText: {
        color: '#475569',
        fontSize: 12,
        marginTop: 32,
        textAlign: 'center',
    },
});
