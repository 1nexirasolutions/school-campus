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
import { apiRequest, formatDateTime } from '../../src/utils/api';
import { Picker } from '@react-native-picker/picker';

interface Notification {
  notification_id: string;
  title: string;
  message: string;
  target_type: string;
  target_class?: string;
  target_section?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  read_by: string[];
}

interface ClassInfo {
  class_id: string;
  name: string;
  sections: string[];
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPrincipal = user?.role === 'principal';
  const isPrincipalOrClassTeacher = user?.role === 'principal' || user?.role === 'class_teacher';

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target_type: 'all',
    target_class: '',
    target_section: '',
  });

  const [editFormData, setEditFormData] = useState({
    title: '',
    message: '',
    target_type: 'all',
    target_class: '',
    target_section: '',
  });

  useEffect(() => {
    loadNotifications();
    if (isPrincipalOrClassTeacher) {
      loadClasses();
    }
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await apiRequest('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
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
            target_class: data[0].name,
            target_section: data[0].sections[0] || '',
          }));
        }
      }
    } catch (error) {
      console.error('Load classes error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  const handleCreateNotification = async () => {
    if (!formData.title || !formData.message) {
      showAlert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        target_type: formData.target_type,
        target_class: formData.target_type === 'class' ? formData.target_class : null,
        target_section: formData.target_type === 'class' ? formData.target_section : null,
      };

      const response = await apiRequest('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert('Success', 'Notification sent');
        setModalVisible(false);
        setFormData({
          title: '',
          message: '',
          target_type: 'all',
          target_class: classes[0]?.name || '',
          target_section: classes[0]?.sections[0] || '',
        });
        loadNotifications();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to send notification');
      }
    } catch (error) {
      showAlert('Error', 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const handleEditNotification = (notification: Notification) => {
    setEditingNotification(notification);
    setEditFormData({
      title: notification.title,
      message: notification.message,
      target_type: notification.target_type,
      target_class: notification.target_class || classes[0]?.name || '',
      target_section: notification.target_section || '',
    });
    setEditModalVisible(true);
  };

  const handleUpdateNotification = async () => {
    if (!editingNotification || !editFormData.title || !editFormData.message) {
      showAlert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: editFormData.title,
        message: editFormData.message,
        target_type: editFormData.target_type,
        target_class: editFormData.target_type === 'class' ? editFormData.target_class : null,
        target_section: editFormData.target_type === 'class' ? editFormData.target_section : null,
      };

      const response = await apiRequest(`/api/notifications/${editingNotification.notification_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert('Success', 'Notification updated');
        setEditModalVisible(false);
        setEditingNotification(null);
        loadNotifications();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to update notification');
      }
    } catch (error) {
      showAlert('Error', 'Failed to update notification');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    const doDelete = async () => {
      try {
        const response = await apiRequest(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showAlert('Success', 'Notification deleted');
          loadNotifications();
        } else {
          const error = await response.json();
          showAlert('Error', error.detail || 'Failed to delete');
        }
      } catch (error) {
        showAlert('Error', 'Failed to delete notification');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Delete Notification\nAre you sure?')) doDelete();
    } else {
      Alert.alert('Delete Notification', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: doDelete, style: 'destructive' },
      ]);
    }
  };

  const isRead = (notification: Notification) => {
    return notification.read_by.includes(user?.user_id || '');
  };

  const getCurrentSections = () => {
    const currentClass = classes.find(c => c.name === formData.target_class);
    return currentClass?.sections || [];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getEditSections = () => {
    const currentClass = classes.find(c => c.name === editFormData.target_class);
    return currentClass?.sections || [];
  };

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'all': return 'All Students';
      case 'staff': return 'Staff Only';
      case 'class': return 'Specific Class';
      default: return type;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>
          {isPrincipalOrClassTeacher ? 'Send & View Alerts' : 'Your Alerts'}
        </Text>
      </View>

      <ScrollView
        style={styles.notificationsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.notification_id}
              style={[
                styles.notificationCard,
                !isRead(notification) && styles.unreadCard,
              ]}
              onPress={() => !isRead(notification) && handleMarkRead(notification.notification_id)}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.notificationIcon}>
                  <Ionicons
                    name={isRead(notification) ? 'notifications-outline' : 'notifications'}
                    size={20}
                    color={isRead(notification) ? '#9CA3AF' : '#4F46E5'}
                  />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={[
                    styles.notificationTitle,
                    !isRead(notification) && styles.unreadTitle,
                  ]}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                </View>
              </View>

              <View style={styles.notificationFooter}>
                <View style={styles.targetBadge}>
                  <Ionicons
                    name={notification.target_type === 'all' ? 'globe' : 'school'}
                    size={12}
                    color="#6B7280"
                  />
                  <Text style={styles.targetText}>
                    {notification.target_type === 'all'
                      ? 'All Students'
                      : `${notification.target_class}${notification.target_section ? ` - ${notification.target_section}` : ''}`}
                  </Text>
                </View>
                <Text style={styles.notificationTime}>
                  {formatDate(notification.created_at)}
                </Text>
              </View>

              <Text style={styles.senderText}>
                From: {notification.created_by_name}
              </Text>

              {/* Edit/Delete for Principal */}
              {isPrincipal && (
                <View style={styles.notificationActions}>
                  <TouchableOpacity
                    style={styles.editNotiButton}
                    onPress={() => handleEditNotification(notification)}
                  >
                    <Ionicons name="create-outline" size={16} color="#4F46E5" />
                    <Text style={styles.editNotiText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteNotiButton}
                    onPress={() => handleDeleteNotification(notification.notification_id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.deleteNotiText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Button for Principal/Class Teacher */}
      {isPrincipalOrClassTeacher && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create Notification Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Notification</Text>
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
                placeholder="Notification title"
              />

              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.message}
                onChangeText={(text) => setFormData({ ...formData, message: text })}
                placeholder="Notification message"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Target Audience</Text>
              <View style={styles.targetButtons}>
                <TouchableOpacity
                  style={[
                    styles.targetButton,
                    formData.target_type === 'all' && styles.targetButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, target_type: 'all' })}
                >
                  <Ionicons
                    name="globe"
                    size={20}
                    color={formData.target_type === 'all' ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.targetButtonText,
                      formData.target_type === 'all' && styles.targetButtonTextActive,
                    ]}
                  >
                    All Students
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.targetButton,
                    formData.target_type === 'staff' && styles.targetButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, target_type: 'staff' })}
                >
                  <Ionicons
                    name="briefcase"
                    size={20}
                    color={formData.target_type === 'staff' ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.targetButtonText,
                      formData.target_type === 'staff' && styles.targetButtonTextActive,
                    ]}
                  >
                    Staff
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.targetButton,
                    formData.target_type === 'class' && styles.targetButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, target_type: 'class' })}
                >
                  <Ionicons
                    name="school"
                    size={20}
                    color={formData.target_type === 'class' ? '#FFFFFF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.targetButtonText,
                      formData.target_type === 'class' && styles.targetButtonTextActive,
                    ]}
                  >
                    Class
                  </Text>
                </TouchableOpacity>
              </View>

              {formData.target_type === 'class' && (
                <View style={styles.classSelectors}>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>Class</Text>
                    <View style={styles.inputWrapper}>
                      <Picker
                        selectedValue={formData.target_class}
                        onValueChange={(value) => {
                          const classInfo = classes.find(c => c.name === value);
                          setFormData({
                            ...formData,
                            target_class: value,
                            target_section: classInfo?.sections[0] || '',
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
                    <Text style={styles.inputLabel}>Section (optional)</Text>
                    <View style={styles.inputWrapper}>
                      <Picker
                        selectedValue={formData.target_section}
                        onValueChange={(value) => setFormData({ ...formData, target_section: value })}
                        style={styles.picker}
                      >
                        <Picker.Item color="#000" label="All Sections" value="" />
                        {getCurrentSections().map(section => (
                          <Picker.Item color="#000" key={section} label={section} value={section} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateNotification}
              disabled={loading}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {loading ? 'Sending...' : 'Send Notification'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Notification Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Notification</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={editFormData.title}
                onChangeText={(text) => setEditFormData({ ...editFormData, title: text })}
                placeholder="Notification title"
              />

              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editFormData.message}
                onChangeText={(text) => setEditFormData({ ...editFormData, message: text })}
                placeholder="Notification message"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Target Audience</Text>
              <View style={styles.targetButtons}>
                {['all', 'staff', 'class'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.targetButton,
                      editFormData.target_type === type && styles.targetButtonActive,
                    ]}
                    onPress={() => setEditFormData({ ...editFormData, target_type: type })}
                  >
                    <Ionicons
                      name={type === 'all' ? 'globe' : type === 'staff' ? 'briefcase' : 'school'}
                      size={20}
                      color={editFormData.target_type === type ? '#FFFFFF' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.targetButtonText,
                        editFormData.target_type === type && styles.targetButtonTextActive,
                      ]}
                    >
                      {getTargetLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editFormData.target_type === 'class' && (
                <View style={styles.classSelectors}>
                  <View style={styles.halfInput}>
                    <Text style={styles.inputLabel}>Class</Text>
                    <View style={styles.inputWrapper}>
                      <Picker
                        selectedValue={editFormData.target_class}
                        onValueChange={(value) => {
                          const classInfo = classes.find(c => c.name === value);
                          setEditFormData({
                            ...editFormData,
                            target_class: value,
                            target_section: classInfo?.sections[0] || '',
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
                        selectedValue={editFormData.target_section}
                        onValueChange={(value) => setEditFormData({ ...editFormData, target_section: value })}
                        style={styles.picker}
                      >
                        <Picker.Item color="#000" label="All Sections" value="" />
                        {getEditSections().map(section => (
                          <Picker.Item color="#000" key={section} label={section} value={section} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleUpdateNotification}
              disabled={loading}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
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
  notificationsList: {
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
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  notificationHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  targetText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  senderText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editNotiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  editNotiText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  deleteNotiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  deleteNotiText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
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
    maxHeight: '85%',
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
  targetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  targetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  targetButtonActive: {
    backgroundColor: '#4F46E5',
  },
  targetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  targetButtonTextActive: {
    color: '#FFFFFF',
  },
  classSelectors: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
