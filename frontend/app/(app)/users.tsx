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

interface User {
  user_id: string;
  email: string;
  name: string;
  role: string;
  assigned_class?: string;
  assigned_section?: string;
  roll_number?: string;
  admission_number?: string;
  mobile_number?: string;
  assigned_subjects?: { class_name: string; section: string; subject: string }[];
}

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'English', 'History', 'Geography', 'Computer Science',
];

interface ClassInfo {
  class_id: string;
  name: string;
  sections: string[];
}

// Platform-aware alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void
) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const confirmed = window.confirm(`${title}\n${message}`);
    if (confirmed) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: onConfirm, style: 'destructive' },
    ]);
  }
};

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editData, setEditData] = useState({
    role: 'student',
    assigned_class: '',
    assigned_section: '',
    assigned_subjects: [] as { class_name: string; section: string; subject: string }[],
  });

  const [addData, setAddData] = useState({
    email: '',
    name: '',
    role: 'student',
    assigned_class: '',
    assigned_section: '',
    roll_number: '',
    admission_number: '',
    mobile_number: '',
    assigned_subjects: [] as { class_name: string; section: string; subject: string }[],
  });

  useEffect(() => {
    loadUsers();
    loadClasses();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiRequest('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const response = await apiRequest('/api/classes');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded classes:', data.length);
        setClasses(data);
      } else {
        console.error('Load classes failed:', response.status);
      }
    } catch (error) {
      console.error('Load classes error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  // ---- EDIT USER ----
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditData({
      role: user.role,
      assigned_class: user.assigned_class || '',
      assigned_section: user.assigned_section || '',
      assigned_subjects: user.assigned_subjects || [],
    });
    setEditModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    if (editData.role === 'teacher' || editData.role === 'class_teacher') {
      const invalidSubjects = editData.assigned_subjects.filter(
        s => !s.class_name || !s.section || !s.subject
      );
      if (invalidSubjects.length > 0) {
        showAlert('Error', 'Please fill all fields (Class, Section, Subject) for each assigned subject.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await apiRequest(`/api/users/${selectedUser.user_id}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        showAlert('Success', 'User updated successfully');
        setEditModalVisible(false);
        loadUsers();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to update user');
      }
    } catch (error) {
      showAlert('Error', 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  // ---- ADD USER ----
  const openAddModal = () => {
    setAddData({
      email: '',
      name: '',
      role: 'student',
      assigned_class: '',
      assigned_section: '',
      roll_number: '',
      admission_number: '',
      mobile_number: '',
      assigned_subjects: [],
    });
    setAddModalVisible(true);
  };

  const handleAddUser = async () => {
    // Basic validation
    if (!addData.email || !addData.name) {
      showAlert('Error', 'Please fill in Name and Gmail');
      return;
    }

    // Role-based required field validation
    if (addData.role === 'student') {
      const missing = [];
      if (!addData.roll_number) missing.push('Roll Number');
      if (!addData.admission_number) missing.push('Admission Number');
      if (!addData.assigned_class) missing.push('Class');
      if (!addData.assigned_section) missing.push('Section');
      if (!addData.mobile_number) missing.push('Mobile Number');
      if (missing.length > 0) {
        showAlert('Error', `Missing required fields for student:\n${missing.join(', ')}`);
        return;
      }
    } else if (addData.role === 'class_teacher') {
      if (!addData.assigned_class || !addData.assigned_section) {
        showAlert('Error', 'Class Teacher must be assigned a Class and Section');
        return;
      }
      if (!addData.mobile_number) {
        showAlert('Error', 'Mobile Number is required');
        return;
      }
      const invalidSubjects = addData.assigned_subjects.filter(
        s => !s.class_name || !s.section || !s.subject
      );
      if (invalidSubjects.length > 0) {
        showAlert('Error', 'Please fill all fields (Class, Section, Subject) for each assigned subject.');
        return;
      }
    } else if (addData.role === 'teacher') {
      if (!addData.mobile_number) {
        showAlert('Error', 'Mobile Number is required');
        return;
      }
      const invalidSubjects = addData.assigned_subjects.filter(
        s => !s.class_name || !s.section || !s.subject
      );
      if (invalidSubjects.length > 0) {
        showAlert('Error', 'Please fill all fields (Class, Section, Subject) for each assigned subject.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        email: addData.email,
        name: addData.name,
        role: addData.role,
        mobile_number: addData.mobile_number || null,
        roll_number: addData.roll_number || null,
        admission_number: addData.admission_number || null,
      };
      if (addData.role !== 'teacher' && addData.assigned_class) {
        payload.assigned_class = addData.assigned_class;
        payload.assigned_section = addData.assigned_section || null;
      }
      if (addData.role === 'teacher' || addData.role === 'class_teacher') {
        payload.assigned_subjects = addData.assigned_subjects;
      }

      const response = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showAlert('Success', `User "${addData.name}" added as ${addData.role}`);
        setAddModalVisible(false);
        loadUsers();
      } else {
        const error = await response.json();
        showAlert('Error', error.detail || 'Failed to add user');
      }
    } catch (error) {
      showAlert('Error', 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  // ---- DELETE USER ----
  const handleDeleteUser = (user: User) => {
    if (user.role === 'principal') {
      showAlert('Error', 'Cannot delete a principal account');
      return;
    }

    showConfirm(
      'Delete User',
      `Are you sure you want to delete "${user.name}" (${user.email})?\n\nThis action cannot be undone.`,
      async () => {
        try {
          const response = await apiRequest(`/api/users/${user.user_id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            showAlert('Success', `User "${user.name}" deleted successfully`);
            loadUsers();
          } else {
            const error = await response.json();
            showAlert('Error', error.detail || 'Failed to delete user');
          }
        } catch (error) {
          showAlert('Error', 'Failed to delete user');
        }
      }
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'principal':
        return '#DC2626';
      case 'teacher':
        return '#2563EB';
      case 'class_teacher':
        return '#7C3AED';
      default:
        return '#059669';
    }
  };

  const getRoleIcon = (role: string): keyof typeof Ionicons.glyphMap => {
    switch (role) {
      case 'principal':
        return 'ribbon';
      case 'teacher':
        return 'school';
      case 'class_teacher':
        return 'clipboard';
      default:
        return 'person';
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'class_teacher') return 'Class Teacher';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getSectionsForClass = (className: string) => {
    const cls = classes.find(c => c.name === className);
    return cls?.sections || [];
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = selectedFilter === 'all' || u.role === selectedFilter;
    if (!matchesRole) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.mobile_number && u.mobile_number.toLowerCase().includes(q)) ||
      (u.admission_number && u.admission_number.toLowerCase().includes(q)) ||
      (u.roll_number && u.roll_number.toLowerCase().includes(q)) ||
      (u.assigned_class && u.assigned_class.toLowerCase().includes(q))
    );
  });

  const userCounts = {
    all: users.length,
    principal: users.filter(u => u.role === 'principal').length,
    teacher: users.filter(u => u.role === 'teacher').length,
    class_teacher: users.filter(u => u.role === 'class_teacher').length,
    student: users.filter(u => u.role === 'student').length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Manage Users, Roles & Designations</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="ribbon" size={20} color="#DC2626" />
          <Text style={[styles.statValue, { color: '#DC2626' }]}>
            {userCounts.principal}
          </Text>
          <Text style={styles.statLabel}>Principal</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="school" size={20} color="#2563EB" />
          <Text style={[styles.statValue, { color: '#2563EB' }]}>
            {userCounts.teacher}
          </Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="people" size={20} color="#059669" />
          <Text style={[styles.statValue, { color: '#059669' }]}>
            {userCounts.student}
          </Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Name, Email, Mobile, Roll #, Admission #..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {['all', 'principal', 'teacher', 'class_teacher', 'student'].map(filter => (
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
              {filter === 'all' ? 'All' : getRoleLabel(filter)}
              {' '}({(userCounts as any)[filter]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.usersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          filteredUsers.map(user => (
            <View key={user.user_id} style={styles.userCard}>
              <TouchableOpacity
                style={styles.userMainArea}
                onPress={() => openEditModal(user)}
              >
                <View style={styles.userInfo}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: getRoleColor(user.role) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={getRoleIcon(user.role)}
                      size={20}
                      color={getRoleColor(user.role)}
                    />
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    {user.mobile_number && (
                      <Text style={styles.userMeta}>📱 {user.mobile_number}</Text>
                    )}
                    {user.assigned_class && (
                      <Text style={styles.userClass}>
                        {user.assigned_class}
                        {user.assigned_section ? ` - ${user.assigned_section}` : ''}
                      </Text>
                    )}
                    {user.roll_number && (
                      <Text style={styles.userMeta}>Roll: {user.roll_number}</Text>
                    )}
                    {user.admission_number && (
                      <Text style={styles.userMeta}>Adm: {user.admission_number}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.userRoleArea}>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: getRoleColor(user.role) + '20' },
                    ]}
                  >
                    <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                      {getRoleLabel(user.role)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(user)}
                >
                  <Ionicons name="create-outline" size={18} color="#4F46E5" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                {user.role !== 'principal' && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteUser(user)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add User FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="person-add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ====== EDIT USER MODAL ====== */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User Designation</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.userPreview}>
                  <View
                    style={[
                      styles.previewAvatar,
                      { backgroundColor: getRoleColor(editData.role) + '20' },
                    ]}
                  >
                    <Text style={[styles.previewAvatarText, { color: getRoleColor(editData.role) }]}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.previewName}>{selectedUser.name}</Text>
                  <Text style={styles.previewEmail}>{selectedUser.email}</Text>
                </View>

                <Text style={styles.inputLabel}>Designation / Role</Text>
                <View style={styles.roleButtonsContainer}>
                  {['teacher', 'class_teacher', 'student'].map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleSelectButton,
                        editData.role === role && {
                          backgroundColor: getRoleColor(role),
                          borderColor: getRoleColor(role),
                        },
                      ]}
                      onPress={() => setEditData({ ...editData, role })}
                    >
                      <Ionicons
                        name={getRoleIcon(role)}
                        size={18}
                        color={editData.role === role ? '#FFFFFF' : getRoleColor(role)}
                      />
                      <Text
                        style={[
                          styles.roleSelectText,
                          editData.role === role && { color: '#FFFFFF' },
                        ]}
                      >
                        {getRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editData.role !== 'teacher' && editData.role !== 'principal' && (
                  <>
                    <Text style={styles.inputLabel}>Assigned Class</Text>
                    <View style={styles.inputWrapper}>
                      <Picker
                        selectedValue={editData.assigned_class}
                        onValueChange={(value) => {
                          const cls = classes.find(c => c.name === value);
                          setEditData({
                            ...editData,
                            assigned_class: value,
                            assigned_section: cls?.sections[0] || '',
                          });
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Not Assigned" value="" />
                        {classes.map(cls => (
                          <Picker.Item key={cls.class_id} label={cls.name} value={cls.name} />
                        ))}
                      </Picker>
                    </View>

                    {editData.assigned_class ? (
                      <>
                        <Text style={styles.inputLabel}>Section</Text>
                        <View style={styles.inputWrapper}>
                          <Picker
                            selectedValue={editData.assigned_section}
                            onValueChange={(value) => setEditData({ ...editData, assigned_section: value })}
                            style={styles.picker}
                          >
                            {getSectionsForClass(editData.assigned_class).map(section => (
                              <Picker.Item key={section} label={`Section ${section}`} value={section} />
                            ))}
                          </Picker>
                        </View>
                      </>
                    ) : null}
                  </>
                )}

                {(editData.role === 'teacher' || editData.role === 'class_teacher') && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>Assigned Subjects (Max 10) *</Text>
                    {editData.assigned_subjects.map((subj, index) => (
                      <View key={index} style={{ flexDirection: 'row', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                        <View style={[styles.inputWrapper, { flex: 1.2 }]}>
                          <Picker
                            selectedValue={subj.class_name}
                            style={styles.picker}
                            onValueChange={(val) => {
                              const newSubj = [...editData.assigned_subjects];
                              const cls = classes.find(c => c.name === val);
                              newSubj[index].class_name = val;
                              newSubj[index].section = cls?.sections[0] || '';
                              setEditData({ ...editData, assigned_subjects: newSubj });
                            }}>
                            <Picker.Item label="Class" value="" />
                            {classes.map(cls => <Picker.Item key={cls.class_id} label={cls.name} value={cls.name} />)}
                          </Picker>
                        </View>
                        <View style={[styles.inputWrapper, { flex: 0.9 }]}>
                          <Picker
                            selectedValue={subj.section}
                            style={styles.picker}
                            onValueChange={(val) => {
                              const newSubj = [...editData.assigned_subjects];
                              newSubj[index].section = val;
                              setEditData({ ...editData, assigned_subjects: newSubj });
                            }}>
                            <Picker.Item label="Sec" value="" />
                            {getSectionsForClass(subj.class_name).map(sec => <Picker.Item key={sec} label={sec} value={sec} />)}
                          </Picker>
                        </View>
                        <View style={[styles.inputWrapper, { flex: 1.5 }]}>
                          <Picker
                            selectedValue={subj.subject}
                            style={styles.picker}
                            onValueChange={(val) => {
                              const newSubj = [...editData.assigned_subjects];
                              newSubj[index].subject = val;
                              setEditData({ ...editData, assigned_subjects: newSubj });
                            }}>
                            <Picker.Item label="Subj" value="" />
                            {SUBJECTS.map(s => <Picker.Item key={s} label={s} value={s} />)}
                          </Picker>
                        </View>
                        <TouchableOpacity onPress={() => {
                          const newSubj = editData.assigned_subjects.filter((_, i) => i !== index);
                          setEditData({ ...editData, assigned_subjects: newSubj });
                        }}>
                          <Ionicons name="trash-outline" size={22} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {editData.assigned_subjects.length < 10 && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 8 }}
                        onPress={() => setEditData({
                          ...editData,
                          assigned_subjects: [...editData.assigned_subjects, { class_name: '', section: '', subject: '' }]
                        })}
                      >
                        <Ionicons name="add-circle" size={20} color="#4F46E5" />
                        <Text style={{ color: '#4F46E5', fontWeight: '600', marginLeft: 6 }}>Add Subject Option</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleUpdateUser}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====== ADD USER MODAL ====== */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New User</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={addData.name}
                onChangeText={(text) => setAddData({ ...addData, name: text })}
                placeholder="Enter full name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.textInput}
                value={addData.email}
                onChangeText={(text) => setAddData({ ...addData, email: text })}
                placeholder="Enter email address"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Designation / Role</Text>
              <View style={styles.roleButtonsContainer}>
                {['teacher', 'class_teacher', 'student'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleSelectButton,
                      addData.role === role && {
                        backgroundColor: getRoleColor(role),
                        borderColor: getRoleColor(role),
                      },
                    ]}
                    onPress={() => setAddData({ ...addData, role })}
                  >
                    <Ionicons
                      name={getRoleIcon(role)}
                      size={18}
                      color={addData.role === role ? '#FFFFFF' : getRoleColor(role)}
                    />
                    <Text
                      style={[
                        styles.roleSelectText,
                        addData.role === role && { color: '#FFFFFF' },
                      ]}
                    >
                      {getRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Mobile Number - required for all */}
              <Text style={styles.inputLabel}>Mobile Number *</Text>
              <TextInput
                style={styles.textInput}
                value={addData.mobile_number}
                onChangeText={(text) => setAddData({ ...addData, mobile_number: text })}
                placeholder="Enter mobile number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />

              {/* Student-only fields */}
              {addData.role === 'student' && (
                <>
                  <Text style={styles.inputLabel}>Roll Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={addData.roll_number}
                    onChangeText={(text) => setAddData({ ...addData, roll_number: text })}
                    placeholder="Enter roll number"
                    placeholderTextColor="#9CA3AF"
                  />

                  <Text style={styles.inputLabel}>Admission Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={addData.admission_number}
                    onChangeText={(text) => setAddData({ ...addData, admission_number: text })}
                    placeholder="Enter admission number"
                    placeholderTextColor="#9CA3AF"
                  />
                </>
              )}

              {addData.role !== 'teacher' && addData.role !== 'principal' && (
                <>
                  <Text style={styles.inputLabel}>Assigned Class{addData.role === 'student' || addData.role === 'class_teacher' ? ' *' : ''}</Text>
                  <View style={styles.inputWrapper}>
                    <Picker
                      selectedValue={addData.assigned_class}
                      onValueChange={(value) => {
                        const cls = classes.find(c => c.name === value);
                        setAddData({
                          ...addData,
                          assigned_class: value,
                          assigned_section: cls?.sections[0] || '',
                        });
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Not Assigned" value="" />
                      {classes.map(cls => (
                        <Picker.Item key={cls.class_id} label={cls.name} value={cls.name} />
                      ))}
                    </Picker>
                  </View>

                  {addData.assigned_class ? (
                    <>
                      <Text style={styles.inputLabel}>Section</Text>
                      <View style={styles.inputWrapper}>
                        <Picker
                          selectedValue={addData.assigned_section}
                          onValueChange={(value) => setAddData({ ...addData, assigned_section: value })}
                          style={styles.picker}
                        >
                          {getSectionsForClass(addData.assigned_class).map(section => (
                            <Picker.Item key={section} label={`Section ${section}`} value={section} />
                          ))}
                        </Picker>
                      </View>
                    </>
                  ) : null}
                </>
              )}

              {(addData.role === 'teacher' || addData.role === 'class_teacher') && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Assigned Subjects (Max 10) *</Text>
                  {addData.assigned_subjects.map((subj, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                      <View style={[styles.inputWrapper, { flex: 1.2 }]}>
                        <Picker
                          selectedValue={subj.class_name}
                          style={styles.picker}
                          onValueChange={(val) => {
                            const newSubj = [...addData.assigned_subjects];
                            const cls = classes.find(c => c.name === val);
                            newSubj[index].class_name = val;
                            newSubj[index].section = cls?.sections[0] || '';
                            setAddData({ ...addData, assigned_subjects: newSubj });
                          }}>
                          <Picker.Item label="Class" value="" />
                          {classes.map(cls => <Picker.Item key={cls.class_id} label={cls.name} value={cls.name} />)}
                        </Picker>
                      </View>
                      <View style={[styles.inputWrapper, { flex: 0.9 }]}>
                        <Picker
                          selectedValue={subj.section}
                          style={styles.picker}
                          onValueChange={(val) => {
                            const newSubj = [...addData.assigned_subjects];
                            newSubj[index].section = val;
                            setAddData({ ...addData, assigned_subjects: newSubj });
                          }}>
                          <Picker.Item label="Sec" value="" />
                          {getSectionsForClass(subj.class_name).map(sec => <Picker.Item key={sec} label={sec} value={sec} />)}
                        </Picker>
                      </View>
                      <View style={[styles.inputWrapper, { flex: 1.5 }]}>
                        <Picker
                          selectedValue={subj.subject}
                          style={styles.picker}
                          onValueChange={(val) => {
                            const newSubj = [...addData.assigned_subjects];
                            newSubj[index].subject = val;
                            setAddData({ ...addData, assigned_subjects: newSubj });
                          }}>
                          <Picker.Item label="Subj" value="" />
                          {SUBJECTS.map(s => <Picker.Item key={s} label={s} value={s} />)}
                        </Picker>
                      </View>
                      <TouchableOpacity onPress={() => {
                        const newSubj = addData.assigned_subjects.filter((_, i) => i !== index);
                        setAddData({ ...addData, assigned_subjects: newSubj });
                      }}>
                        <Ionicons name="trash-outline" size={22} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {addData.assigned_subjects.length < 10 && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 8 }}
                      onPress={() => setAddData({
                        ...addData,
                        assigned_subjects: [...addData.assigned_subjects, { class_name: '', section: '', subject: '' }]
                      })}
                    >
                      <Ionicons name="add-circle" size={20} color="#4F46E5" />
                      <Text style={{ color: '#4F46E5', fontWeight: '600', marginLeft: 6 }}>Add Subject Option</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, styles.addButton, loading && styles.submitButtonDisabled]}
              onPress={handleAddUser}
              disabled={loading}
            >
              <Ionicons name="person-add-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>
                {loading ? 'Adding...' : 'Add User'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal >
    </SafeAreaView >
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  userMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxHeight: 44,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
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
  usersList: {
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
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  userMainArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  userClass: {
    fontSize: 12,
    color: '#4F46E5',
    marginTop: 2,
  },
  userRoleArea: {
    alignItems: 'flex-end',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 13,
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
  userPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  previewEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  roleSelectText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
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
    backgroundColor: '#4F46E5',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#059669',
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
