/**
 * ============================================================================
 * POLYFILLS — MUST BE FIRST (before any other imports)
 * ============================================================================
 * React Native does not include Node.js globals like Buffer or
 * crypto.getRandomValues. These polyfills inject them globally so that
 * libraries like `elliptic` can function.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

/**
 * ============================================================================
 * EASTERN SOJOURNER AUTH — MAIN APPLICATION
 * ============================================================================
 *
 * Root component that sets up React Navigation between:
 *   1. BiometricGate — FaceID / Fingerprint identity verification
 *   2. ScanScreen   — QR code scanner + signing flow
 *   3. StatusScreen  — Verification result display
 *
 * Architecture:
 *   BiometricGate ──(auth success)──➜ ScanScreen ──(signed)──➜ StatusScreen
 *       ▲                                                          │
 *       └──────────────────────(lock app)───────────────────────────┘
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BiometricGate from './screens/BiometricGate';
import ScanScreen from './screens/ScanScreen';
import StatusScreen from './screens/StatusScreen';

const Stack = createNativeStackNavigator();

/**
 * Dark theme matching the Eastern Sojourner brand palette.
 */
const DarkTheme = {
    ...NavigationDarkTheme,
    colors: {
        ...NavigationDarkTheme.colors,
        primary: '#6366f1',
        background: '#0f172a',
        card: '#1e293b',
        text: '#e2e8f0',
        border: '#334155',
        notification: '#ef4444',
    },
};

/**
 * Error Boundary — catches runtime crashes and shows a helpful
 * error screen instead of a blank white page.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[APP CRASH]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={errorStyles.container}>
                    <Text style={errorStyles.icon}>⚠️</Text>
                    <Text style={errorStyles.title}>App Error</Text>
                    <Text style={errorStyles.message}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </Text>
                    <Text style={errorStyles.hint}>
                        Please restart the app. If the issue persists, reinstall from the latest build.
                    </Text>
                </View>
            );
        }
        return this.props.children;
    }
}

const errorStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    icon: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '700', color: '#ef4444', marginBottom: 8 },
    message: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
    hint: { fontSize: 12, color: '#475569', textAlign: 'center' },
});

export default function App() {
    return (
        <ErrorBoundary>
            <NavigationContainer theme={DarkTheme}>
                <StatusBar style="light" />
                <Stack.Navigator
                    initialRouteName="Biometric"
                    screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        contentStyle: { backgroundColor: '#0f172a' },
                    }}
                >
                    <Stack.Screen name="Biometric" component={BiometricGate} />
                    <Stack.Screen name="Scanner" component={ScanScreen} />
                    <Stack.Screen name="Status" component={StatusScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </ErrorBoundary>
    );
}
