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
import UniversalDatePicker from '../../src/components/UniversalDatePicker';

interface LeaveApplication {
  leave_id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  section: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

// Platform-aware alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function LeaveScreen() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  });

  const isStudent = user?.role === 'student';
  const isTeacherOrPrincipal = user?.role === 'teacher' || user?.role === 'class_teacher' || user?.role === 'principal';

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    try {
      const response = await apiRequest('/api/leave');
      if (response.ok) {
        const data = await response.json();
        setLeaves(data);
      }
    } catch (error) {
      console.error('Load leaves error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaves();
    setRefreshing(false);
  };

  const handleApplyLeave = async () => {
    if (!formData.start_date || !formData.end_date || !formData.reason) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/api/leave', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showAlert('Success', 'Leave application submitted');
        setModalVisible(false);
        setFormData({ start_date: '', end_date: '', reason: '' });
        loadLeaves();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to apply leave');
      }
    } catch (error) {
      showAlert('Error', 'Failed to apply leave');
    } finally {
      setLoading(false);
    }
  };

  const doUpdateStatus = async (leaveId: string, status: string) => {
    try {
      const response = await apiRequest(`/api/leave/${leaveId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        showAlert('Success', `Leave ${status}`);
        loadLeaves();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to update');
      }
    } catch (error) {
      showAlert('Error', 'Failed to update leave status');
    }
  };

  const handleUpdateStatus = async (leaveId: string, status: string) => {
    const action = status === 'approved' ? 'Approve' : 'Reject';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`${action} Leave\nAre you sure?`);
      if (confirmed) {
        await doUpdateStatus(leaveId, status);
      }
    } else {
      Alert.alert(
        `${action} Leave`,
        'Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => doUpdateStatus(leaveId, status),
          },
        ]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#059669';
      case 'rejected':
        return '#DC2626';
      default:
        return '#F59E0B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    if (selectedFilter === 'all') return true;
    return leave.status === selectedFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysCount = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leave Management</Text>
        <Text style={styles.subtitle}>
          {isStudent ? 'Apply for Leave' : 'Review Leave Applications'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'pending', 'approved', 'rejected'].map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.leavesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredLeaves.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No leave applications</Text>
          </View>
        ) : (
          filteredLeaves.map(leave => (
            <View key={leave.leave_id} style={styles.leaveCard}>
              <View style={styles.cardHeader}>
                <View style={styles.studentInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {leave.student_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.studentName}>{leave.student_name}</Text>
                    {leave.class_name && (
                      <Text style={styles.classText}>
                        {leave.class_name} - {leave.section}
                      </Text>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(leave.status) + '20' },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(leave.status) as any}
                    size={14}
                    color={getStatusColor(leave.status)}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(leave.status) }]}>
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.dateSection}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>From</Text>
                  <Text style={styles.dateValue}>{formatDate(leave.start_date)}</Text>
                </View>
                <View style={styles.dateSeparator}>
                  <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
                  <Text style={styles.daysCount}>
                    {getDaysCount(leave.start_date, leave.end_date)} day(s)
                  </Text>
                </View>
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>To</Text>
                  <Text style={styles.dateValue}>{formatDate(leave.end_date)}</Text>
                </View>
              </View>

              <View style={styles.reasonSection}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{leave.reason}</Text>
              </View>

              {isTeacherOrPrincipal && leave.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleUpdateStatus(leave.leave_id, 'approved')}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleUpdateStatus(leave.leave_id, 'rejected')}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Apply Leave Button for Students */}
      {isStudent && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Apply Leave Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Start Date *</Text>
              <UniversalDatePicker
                value={formData.start_date}
                onChange={(date) => setFormData({ ...formData, start_date: date })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>End Date *</Text>
              <UniversalDatePicker
                value={formData.end_date}
                onChange={(date) => setFormData({ ...formData, end_date: date })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>Reason *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.reason}
                onChangeText={(text) => setFormData({ ...formData, reason: text })}
                placeholder="Enter reason for leave"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleApplyLeave}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Application'}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  leavesList: {
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
  leaveCard: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
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
  classText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dateBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  dateSeparator: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  daysCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  reasonSection: {
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
