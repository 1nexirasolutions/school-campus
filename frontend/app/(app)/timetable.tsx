import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiRequest } from '../../src/utils/api';
import { Picker } from '@react-native-picker/picker';

interface TimetableEntry {
  timetable_id: string;
  class_name: string;
  section: string;
  day: string;
  time_slot: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

interface ClassInfo {
  class_id: string;
  name: string;
  sections: string[];
}

interface Teacher {
  user_id: string;
  name: string;
  assigned_subjects?: { class_name: string; section: string; subject: string }[];
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '14:00-15:00',
  '15:00-16:00',
];
const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Geography',
  'Computer Science',
  'Physical Education',
  'Art',
];
const DURATIONS = ['30 min', '45 min', '1 hour', '1.5 hours', '2 hours'];

export default function TimetableScreen() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    day: DAYS[0],
    time_slot: TIME_SLOTS[0],
    duration: '1 hour',
    subject: SUBJECTS[0],
    teacher_id: '',
    teacher_name: '',
  });

  const isTeacherOrPrincipal = user?.role === 'teacher' || user?.role === 'class_teacher' || user?.role === 'principal';
  const canEditTimetable = user?.role === 'principal' || (user?.role === 'class_teacher' && user?.assigned_class === selectedClass && user?.assigned_section === selectedSection);

  useEffect(() => {
    loadClasses();
    if (isTeacherOrPrincipal) {
      loadTeachers();
    }
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadTimetable();
    } else if (user?.role === 'student' && user?.assigned_class) {
      setSelectedClass(user.assigned_class);
      setSelectedSection(user.assigned_section || '');
    }
  }, [selectedClass, selectedSection]);

  const loadClasses = async () => {
    try {
      const response = await apiRequest('/api/classes');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
        if (data.length > 0) {
          if (user?.role === 'student' && user?.assigned_class) {
            setSelectedClass(user.assigned_class);
            setSelectedSection(user.assigned_section || data[0].sections[0]);
          } else {
            setSelectedClass(data[0].name);
            setSelectedSection(data[0].sections[0] || '');
          }
        }
      }
    } catch (error) {
      console.error('Load classes error:', error);
    }
  };

  const loadTeachers = async () => {
    try {
      const response = await apiRequest('/api/users/teachers');
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
        if (data.length > 0) {
          setFormData(prev => ({
            ...prev,
            teacher_id: data[0].user_id,
            teacher_name: data[0].name,
          }));
        }
      }
    } catch (error) {
      console.error('Load teachers error:', error);
    }
  };

  const loadTimetable = async () => {
    try {
      const response = await apiRequest(
        `/api/timetable?class_name=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}`
      );
      if (response.ok) {
        const data = await response.json();
        setTimetable(data);
      }
    } catch (error) {
      console.error('Load timetable error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimetable();
    setRefreshing(false);
  };

  const handleAddEntry = async () => {
    if (!formData.teacher_id) {
      Alert.alert('Error', 'Please select an eligible teacher for this subject.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/api/timetable', {
        method: 'POST',
        body: JSON.stringify({
          class_name: selectedClass,
          section: selectedSection,
          ...formData,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Timetable entry added');
        setModalVisible(false);
        loadTimetable();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add entry');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/timetable/${entryId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                loadTimetable();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const getCurrentSections = () => {
    const currentClass = classes.find(c => c.name === selectedClass);
    return currentClass?.sections || [];
  };

  const filteredTimetable = timetable.filter(entry => entry.day === selectedDay);

  const formatDay = (day: string) => day.charAt(0).toUpperCase() + day.slice(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Timetable</Text>
        <Text style={styles.subtitle}>Class Schedule</Text>
      </View>

      {/* Class/Section Selector */}
      {isTeacherOrPrincipal && (
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
                    <Picker.Item key={cls.class_id} label={cls.name} value={cls.name} />
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
                    <Picker.Item key={section} label={section} value={section} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Day Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
      >
        {DAYS.map(day => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              selectedDay === day && styles.dayButtonActive,
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <Text
              style={[
                styles.dayButtonText,
                selectedDay === day && styles.dayButtonTextActive,
              ]}
            >
              {formatDay(day).slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timetable List */}
      <ScrollView
        style={styles.timetableList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredTimetable.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No classes scheduled</Text>
            <Text style={styles.emptySubtext}>for {formatDay(selectedDay)}</Text>
          </View>
        ) : (
          filteredTimetable
            .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
            .map((entry, index) => (
              <View key={entry.timetable_id} style={styles.entryCard}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{entry.time_slot.split('-')[0]}</Text>
                  <View style={styles.timeLine} />
                  <Text style={styles.timeTextEnd}>{entry.time_slot.split('-')[1]}</Text>
                </View>
                <View style={styles.entryContent}>
                  <Text style={styles.subjectText}>{entry.subject}</Text>
                  <View style={styles.teacherRow}>
                    <Ionicons name="person" size={14} color="#6B7280" />
                    <Text style={styles.teacherText}>{entry.teacher_name}</Text>
                  </View>
                </View>
                {canEditTimetable && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteEntry(entry.timetable_id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Button */}
      {canEditTimetable && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Timetable Entry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Day</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.day}
                  onValueChange={(value) => setFormData({ ...formData, day: value })}
                  style={styles.picker}
                >
                  {DAYS.map(day => (
                    <Picker.Item key={day} label={formatDay(day)} value={day} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Time Slot</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.time_slot}
                  onValueChange={(value) => setFormData({ ...formData, time_slot: value })}
                  style={styles.picker}
                >
                  {TIME_SLOTS.map(slot => (
                    <Picker.Item key={slot} label={slot} value={slot} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Duration</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.duration}
                  onValueChange={(value) => setFormData({ ...formData, duration: value })}
                  style={styles.picker}
                >
                  {DURATIONS.map(d => (
                    <Picker.Item key={d} label={d} value={d} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Subject</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.subject}
                  onValueChange={(value) => {
                    const eligible = teachers.filter(t => {
                      if (!t.assigned_subjects) return false;
                      return t.assigned_subjects.some(sub =>
                        sub.class_name === selectedClass &&
                        sub.section === selectedSection &&
                        sub.subject === value
                      );
                    });
                    setFormData({
                      ...formData,
                      subject: value,
                      teacher_id: eligible.length > 0 ? eligible[0].user_id : '',
                      teacher_name: eligible.length > 0 ? eligible[0].name : '',
                    });
                  }}
                  style={styles.picker}
                >
                  {SUBJECTS.map(subject => (
                    <Picker.Item key={subject} label={subject} value={subject} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Teacher</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.teacher_id}
                  onValueChange={(value) => {
                    const teacher = teachers.find(t => t.user_id === value);
                    setFormData({
                      ...formData,
                      teacher_id: value,
                      teacher_name: teacher?.name || '',
                    });
                  }}
                  style={styles.picker}
                >
                  {teachers
                    .filter(t => {
                      if (!t.assigned_subjects) return false;
                      return t.assigned_subjects.some(sub =>
                        sub.class_name === selectedClass &&
                        sub.section === selectedSection &&
                        sub.subject === formData.subject
                      );
                    })
                    .map(teacher => (
                      <Picker.Item
                        key={teacher.user_id}
                        label={teacher.name}
                        value={teacher.user_id}
                      />
                    ))}
                  {teachers.filter(t => {
                    if (!t.assigned_subjects) return false;
                    return t.assigned_subjects.some(sub =>
                      sub.class_name === selectedClass &&
                      sub.section === selectedSection &&
                      sub.subject === formData.subject
                    );
                  }).length === 0 && (
                      <Picker.Item label="No eligible teachers found" value="" />
                    )}
                </Picker>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleAddEntry}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Adding...' : 'Add Entry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  daySelector: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxHeight: 50,
  },
  dayButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
  timetableList: {
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
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeColumn: {
    alignItems: 'center',
    marginRight: 16,
    width: 50,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  timeTextEnd: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  entryContent: {
    flex: 1,
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  teacherText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
