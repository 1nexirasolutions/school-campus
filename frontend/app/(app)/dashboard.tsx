import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../src/utils/api';
import Loader from '../../src/components/Loader';

interface Stats {
  totalStudents?: number;
  totalTeachers?: number;
  pendingLeaves?: number;
  unreadNotifications?: number;
  todayAttendance?: number;
  assignments?: number;
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load notifications count
      const notifResponse = await apiRequest('/api/notifications/unread-count');
      if (notifResponse.ok) {
        const data = await notifResponse.json();
        setStats(prev => ({ ...prev, unreadNotifications: data.unread_count }));
      }

      // Load pending leaves for teachers/principals
      if (user?.role !== 'student') {
        const leaveResponse = await apiRequest('/api/leave?status=pending');
        if (leaveResponse.ok) {
          const leaves = await leaveResponse.json();
          setStats(prev => ({ ...prev, pendingLeaves: leaves.length }));
        }
      }

      // Load assignments
      const assignResponse = await apiRequest('/api/assignments');
      if (assignResponse.ok) {
        const assignments = await assignResponse.json();
        setStats(prev => ({ ...prev, assignments: assignments.length }));
      }

      // For principal, load user counts
      if (user?.role === 'principal') {
        const usersResponse = await apiRequest('/api/users');
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          const students = users.filter((u: any) => u.role === 'student').length;
          const teachers = users.filter((u: any) => u.role === 'teacher').length;
          setStats(prev => ({ ...prev, totalStudents: students, totalTeachers: teachers }));
        }
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };
  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        await logout();
        // Small delay to ensure state is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/login';
        } else {
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Still navigate even if there's an error
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/login';
        } else {
          router.replace('/(auth)/login');
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Use window.confirm on web since Alert.alert callbacks can be unreliable
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        await doLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            onPress: doLogout,
            style: 'destructive',
          },
        ]
      );
    }
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case 'principal': return '#DC2626';
      case 'teacher': return '#2563EB';
      case 'class_teacher': return '#7C3AED';
      default: return '#059669';
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'principal': return 'Principal';
      case 'teacher': return 'Teacher';
      case 'class_teacher': return 'Class Teacher';
      default: return 'Student';
    }
  };

  const QuickActionCard = ({ icon, title, subtitle, onPress, color }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const StatCard = ({ icon, value, label, color }: any) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (initialLoading) {
    return <Loader fullScreen size={100} text="Loading dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/(app)/profile')} style={{ marginRight: 16 }}>
              <View style={[styles.profileAvatar, { backgroundColor: getRoleColor() + '20' }]}>
                <Ionicons name="person" size={22} color={getRoleColor()} />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor() + '20' }]}>
                <Text style={[styles.roleText, { color: getRoleColor() }]}>
                  {getRoleLabel()}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Class Info for Students and Class Teachers */}
        {(user?.role === 'student' || user?.role === 'class_teacher') && user?.assigned_class && (
          <View style={styles.classInfo}>
            <Ionicons name="school-outline" size={20} color="#4F46E5" />
            <Text style={styles.classText}>
              {user.assigned_class} - Section {user.assigned_section || 'N/A'}
            </Text>
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          {user?.role === 'principal' && (
            <>
              <StatCard
                icon="people"
                value={stats.totalStudents || 0}
                label="Students"
                color="#059669"
              />
              <StatCard
                icon="person"
                value={stats.totalTeachers || 0}
                label="Teachers"
                color="#2563EB"
              />
            </>
          )}
          <StatCard
            icon="document-text"
            value={stats.assignments || 0}
            label="Assignments"
            color="#7C3AED"
          />
          <StatCard
            icon="notifications"
            value={stats.unreadNotifications || 0}
            label="Unread"
            color="#DC2626"
          />
          {user?.role !== 'student' && (
            <StatCard
              icon="calendar-clear"
              value={stats.pendingLeaves || 0}
              label="Leaves"
              color="#F59E0B"
            />
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {user?.role !== 'student' && (
            <QuickActionCard
              icon="calendar"
              title="Attendance"
              subtitle="Mark Today"
              color="#4F46E5"
              onPress={() => router.push('/(app)/attendance')}
            />
          )}
          <QuickActionCard
            icon="time"
            title="Timetable"
            subtitle="View Schedule"
            color="#059669"
            onPress={() => router.push('/(app)/timetable')}
          />
          <QuickActionCard
            icon="document-text"
            title="Assignments"
            subtitle={user?.role === 'student' ? 'Submit' : 'Manage'}
            color="#7C3AED"
            onPress={() => router.push('/(app)/assignments')}
          />
          <QuickActionCard
            icon="notifications"
            title="Notifications"
            subtitle="View All"
            color="#DC2626"
            onPress={() => router.push('/(app)/notifications')}
          />
          {user?.role === 'student' && (
            <QuickActionCard
              icon="calendar-clear"
              title="Leave"
              subtitle="Apply Now"
              color="#F59E0B"
              onPress={() => router.push('/(app)/leave')}
            />
          )}
          {user?.role !== 'student' && (
            <QuickActionCard
              icon="calendar-clear"
              title="Leave"
              subtitle="Review"
              color="#F59E0B"
              onPress={() => router.push('/(app)/leave')}
            />
          )}
          {user?.role === 'principal' && (
            <>
              <QuickActionCard
                icon="people"
                title="Users"
                subtitle="Manage"
                color="#2563EB"
                onPress={() => router.push('/(app)/users')}
              />
              <QuickActionCard
                icon="school"
                title="Classes"
                subtitle="Manage"
                color="#059669"
                onPress={() => router.push('/(app)/classes')}
              />
              <QuickActionCard
                icon="list"
                title="Logs"
                subtitle="Activity"
                color="#64748B"
                onPress={() => router.push('/(app)/logs')}
              />
            </>
          )}
          <QuickActionCard
            icon="stats-chart"
            title="Marks"
            subtitle="Performance"
            color="#ec4899"
            onPress={() => router.push('/(app)/marks')}
          />
          {user?.role !== 'teacher' && (
            <QuickActionCard
              icon="wallet"
              title="Fees"
              subtitle="Payments"
              color="#f97316"
              onPress={() => router.push('/(app)/fees')}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 8,
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  classText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    flex: 1,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 4,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
