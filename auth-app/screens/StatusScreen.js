/**
 * ============================================================================
 * VERIFICATION STATUS SCREEN
 * ============================================================================
 *
 * Displays the result of the QR code verification flow — success or failure.
 * Shows the signed payload details for transparency.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';

export default function StatusScreen({ route, navigation }) {
    const { success, data } = route.params || {};

    return (
        <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.container}
        >
            {/* Result Icon */}
            <View
                style={[
                    styles.iconCircle,
                    success ? styles.successCircle : styles.failureCircle,
                ]}
            >
                <Text style={styles.iconText}>{success ? '✓' : '✗'}</Text>
            </View>

            {/* Result Title */}
            <Text style={[styles.title, success ? styles.successText : styles.failureText]}>
                {success ? 'Identity Verified!' : 'Verification Failed'}
            </Text>

            <Text style={styles.subtitle}>
                {success
                    ? 'Your Digital ID has been successfully connected to the Safety Hub.'
                    : 'The verification could not be completed. Please try again.'}
            </Text>

            {/* Payload Details */}
            {data && (
                <View style={styles.detailsCard}>
                    <Text style={styles.detailsTitle}>Signed Payload Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>User ID</Text>
                        <Text style={styles.detailValue}>{data.userId || '—'}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Nonce ID</Text>
                        <Text style={[styles.detailValue, styles.mono]}>
                            {data.nonceId ? data.nonceId.substring(0, 16) + '...' : '—'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>GPS</Text>
                        <Text style={styles.detailValue}>
                            {data.gps
                                ? `${data.gps.lat}, ${data.gps.lng}`
                                : '—'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Timestamp</Text>
                        <Text style={styles.detailValue}>
                            {data.timestamp
                                ? new Date(data.timestamp).toLocaleString()
                                : '—'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Signature</Text>
                        <Text style={[styles.detailValue, styles.successText]}>
                            ECDSA P-256 ✓
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>
                            {data.message || '—'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Security Notice */}
            <View style={styles.securityNotice}>
                <Text style={styles.securityText}>
                    🛡️ This payload was signed after biometric verification.{'\n'}
                    The nonce has been burned (single-use) to prevent replay attacks.{'\n'}
                    PQC ML-DSA hybrid signatures ready for future activation.
                </Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.replace('Scanner')}
            >
                <Text style={styles.primaryButtonText}>
                    {success ? '📷 Scan Another QR' : '🔄 Try Again'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.replace('Biometric')}
            >
                <Text style={styles.secondaryButtonText}>🔒 Lock App</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    container: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 60,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successCircle: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 3,
        borderColor: '#22c55e',
    },
    failureCircle: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 3,
        borderColor: '#ef4444',
    },
    iconText: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 8,
    },
    successText: {
        color: '#22c55e',
    },
    failureText: {
        color: '#ef4444',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 20,
        maxWidth: 300,
    },
    detailsCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        marginBottom: 20,
    },
    detailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366f1',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(148, 163, 184, 0.08)',
    },
    detailLabel: {
        color: '#64748b',
        fontSize: 13,
    },
    detailValue: {
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: '500',
        maxWidth: 200,
        textAlign: 'right',
    },
    mono: {
        fontFamily: 'monospace',
        fontSize: 11,
    },
    securityNotice: {
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        maxWidth: 380,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.15)',
    },
    securityText: {
        color: '#64748b',
        fontSize: 11,
        lineHeight: 18,
        textAlign: 'center',
    },
    primaryButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        maxWidth: 380,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: '#334155',
        width: '100%',
        maxWidth: 380,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
});
