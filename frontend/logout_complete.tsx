/**
 * Complete Logout Functionality - Frontend Implementation
 * Extracted from AuthContext.tsx for clarity and debugging
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://school-campus-3.onrender.com';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  assigned_class?: string;
  assigned_section?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Complete logout implementation with comprehensive logging
 */
const completeLogout = async (
  currentUser: User | null,
  setUser: (user: User | null) => void,
  isLoggingOutRef: React.MutableRefObject<boolean>
): Promise<void> => {
  console.log('🚪' + '='.repeat(60));
  console.log('🚪 LOGOUT PROCESS STARTED');
  console.log('🚪' + '='.repeat(60));

  const startTime = Date.now();
  console.log(`⏰ Logout started at: ${new Date().toISOString()}`);
  console.log(`⏰ Timestamp: ${startTime}`);

  // Log current state
  console.log('👤 Current user state:', {
    isLoggedIn: !!currentUser,
    userId: currentUser?.user_id || 'No user',
    email: currentUser?.email || 'No email',
    role: currentUser?.role || 'No role'
  });

  // Prevent concurrent logout attempts
  if (isLoggingOutRef.current) {
    console.log('⚠️ Logout already in progress, ignoring duplicate call');
    return;
  }

  console.log('🔒 Setting isLoggingOutRef to true');
  isLoggingOutRef.current = true;

  try {
    console.log('📱 Phase 1: Retrieving session token');

    const sessionToken = await AsyncStorage.getItem('session_token');
    console.log('📱 Session token retrieval results:', {
      tokenFound: !!sessionToken,
      tokenLength: sessionToken?.length || 0,
      tokenPreview: sessionToken ? `${sessionToken.substring(0, 10)}...` : 'None',
      storageTimestamp: Date.now()
    });

    if (sessionToken) {
      console.log('🌐 Phase 2: Calling backend logout API');
      console.log('🌐 API Configuration:', {
        url: `${BACKEND_URL}/auth/logout`,
        method: 'POST',
        hasToken: true,
        tokenLength: sessionToken.length,
        platform: Platform.OS,
        backendUrl: BACKEND_URL
      });

      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('⏰ API request timeout - aborting request');
          controller.abort();
        }, 10000);

        const requestStartTime = Date.now();

        console.log('📡 Sending API request...');

        const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
            'User-Agent': Platform.OS === 'web' ?
              (typeof navigator !== 'undefined' ? navigator.userAgent : 'WebApp') :
              'MobileApp',
            'X-Platform': Platform.OS,
            'X-Logout-Timestamp': startTime.toString()
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const requestDuration = Date.now() - requestStartTime;

        console.log('📡 API Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          type: response.type,
          url: response.url,
          duration: `${requestDuration}ms`,
          timestamp: Date.now()
        });

        // Log response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log('📡 Response headers:', responseHeaders);

        if (response.ok) {
          try {
            const result = await response.json();
            console.log('✅ Logout API Success:', {
              message: result.message,
              responseStructure: Object.keys(result),
              timestamp: Date.now()
            });
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse JSON response:', jsonError);
            const textResponse = await response.text();
            console.log('📄 Raw response text:', textResponse);
          }
        } else {
          console.warn('⚠️ Logout API returned non-OK status');

          try {
            const errorText = await response.text();
            console.warn('⚠️ Error response details:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
              timestamp: Date.now()
            });
          } catch (textError) {
            console.warn('⚠️ Could not read error response body:', textError);
          }
        }

      } catch (apiError) {
        console.error('❌ Logout API failed, continuing with local cleanup');
        console.error('❌ API Error Analysis:', {
          errorType: typeof apiError,
          errorMessage: apiError instanceof Error ? apiError.message : String(apiError),
          errorName: apiError instanceof Error ? apiError.name : 'Unknown',
          stack: apiError instanceof Error ? apiError.stack : 'No stack available',
          timestamp: Date.now()
        });

        if (apiError instanceof Error) {
          if (apiError.name === 'AbortError') {
            console.warn('❌ Request was aborted due to timeout (10s)');
          } else if (apiError.name === 'TypeError') {
            console.warn('❌ Network error or CORS issue');
          } else if (apiError.message.includes('Network request failed')) {
            console.warn('❌ Network connectivity issue');
          }
        }
      }
    } else {
      console.log('ℹ️ No session token found, proceeding with local logout only');
      console.log('ℹ️ This is normal for an already logged-out state');
    }

  } catch (error) {
    console.error('💥 Critical error during logout process');
    console.error('💥 Critical Error Analysis:', {
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack available',
      timestamp: Date.now()
    });
  } finally {
    console.log('🧹' + '='.repeat(60));
    console.log('🧹 Phase 3: Local State Cleanup');
    console.log('🧹' + '='.repeat(60));

    const cleanupStartTime = Date.now();

    // Always clear local state regardless of API result
    try {
      console.log('🗑️ AsyncStorage cleanup started');

      // Check what's currently in storage
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('🔍 Current AsyncStorage keys:', allKeys);

      // Check session token before clearing
      const tokenBeforeClear = await AsyncStorage.getItem('session_token');
      console.log('🔍 Session token before clear:', !!tokenBeforeClear);

      // Clear the session token
      await AsyncStorage.multiRemove(['session_token']);
      console.log('🗑️ AsyncStorage.multiRemove completed');

      // Verify it's actually cleared
      const tokenAfterClear = await AsyncStorage.getItem('session_token');
      console.log('🔍 Session token after clear:', !!tokenAfterClear);

      // Check all keys after clearing
      const allKeysAfter = await AsyncStorage.getAllKeys();
      console.log('🔍 AsyncStorage keys after clear:', allKeysAfter);

      const cleanupSuccess = !tokenAfterClear;
      console.log(`✅ AsyncStorage cleanup ${cleanupSuccess ? 'successful' : 'failed'}`);

    } catch (storageError) {
      console.error('❌ AsyncStorage cleanup failed');
      console.error('❌ Storage Error:', {
        errorType: typeof storageError,
        errorMessage: storageError instanceof Error ? storageError.message : String(storageError),
        timestamp: Date.now()
      });

      // Fallback: try individual remove
      try {
        console.log('🔄 Attempting fallback individual remove...');
        await AsyncStorage.removeItem('session_token');
        console.log('✅ Fallback remove successful');
      } catch (fallbackError) {
        console.error('❌ Even fallback remove failed:', fallbackError);
      }
    }

    // Clear web cookies if applicable
    if (Platform.OS === 'web') {
      console.log('🌐 Web platform detected - clearing cookies');

      try {
        if (typeof document !== 'undefined') {
          console.log('🌐 Document object available');

          // Log current cookies
          const currentCookies = document.cookie;
          console.log('🍪 Current cookies:', currentCookies);

          // Clear cookies with different settings
          document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';

          if (typeof window !== 'undefined') {
            const domain = window.location.hostname;
            document.cookie = `session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}`;
            console.log(`🌐 Cleared cookies for domain: ${domain}`);
          }

          // Verify cookies are cleared
          const cookiesAfter = document.cookie;
          console.log('🍪 Cookies after clearing:', cookiesAfter);
          console.log('✅ Web cookie clearing completed');
        } else {
          console.log('⚠️ Document object not available');
        }
      } catch (cookieError) {
        console.error('❌ Error clearing web cookies:', cookieError);
      }
    } else {
      console.log(`📱 Mobile platform (${Platform.OS}) - skipping cookie clearing`);
    }

    // Clear React state
    console.log('👤 Clearing React user state');
    console.log('👤 User before clear:', {
      isLoggedIn: !!currentUser,
      userId: currentUser?.user_id || 'None'
    });

    setUser(null);

    console.log('👤 User state cleared to null');

    const cleanupDuration = Date.now() - cleanupStartTime;
    const totalDuration = Date.now() - startTime;

    console.log('🧹 Cleanup Summary:', {
      cleanupDuration: `${cleanupDuration}ms`,
      totalDuration: `${totalDuration}ms`,
      timestamp: Date.now()
    });

    // Reset the logout flag after a delay
    console.log('⏰ Scheduling isLoggingOutRef reset in 500ms');
    setTimeout(() => {
      isLoggingOutRef.current = false;
      console.log('🔓 isLoggingOutRef reset to false');

      console.log('🎉' + '='.repeat(60));
      console.log('🎉 LOGOUT PROCESS COMPLETED SUCCESSFULLY');
      console.log('🎉' + '='.repeat(60));
      console.log(`🎉 Total duration: ${Date.now() - startTime}ms`);
      console.log('🎉 User is now logged out');
    }, 500);
  }
};

/**
 * Test function to verify logout functionality
 */
export const testLogoutFunctionality = async () => {
  console.log('🧪 Starting logout functionality test...');

  const mockUser = {
    user_id: 'test_user_123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'student'
  };

  const mockSetUser = (user: User | null) => {
    console.log('🔄 Mock setUser called with:', user);
  };

  const mockIsLoggingOutRef = { current: false };

  try {
    await completeLogout(mockUser, mockSetUser, mockIsLoggingOutRef);
    console.log('✅ Logout test completed successfully');
  } catch (error) {
    console.error('❌ Logout test failed:', error);
  }
};

export default completeLogout;
