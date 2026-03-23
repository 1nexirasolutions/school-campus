import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

try {
  if (Constants.appOwnership !== 'expo' && Constants.executionEnvironment !== 'storeClient') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });
  }
} catch (e) {
  console.log('Notifications not supported in this environment');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../utils/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '133291356915-j3nm5ccpkm868ieaufqjhhrmht3sfk53.apps.googleusercontent.com', // Injected from google-services.json
});


interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  assigned_class?: string;
  assigned_section?: string;
  assigned_subjects?: string[];
  roll_number?: string;
  admission_number?: string;
  mobile_number?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    if (user && Platform.OS !== 'web') {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'web') return;
    if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
      console.log('Push notifications are not supported in Expo Go. Please use a development build.');
      return;
    }
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

    try {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);

      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken && token) {
        await fetch(`${BACKEND_URL}/api/users/push-token`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });
      }
    } catch (e) {
      console.log('Error getting push token', e);
    }
  };

  useEffect(() => {
    if (isLoggingOutRef.current) return;

    const initialize = async () => {
      try {
        // On web, check if we're returning from Google OAuth with a session_id in the hash
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash.includes('session_id=')) {
            const sessionId = hash.split('session_id=')[1]?.split('&')[0];
            if (sessionId) {
              console.log('Found session_id in URL hash, exchanging...');
              const success = await processSessionId(sessionId);
              // Clean up the URL hash
              window.history.replaceState({}, document.title, window.location.pathname);
              if (success) {
                setLoading(false);
                return; // User was set by processSessionId, done!
              }
            }
          }
        }

        // On mobile, check for deep link with session_id
        if (Platform.OS !== 'web') {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            let sessionId = null;
            if (initialUrl.includes('#session_id=')) {
              sessionId = initialUrl.split('#session_id=')[1]?.split('&')[0];
            } else if (initialUrl.includes('?session_id=')) {
              sessionId = initialUrl.split('?session_id=')[1]?.split('&')[0];
            }
            if (sessionId) {
              console.log('Found session_id in deep link, exchanging...');
              const success = await processSessionId(sessionId);
              if (success) {
                setLoading(false);
                return;
              }
            }
          }
        }

        // No OAuth redirect — check for existing saved session
        await checkExistingSession();
      } catch (error) {
        console.warn('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initialize();

    // Listen for deep links while app is open (mobile)
    if (Platform.OS !== 'web') {
      const subscription = Linking.addEventListener('url', async (event) => {
        const url = event.url;
        let sessionId = null;
        if (url.includes('#session_id=')) {
          sessionId = url.split('#session_id=')[1]?.split('&')[0];
        } else if (url.includes('?session_id=')) {
          sessionId = url.split('?session_id=')[1]?.split('&')[0];
        }
        if (sessionId) {
          await processSessionId(sessionId);
        }
      });

      return () => subscription.remove();
    }
  }, []);

  const checkExistingSession = async () => {
    if (isLoggingOutRef.current) return;

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');

      if (isLoggingOutRef.current) return;

      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          await AsyncStorage.removeItem('session_token');
        }
      }
    } catch (error) {
      console.warn('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const processSessionId = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        setUser(data.user);
        return true;
      }
    } catch (error) {
      console.warn('Session exchange error:', error);
    }
    return false;
  };

  const login = async () => {
    try {
      if (Platform.OS === 'web') {
        const FRONTEND_URL = process.env.EXPO_PUBLIC_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');
        const redirectUrl = `${FRONTEND_URL}/`;
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
        window.location.href = authUrl;
        return;
      }

      // Native App: Firebase Google Sign-In
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) throw new Error("No ID token found");

      // Verify Firebase ID Token on Backend
      const response = await fetch(`${BACKEND_URL}/api/auth/firebase-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        setUser(data.user);
      } else {
        const error = await response.json();
        alert(error.detail || "Login failed on backend");
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const logout = async () => {
    console.log('Logout started');
    isLoggingOutRef.current = true;

    // Get the token before clearing
    let sessionToken: string | null = null;
    try {
      sessionToken = await AsyncStorage.getItem('session_token');
    } catch (e) {
      console.warn('Failed to get session token:', e);
    }

    // Clear local state FIRST for immediate feedback
    try {
      await AsyncStorage.multiRemove(['session_token']);
    } catch (e) {
      console.warn('Failed to clear AsyncStorage:', e);
    }

    // Clear web cookies if applicable
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }

    // Clear user state immediately
    setUser(null);

    // Call backend logout in background (don't block the user)
    if (sessionToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }).catch(() => { });

        clearTimeout(timeoutId);
      } catch (apiError) {
        // Silently ignore - local state is already cleared
      }
    }

    // Reset flag after delay
    setTimeout(() => {
      isLoggingOutRef.current = false;
      console.log('Logout completed');
    }, 500);
  };

  const refreshUser = async () => {
    const sessionToken = await AsyncStorage.getItem('session_token');
    if (sessionToken) {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    }
  };

  // Handle web redirect
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          processSessionId(sessionId).then(() => {
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          });
        }
      }
    }
  }, []);

  // Handle deep links for mobile
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Cold start
      Linking.getInitialURL().then((url) => {
        if (url) {
          let sessionId = null;
          if (url.includes('#session_id=')) {
            sessionId = url.split('#session_id=')[1]?.split('&')[0];
          } else if (url.includes('?session_id=')) {
            sessionId = url.split('?session_id=')[1]?.split('&')[0];
          }
          if (sessionId) {
            processSessionId(sessionId);
          }
        }
      });

      // Hot link
      const subscription = Linking.addEventListener('url', ({ url }) => {
        let sessionId = null;
        if (url.includes('#session_id=')) {
          sessionId = url.split('#session_id=')[1]?.split('&')[0];
        } else if (url.includes('?session_id=')) {
          sessionId = url.split('?session_id=')[1]?.split('&')[0];
        }
        if (sessionId) {
          processSessionId(sessionId);
        }
      });

      return () => subscription.remove();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
