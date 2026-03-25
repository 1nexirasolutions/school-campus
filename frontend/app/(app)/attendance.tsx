import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiRequest, formatDate } from '../../src/utils/api';
import { Picker } from '@react-native-picker/picker';
import UniversalDatePicker from '../../src/components/UniversalDatePicker';

// Platform-aware alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

interface Student {
  user_id: string;
  name: string;
  email: string;
  assigned_class: string;
  assigned_section: string;
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'absent';
}

interface ClassInfo {
  class_id: string;
  name: string;
  sections: string[];
}

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any[]>([]);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadStudents();
      loadExistingAttendance();
    }
  }, [selectedClass, selectedSection, selectedDate]);

  const loadClasses = async () => {
    try {
      const response = await apiRequest('/api/classes');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0].name);
          setSelectedSection(data[0].sections[0] || '');
        }
      }
    } catch (error) {
      console.error('Load classes error:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await apiRequest(
        `/api/users/students?class_name=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}`
      );
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
        // Initialize attendance state
        const initialAttendance: Record<string, 'present' | 'absent'> = {};
        data.forEach((student: Student) => {
          initialAttendance[student.user_id] = 'present';
        });
        setAttendance(initialAttendance);
      }
    } catch (error) {
      console.error('Load students error:', error);
    }
  };

  const loadExistingAttendance = async () => {
    try {
      const response = await apiRequest(
        `/api/attendance?class_name=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}&date=${selectedDate}`
      );
      if (response.ok) {
        const data = await response.json();
        setExistingAttendance(data);
        // Update attendance state with existing records
        const existingState: Record<string, 'present' | 'absent'> = {};
        data.forEach((record: any) => {
          existingState[record.student_id] = record.status;
        });
        if (Object.keys(existingState).length > 0) {
          setAttendance(prev => ({ ...prev, ...existingState }));
        }
      }
    } catch (error) {
      console.error('Load attendance error:', error);
    }
  };

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const markAllPresent = () => {
    const allPresent: Record<string, 'present' | 'absent'> = {};
    students.forEach(student => {
      allPresent[student.user_id] = 'present';
    });
    setAttendance(allPresent);
  };

  const markAllAbsent = () => {
    const allAbsent: Record<string, 'present' | 'absent'> = {};
    students.forEach(student => {
      allAbsent[student.user_id] = 'absent';
    });
    setAttendance(allAbsent);
  };

  const saveAttendance = async () => {
    if (students.length === 0) {
      showAlert('Error', 'No students to mark attendance for');
      return;
    }

    setLoading(true);
    try {
      const records = students.map(student => ({
        student_id: student.user_id,
        student_name: student.name,
        class_name: selectedClass,
        section: selectedSection,
        date: selectedDate,
        status: attendance[student.user_id] || 'present',
      }));

      const response = await apiRequest('/api/attendance', {
        method: 'POST',
        body: JSON.stringify(records),
      });

      if (response.ok) {
        showAlert('Success', 'Attendance saved successfully');
        loadExistingAttendance();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to save attendance');
      }
    } catch (error) {
      showAlert('Error', 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    await loadExistingAttendance();
    setRefreshing(false);
  };

  const getCurrentSections = () => {
    const currentClass = classes.find(c => c.name === selectedClass);
    return currentClass?.sections || [];
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>Teacher/Principal Dashboard</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <View style={styles.pickerContainer}>
            <Text style={styles.filterLabel}>Class</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(value) => {
                  setSelectedClass(value);
                  const classInfo = classes.find(c => c.name === value);
                  if (classInfo && classInfo.sections.length > 0) {
                    setSelectedSection(classInfo.sections[0]);
                  }
                }}
                style={styles.picker}
              >
                {classes.map(cls => (
                  <Picker.Item color="#000" key={cls.class_id} label={cls.name} value={cls.name} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.filterLabel}>Section</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedSection}
                onValueChange={setSelectedSection}
                style={styles.picker}
              >
                {getCurrentSections().map(section => (
                  <Picker.Item color="#000" key={section} label={section} value={section} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.dateContainer}>
          <Text style={styles.filterLabel}>Date</Text>
          <UniversalDatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
          />
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>{presentCount}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{absentCount}</Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#E0E7FF' }]}>
          <Text style={[styles.summaryValue, { color: '#4F46E5' }]}>{students.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickButton} onPress={markAllPresent}>
          <Text style={styles.quickButtonText}>Mark All Present</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickButton, styles.quickButtonAlt]}
          onPress={markAllAbsent}
        >
          <Text style={[styles.quickButtonText, styles.quickButtonTextAlt]}>Mark All Absent</Text>
        </TouchableOpacity>
      </View>

      {/* Students List */}
      <ScrollView
        style={styles.studentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No students found</Text>
            <Text style={styles.emptySubtext}>Select a class and section to view students</Text>
          </View>
        ) : (
          students.map(student => (
            <TouchableOpacity
              key={student.user_id}
              style={[
                styles.studentCard,
                attendance[student.user_id] === 'present'
                  ? styles.studentPresent
                  : styles.studentAbsent,
              ]}
              onPress={() => toggleAttendance(student.user_id)}
            >
              <View style={styles.studentInfo}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  attendance[student.user_id] === 'present'
                    ? styles.presentBadge
                    : styles.absentBadge,
                ]}
              >
                <Ionicons
                  name={attendance[student.user_id] === 'present' ? 'checkmark' : 'close'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Save Button */}
      {students.length > 0 && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={saveAttendance}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Attendance'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerContainer: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'android' ? 4 : 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'android' ? 50 : 44,
  },
  dateContainer: {
    marginTop: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#059669',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonAlt: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  quickButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  quickButtonTextAlt: {
    color: '#DC2626',
  },
  studentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  studentPresent: {
    borderColor: '#059669',
  },
  studentAbsent: {
    borderColor: '#DC2626',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  studentEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presentBadge: {
    backgroundColor: '#059669',
  },
  absentBadge: {
    backgroundColor: '#DC2626',
  },
  saveContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
