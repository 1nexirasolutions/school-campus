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
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiRequest, formatDateTime } from '../../src/utils/api';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import UniversalDatePicker from '../../src/components/UniversalDatePicker';

interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  class_name: string;
  section: string;
  subject: string;
  deadline: string;
  pdf_data?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface Submission {
  submission_id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  submitted_at: string;
}

interface ClassInfo {
  class_id: string;
  name: string;
  sections: string[];
}

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Geography',
  'Computer Science',
];

export default function AssignmentsScreen() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class_name: '',
    section: '',
    subject: SUBJECTS[0],
    deadline: '',
    pdf_data: '',
    mentor_id: '',
    mentor_name: '',
  });

  const [teachers, setTeachers] = useState<{ user_id: string; name: string }[]>([]);

  const getAvailableSubjects = () => {
    if (user?.role === 'principal') return SUBJECTS;
    if (user?.role === 'class_teacher' && user.assigned_class === formData.class_name) return SUBJECTS;
    return user?.assigned_subjects || [];
  };

  const isTeacherOrPrincipal = user?.role === 'teacher' || user?.role === 'class_teacher' || user?.role === 'principal';
  const isStudent = user?.role === 'student';

  const canModifyAssignment = (assignment: Assignment) => {
    if (user?.role === 'principal') return true;
    if (user?.role === 'teacher') {
      return user.assigned_subjects?.includes(assignment.subject);
    }
    if (user?.role === 'class_teacher') {
      return (user.assigned_class === assignment.class_name) || user.assigned_subjects?.includes(assignment.subject);
    }
    return false;
  };

  useEffect(() => {
    loadClasses();
    loadAssignments();
    if (isStudent) {
      loadSubmissions();
    }
    if (isTeacherOrPrincipal) {
      loadTeachersList();
    }
  }, []);

  const loadTeachersList = async () => {
    try {
      const response = await apiRequest('/api/users/teachers');
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error('Load teachers error:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const response = await apiRequest('/api/classes');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
        if (data.length > 0) {
          setFormData(prev => ({
            ...prev,
            class_name: data[0].name,
            section: data[0].sections[0] || '',
          }));
        }
      }
    } catch (error) {
      console.error('Load classes error:', error);
    }
  };

  const loadAssignments = async () => {
    try {
      const response = await apiRequest('/api/assignments');
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      }
    } catch (error) {
      console.error('Load assignments error:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const response = await apiRequest('/api/submissions');
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Load submissions error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAssignments();
    if (isStudent) {
      await loadSubmissions();
    }
    setRefreshing(false);
  };

  const pickDocument = async (isForSubmission: boolean = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size (10MB limit)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert('Error', 'File size exceeds 10MB limit');
          return;
        }

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (isForSubmission) {
          setSelectedPdf(base64);
        } else {
          setFormData(prev => ({ ...prev, pdf_data: base64 }));
        }

        Alert.alert('Success', `PDF selected: ${file.name}`);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const handleCreateAssignment = async () => {
    if (!formData.title || !formData.description || !formData.deadline) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        Alert.alert('Success', 'Assignment created');
        setModalVisible(false);
        setFormData({
          title: '',
          description: '',
          class_name: classes[0]?.name || '',
          section: classes[0]?.sections[0] || '',
          subject: SUBJECTS[0],
          deadline: '',
          pdf_data: '',
          mentor_id: '',
          mentor_name: '',
        });
        loadAssignments();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create assignment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedPdf || !selectedAssignment) {
      Alert.alert('Error', 'Please select a PDF file');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          assignment_id: selectedAssignment.assignment_id,
          pdf_data: selectedPdf,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Assignment submitted');
        setSubmitModalVisible(false);
        setSelectedPdf(null);
        setSelectedAssignment(null);
        loadSubmissions();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to submit assignment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    Alert.alert(
      'Delete Assignment',
      'Are you sure you want to delete this assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest(`/api/assignments/${assignmentId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                loadAssignments();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete assignment');
            }
          },
        },
      ]
    );
  };

  const getCurrentSections = () => {
    const currentClass = classes.find(c => c.name === formData.class_name);
    return currentClass?.sections || [];
  };

  const isSubmitted = (assignmentId: string) => {
    return submissions.some(s => s.assignment_id === assignmentId);
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Assignments</Text>
        <Text style={styles.subtitle}>
          {isTeacherOrPrincipal ? 'Manage Assignments' : 'Your Assignments'}
        </Text>
      </View>

      <ScrollView
        style={styles.assignmentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No assignments yet</Text>
          </View>
        ) : (
          assignments.map(assignment => {
            const submitted = isSubmitted(assignment.assignment_id);
            const deadlinePassed = isDeadlinePassed(assignment.deadline);

            return (
              <View key={assignment.assignment_id} style={styles.assignmentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{assignment.subject}</Text>
                  </View>
                  <View style={styles.classBadge}>
                    <Text style={styles.classText}>
                      {assignment.class_name} - {assignment.section}
                    </Text>
                  </View>
                </View>

                <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                <Text style={styles.assignmentDescription} numberOfLines={2}>
                  {assignment.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.deadlineContainer}>
                    <Ionicons
                      name="calendar"
                      size={16}
                      color={deadlinePassed ? '#DC2626' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.deadlineText,
                        deadlinePassed && styles.deadlinePassed,
                      ]}
                    >
                      Due: {assignment.deadline}
                    </Text>
                  </View>

                  <View style={styles.cardActions}>
                    {isStudent && (
                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          submitted && styles.submittedBtn,
                          deadlinePassed && !submitted && styles.disabledBtn,
                        ]}
                        onPress={() => {
                          if (!deadlinePassed && !submitted) {
                            setSelectedAssignment(assignment);
                            setSubmitModalVisible(true);
                          }
                        }}
                        disabled={deadlinePassed && !submitted}
                      >
                        <Ionicons
                          name={submitted ? 'checkmark-circle' : 'cloud-upload'}
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.submitBtnText}>
                          {submitted ? 'Submitted' : 'Submit'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {canModifyAssignment(assignment) && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteAssignment(assignment.assignment_id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.createdBy}>
                  <Text style={styles.createdByText}>
                    By: {assignment.created_by_name}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Button for Teachers/Principals */}
      {isTeacherOrPrincipal && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create Assignment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Assignment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Assignment title"
              />

              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Assignment description"
                multiline
                numberOfLines={4}
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Class</Text>
                  <View style={styles.inputWrapper}>
                    <Picker
                      selectedValue={formData.class_name}
                      onValueChange={(value) => {
                        const classInfo = classes.find(c => c.name === value);
                        setFormData({
                          ...formData,
                          class_name: value,
                          section: classInfo?.sections[0] || '',
                        });
                      }}
                      style={styles.picker}
                    >
                      {classes.map(cls => (
                        <Picker.Item color="#000" key={cls.class_id} label={cls.name} value={cls.name} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Section</Text>
                  <View style={styles.inputWrapper}>
                    <Picker
                      selectedValue={formData.section}
                      onValueChange={(value) => setFormData({ ...formData, section: value })}
                      style={styles.picker}
                    >
                      {getCurrentSections().map(section => (
                        <Picker.Item color="#000" key={section} label={section} value={section} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>Subject</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.subject}
                  onValueChange={(value) => setFormData({ ...formData, subject: value })}
                  style={styles.picker}
                >
                  {getAvailableSubjects().map((subject: string) => (
                    <Picker.Item color="#000" key={subject} label={subject} value={subject} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Assign Mentor (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Picker
                  selectedValue={formData.mentor_id}
                  onValueChange={(value) => {
                    const teacher = teachers.find(t => t.user_id === value);
                    setFormData({ ...formData, mentor_id: value, mentor_name: teacher?.name || '' });
                  }}
                  style={styles.picker}
                >
                  <Picker.Item color="#000" label="No Mentor" value="" />
                  {teachers.map(t => (
                    <Picker.Item color="#000" key={t.user_id} label={t.name} value={t.user_id} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Deadline *</Text>
              <UniversalDatePicker
                value={formData.deadline}
                onChange={(date) => setFormData({ ...formData, deadline: date })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>Attachment (PDF, optional)</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickDocument(false)}
              >
                <Ionicons name="cloud-upload" size={20} color="#4F46E5" />
                <Text style={styles.uploadButtonText}>
                  {formData.pdf_data ? 'PDF Selected' : 'Upload PDF'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateAssignment}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : 'Create Assignment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Submit Assignment Modal */}
      <Modal
        visible={submitModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSubmitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Assignment</Text>
              <TouchableOpacity onPress={() => setSubmitModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedAssignment && (
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentInfoTitle}>
                    {selectedAssignment.title}
                  </Text>
                  <Text style={styles.assignmentInfoSubject}>
                    {selectedAssignment.subject}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Upload Your Work (PDF only)</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickDocument(true)}
              >
                <Ionicons name="cloud-upload" size={20} color="#4F46E5" />
                <Text style={styles.uploadButtonText}>
                  {selectedPdf ? 'PDF Selected' : 'Select PDF File'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.uploadHint}>
                Maximum file size: 10MB
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || !selectedPdf) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitAssignment}
              disabled={loading || !selectedPdf}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Assignment'}
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
  assignmentsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
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
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  subjectBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4F46E5',
  },
  classBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  classText: {
    fontSize: 12,
    color: '#6B7280',
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  assignmentDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  deadlinePassed: {
    color: '#DC2626',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submittedBtn: {
    backgroundColor: '#059669',
  },
  disabledBtn: {
    backgroundColor: '#9CA3AF',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  createdBy: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  createdByText: {
    fontSize: 12,
    color: '#9CA3AF',
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
    maxHeight: '90%',
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
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: Platform.OS === 'android' ? 4 : 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'android' ? 50 : 44,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
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
  assignmentInfo: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  assignmentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  assignmentInfoSubject: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
