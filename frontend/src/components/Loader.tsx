import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

const loaderGif = require('../../assets/images/loader.gif');

interface LoaderProps {
    /** Size of the loader image */
    size?: number;
    /** Optional text below the loader */
    text?: string;
    /** Whether to show as a full-screen overlay */
    fullScreen?: boolean;
}

/**
 * Custom GIF loader component used throughout the app.
 * Use as a preloader or inline loading indicator.
 */
export default function Loader({ size = 100, text, fullScreen = false }: LoaderProps) {
    if (fullScreen) {
        return (
            <View style={styles.fullScreen}>
                <Image source={loaderGif} style={{ width: size, height: size }} resizeMode="contain" />
                {text && <Text style={styles.text}>{text}</Text>}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Image source={loaderGif} style={{ width: size, height: size }} resizeMode="contain" />
            {text && <Text style={styles.text}>{text}</Text>}
        </View>
    );
}

/** Smaller inline loader for buttons etc. */
export function InlineLoader({ size = 24 }: { size?: number }) {
    return (
        <Image source={loaderGif} style={{ width: size, height: size }} resizeMode="contain" />
    );
}

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F4FF',
    },
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    text: {
        marginTop: 16,
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
});
