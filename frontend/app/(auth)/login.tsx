import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { BACKEND_URL } from '../../src/utils/api';
import { InlineLoader } from '../../src/components/Loader';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { login, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }
    setLoading('password');
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        await refreshUser();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        } else {
          router.replace('/(app)/dashboard');
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Login failed');
      }
    } catch (error) {
      console.error('Password login error:', error);
      alert('Network error. Make sure the backend is running.');
    } finally {
      setLoading(null);
    }
  };

  const handleDemoLogin = async (role: string) => {
    setLoading(role);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        // Refresh user state in AuthContext
        await refreshUser();
        // Navigate to dashboard
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        } else {
          router.replace('/(app)/dashboard');
        }
      } else {
        const error = await response.json();
        const msg = error.detail || 'Login failed';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          const { Alert } = require('react-native');
          Alert.alert('Error', msg);
        }
      }
    } catch (error) {
      console.error('Demo login error:', error);
      const msg = 'Network error. Make sure the backend is running.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        const { Alert } = require('react-native');
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED', '#9333EA']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="school" size={60} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>CampusLink ERP</Text>
            <Text style={styles.tagline}>School Management Made Simple</Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <Ionicons name="calendar" size={24} color="#FFFFFF" />
                <Text style={styles.featureText}>Attendance</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="time" size={24} color="#FFFFFF" />
                <Text style={styles.featureText}>Timetable</Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" />
                <Text style={styles.featureText}>Assignments</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="notifications" size={24} color="#FFFFFF" />
                <Text style={styles.featureText}>Notifications</Text>
              </View>
            </View>
          </View>

          {/* Login Section */}
          <View style={styles.loginSection}>
            {/* Demo Login Buttons */}
            <Text style={styles.demoTitle}>Quick Demo Login</Text>
            <View style={styles.demoButtons}>
              <TouchableOpacity
                style={[styles.demoButton, styles.principalBtn]}
                onPress={() => handleDemoLogin('principal')}
                disabled={loading !== null}
              >
                {loading === 'principal' ? (
                  <InlineLoader size={20} />
                ) : (
                  <>
                    <Ionicons name="ribbon" size={18} color="#FFFFFF" />
                    <Text style={styles.demoBtnText}>Principal</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoButton, styles.teacherBtn]}
                onPress={() => handleDemoLogin('teacher')}
                disabled={loading !== null}
              >
                {loading === 'teacher' ? (
                  <InlineLoader size={20} />
                ) : (
                  <>
                    <Ionicons name="school" size={18} color="#FFFFFF" />
                    <Text style={styles.demoBtnText}>Teacher</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoButton, { backgroundColor: '#7C3AED' }]}
                onPress={() => handleDemoLogin('class_teacher')}
                disabled={loading !== null}
              >
                {loading === 'class_teacher' ? (
                  <InlineLoader size={20} />
                ) : (
                  <>
                    <Ionicons name="clipboard" size={18} color="#FFFFFF" />
                    <Text style={styles.demoBtnText}>Class Teacher</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoButton, styles.studentBtn]}
                onPress={() => handleDemoLogin('student')}
                disabled={loading !== null}
              >
                {loading === 'student' ? (
                  <InlineLoader size={20} />
                ) : (
                  <>
                    <Ionicons name="person" size={18} color="#FFFFFF" />
                    <Text style={styles.demoBtnText}>Student</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email / Password Login */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.passwordButton} onPress={handlePasswordLogin} disabled={loading !== null}>
                {loading === 'password' ? <InlineLoader size={20} /> : <Text style={styles.passwordButtonText}>Sign In</Text>}
              </TouchableOpacity>
            </View>

            <Text style={styles.disclaimer}>
              Only users added by the Principal can sign in. Contact your school admin if you don't have access.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  featuresSection: {
    paddingVertical: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  featureItem: {
    alignItems: 'center',
    width: width / 3,
  },
  featureText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
  },
  loginSection: {
    alignItems: 'center',
  },
  demoTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    flex: 1,
    maxWidth: 130,
  },
  principalBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },
  teacherBtn: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
  },
  studentBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.85)',
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 12,
    fontSize: 13,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});
