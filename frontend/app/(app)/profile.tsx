import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Platform,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiRequest } from '../../src/utils/api';

interface ProfileData {
    user_id: string;
    email: string;
    name: string;
    picture?: string;
    role: string;
    assigned_class?: string;
    assigned_section?: string;
    roll_number?: string;
    admission_number?: string;
    mobile_number?: string;
    created_at: string;
}

const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

export default function ProfileScreen() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [editData, setEditData] = useState({
        name: '',
        mobile_number: '',
        roll_number: '',
        admission_number: '',
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const response = await apiRequest('/api/profile');
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setEditData({
                    name: data.name || '',
                    mobile_number: data.mobile_number || '',
                    roll_number: data.roll_number || '',
                    admission_number: data.admission_number || '',
                });
            } else {
                // Fall back to auth context user data
                if (user) {
                    setProfile({
                        user_id: user.user_id,
                        email: user.email,
                        name: user.name,
                        picture: user.picture,
                        role: user.role,
                        assigned_class: user.assigned_class,
                        assigned_section: user.assigned_section,
                        roll_number: user.roll_number,
                        admission_number: user.admission_number,
                        mobile_number: user.mobile_number,
                        created_at: new Date().toISOString(),
                    });
                    setEditData({
                        name: user.name || '',
                        mobile_number: user.mobile_number || '',
                        roll_number: user.roll_number || '',
                        admission_number: user.admission_number || '',
                    });
                }
            }
        } catch (error) {
            console.error('Load profile error:', error);
            // Fall back to auth context user data
            if (user) {
                setProfile({
                    user_id: user.user_id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    role: user.role,
                    assigned_class: user.assigned_class,
                    assigned_section: user.assigned_section,
                    roll_number: user.roll_number,
                    admission_number: user.admission_number,
                    mobile_number: user.mobile_number,
                    created_at: new Date().toISOString(),
                });
                setEditData({
                    name: user.name || '',
                    mobile_number: user.mobile_number || '',
                    roll_number: user.roll_number || '',
                    admission_number: user.admission_number || '',
                });
            }
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProfile();
        setRefreshing(false);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload: any = {};
            if (editData.name && editData.name !== profile?.name) payload.name = editData.name;
            if (editData.mobile_number !== (profile?.mobile_number || '')) payload.mobile_number = editData.mobile_number;
            if (editData.roll_number !== (profile?.roll_number || '')) payload.roll_number = editData.roll_number;
            if (editData.admission_number !== (profile?.admission_number || '')) payload.admission_number = editData.admission_number;

            if (Object.keys(payload).length === 0) {
                showAlert('Info', 'No changes to save');
                setEditing(false);
                setLoading(false);
                return;
            }

            const response = await apiRequest('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                showAlert('Success', 'Profile updated successfully');
                setEditing(false);
                loadProfile();
            } else {
                const error = await response.json();
                showAlert('Error', error.detail || 'Failed to update profile');
            }
        } catch (error) {
            showAlert('Error', 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const confirmed = window.confirm('Logout\nAre you sure you want to logout?');
            if (confirmed) logout();
        } else {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', onPress: () => logout(), style: 'destructive' },
            ]);
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'principal': return '#DC2626';
            case 'teacher': return '#2563EB';
            case 'class_teacher': return '#7C3AED';
            default: return '#059669';
        }
    };

    const getRoleIcon = (role: string): keyof typeof Ionicons.glyphMap => {
        switch (role) {
            case 'principal': return 'ribbon';
            case 'teacher': return 'school';
            case 'class_teacher': return 'clipboard';
            default: return 'person';
        }
    };

    const getRoleLabel = (role: string) => {
        if (role === 'class_teacher') return 'Class Teacher';
        return role.charAt(0).toUpperCase() + role.slice(1);
    };

    if (!profile) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Profile Header */}
                <View style={styles.headerSection}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatar, { backgroundColor: getRoleColor(profile.role) + '20' }]}>
                            <Text style={[styles.avatarText, { color: getRoleColor(profile.role) }]}>
                                {profile.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(profile.role) }]}>
                            <Ionicons name={getRoleIcon(profile.role)} size={14} color="#FFFFFF" />
                            <Text style={styles.roleBadgeText}>{getRoleLabel(profile.role)}</Text>
                        </View>
                    </View>
                    <Text style={styles.profileName}>{profile.name}</Text>
                    <Text style={styles.profileEmail}>{profile.email}</Text>
                    <View style={styles.classChip}>
                        <Ionicons name="school-outline" size={14} color="#4F46E5" />
                        <Text style={styles.classChipText}>
                            {profile.assigned_class || 'No Class'} - {profile.assigned_section || 'No Section'}
                        </Text>
                    </View>
                </View>

                {/* Profile Details Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Profile Details</Text>
                        {!editing ? (
                            <TouchableOpacity style={styles.editToggleButton} onPress={() => setEditing(true)}>
                                <Ionicons name="create-outline" size={18} color="#4F46E5" />
                                <Text style={styles.editToggleText}>Edit</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.editToggleButton} onPress={() => {
                                setEditing(false);
                                setEditData({
                                    name: profile.name || '',
                                    mobile_number: profile.mobile_number || '',
                                    roll_number: profile.roll_number || '',
                                    admission_number: profile.admission_number || '',
                                });
                            }}>
                                <Ionicons name="close-outline" size={18} color="#DC2626" />
                                <Text style={[styles.editToggleText, { color: '#DC2626' }]}>Cancel</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Name */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="person-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Full Name</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editData.name}
                                    onChangeText={(text) => setEditData({ ...editData, name: text })}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#9CA3AF"
                                />
                            ) : (
                                <Text style={styles.fieldValue}>{profile.name}</Text>
                            )}
                        </View>
                    </View>

                    {/* Email (read-only) */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="mail-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Email (Gmail)</Text>
                            <Text style={styles.fieldValue}>{profile.email}</Text>
                        </View>
                    </View>

                    {/* Designation (read-only) */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name={getRoleIcon(profile.role)} size={20} color={getRoleColor(profile.role)} />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Designation</Text>
                            <View style={styles.designationRow}>
                                <View style={[styles.designationBadge, { backgroundColor: getRoleColor(profile.role) + '15' }]}>
                                    <Text style={[styles.designationText, { color: getRoleColor(profile.role) }]}>
                                        {getRoleLabel(profile.role)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Roll Number */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="id-card-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Roll Number</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editData.roll_number}
                                    onChangeText={(text) => setEditData({ ...editData, roll_number: text })}
                                    placeholder="Enter roll number"
                                    placeholderTextColor="#9CA3AF"
                                />
                            ) : (
                                <Text style={styles.fieldValue}>
                                    {profile.roll_number || 'Not set'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Admission Number */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="document-text-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Admission Number</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editData.admission_number}
                                    onChangeText={(text) => setEditData({ ...editData, admission_number: text })}
                                    placeholder="Enter admission number"
                                    placeholderTextColor="#9CA3AF"
                                />
                            ) : (
                                <Text style={styles.fieldValue}>
                                    {profile.admission_number || 'Not set'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Mobile Number */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="call-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Mobile Number</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editData.mobile_number}
                                    onChangeText={(text) => setEditData({ ...editData, mobile_number: text })}
                                    placeholder="Enter mobile number"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                />
                            ) : (
                                <Text style={styles.fieldValue}>
                                    {profile.mobile_number || 'Not set'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Class (read-only) */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="school-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Class</Text>
                            <Text style={styles.fieldValue}>
                                {profile.assigned_class || 'Not assigned'}
                            </Text>
                        </View>
                    </View>

                    {/* Section (read-only) */}
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldIconContainer}>
                            <Ionicons name="grid-outline" size={20} color="#6B7280" />
                        </View>
                        <View style={styles.fieldContent}>
                            <Text style={styles.fieldLabel}>Section</Text>
                            <Text style={styles.fieldValue}>
                                {profile.assigned_section || 'Not assigned'}
                            </Text>
                        </View>
                    </View>

                    {/* Save Button */}
                    {editing && (
                        <TouchableOpacity
                            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.saveButtonText}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Account Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Account</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                        <Text style={styles.infoText}>
                            Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                            })}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
    },

    // Header
    headerSection: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    roleBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    roleBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    classChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
        marginTop: 4,
    },
    classChipText: {
        fontSize: 13,
        color: '#4F46E5',
        fontWeight: '600',
    },

    // Cards
    card: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    editToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
    },
    editToggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4F46E5',
    },

    // Field Rows
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    fieldIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        marginTop: 2,
    },
    fieldContent: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldValue: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    fieldInput: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },

    // Designation
    designationRow: {
        flexDirection: 'row',
        marginTop: 2,
    },
    designationBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
    },
    designationText: {
        fontSize: 14,
        fontWeight: '700',
    },

    // Save Button
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4F46E5',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 20,
        gap: 8,
    },
    saveButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Account section
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#6B7280',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
    },
});
