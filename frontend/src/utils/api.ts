import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Get the backend URL that works on both web and mobile (Expo Go).
 * On mobile, localhost won't work - we need the dev machine's LAN IP.
 * expo-constants provides the debuggerHost which is the machine's IP.
 */
function getBackendUrl(): string {
  // First try the env var
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // On web, use the env var or empty string (same origin)
  if (Platform.OS === 'web') {
    return envUrl || '';
  }

  // On mobile, derive from Expo's debuggerHost (e.g. "192.168.1.9:8081")
  const debuggerHost = Constants.expoConfig?.hostUri
    || (Constants as any).manifest?.debuggerHost
    || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0]; // strip port
    return `http://${host}:8000`;
  }

  // Fallback to env var or empty
  return envUrl || '';
}

export const BACKEND_URL = getBackendUrl();

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const sessionToken = await AsyncStorage.getItem('session_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (sessionToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${sessionToken}`;
  }

  return fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
