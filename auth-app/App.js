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
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BiometricGate from './screens/BiometricGate';
import ScanScreen from './screens/ScanScreen';
import StatusScreen from './screens/StatusScreen';

const Stack = createNativeStackNavigator();

/**
 * Dark theme matching the Eastern Sojourner brand palette.
 */
const DarkTheme = {
    dark: true,
    colors: {
        primary: '#6366f1',
        background: '#0f172a',
        card: '#1e293b',
        text: '#e2e8f0',
        border: '#334155',
        notification: '#ef4444',
    },
};

export default function App() {
    return (
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
    );
}
