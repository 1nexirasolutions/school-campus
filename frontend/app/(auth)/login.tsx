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
            <View style={styles.loginCard}>
              <Text style={styles.loginCardTitle}>Secure Login</Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail" size={20} color="#7C3AED" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email / Phone Number"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={20} color="#7C3AED" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={styles.passwordButton}
                  onPress={handlePasswordLogin}
                  disabled={loading !== null}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    style={styles.passwordButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading === 'password' ? <InlineLoader size={20} /> : <Text style={styles.passwordButtonText}>Sign In</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                Only users added by the Principal can sign in. Contact your school admin if you don't have access.
              </Text>
            </View>
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
    width: '100%',
    paddingBottom: 20,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
  },
  loginCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
    height: '100%',
  },
  passwordButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  passwordButtonGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 18,
  },
});
