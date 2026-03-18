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

interface ClassInfo {
    class_id: string;
    name: string;
    sections: string[];
}

const showAlert = (
    title: string,
    message: string,
    onConfirm?: () => void
) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (onConfirm) {
            if (window.confirm(`${title}\n${message}`)) {
                onConfirm();
            }
        } else {
            window.alert(`${title}\n${message}`);
        }
    } else {
        if (onConfirm) {
            Alert.alert(title, message, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: onConfirm, style: 'destructive' },
            ]);
        } else {
            Alert.alert(title, message);
        }
    }
};

export default function ClassesScreen() {
    const { user } = useAuth();
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // Form states
    const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
    const [className, setClassName] = useState('');
    const [sectionsInput, setSectionsInput] = useState('');

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            const response = await apiRequest('/api/classes');
            if (response.ok) {
                const data = await response.json();
                setClasses(data);
            }
        } catch (error) {
            console.error('Load classes error:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    const openAddModal = () => {
        setEditingClass(null);
        setClassName('');
        setSectionsInput('A, B, C');
        setModalVisible(true);
    };

    const openEditModal = (cls: ClassInfo) => {
        setEditingClass(cls);
        setClassName(cls.name);
        setSectionsInput(cls.sections.join(', '));
        setModalVisible(true);
    };

    const handleSaveClass = async () => {
        if (!className.trim()) {
            showAlert('Error', 'Class name is required');
            return;
        }

        const sections = sectionsInput
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (sections.length === 0) {
            showAlert('Error', 'At least one section is required');
            return;
        }

        setLoading(true);
        try {
            if (editingClass) {
                // Update existing
                const response = await apiRequest(`/api/classes/${editingClass.class_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        class_id: editingClass.class_id,
                        name: className.trim(),
                        sections,
                    }),
                });

                if (response.ok) {
                    showAlert('Success', 'Class updated successfully');
                    setModalVisible(false);
                    loadClasses();
                } else {
                    const data = await response.json();
                    showAlert('Error', data.detail || 'Failed to update class');
                }
            } else {
                // Create new
                const response = await apiRequest('/api/classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        class_id: '',
                        name: className.trim(),
                        sections,
                    }),
                });

                if (response.ok) {
                    showAlert('Success', 'Class added successfully');
                    setModalVisible(false);
                    loadClasses();
                } else {
                    const data = await response.json();
                    showAlert('Error', data.detail || 'Failed to create class');
                }
            }
        } catch (error) {
            console.error('Save class error:', error);
            showAlert('Error', 'Failed to save class');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClass = (classId: string, name: string) => {
        showAlert(
            'Delete Class',
            `Are you sure you want to delete ${name}? This cannot be undone.`,
            async () => {
                try {
                    const response = await apiRequest(`/api/classes/${classId}`, {
                        method: 'DELETE',
                    });

                    if (response.ok) {
                        showAlert('Success', 'Class deleted successfully');
                        loadClasses();
                    } else {
                        const data = await response.json();
                        showAlert('Error', data.detail || 'Failed to delete class');
                    }
                } catch (error) {
                    console.error('Delete class error:', error);
                    showAlert('Error', 'An error occurred while deleting the class');
                }
            }
        );
    };

    if (user?.role !== 'principal') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Access Denied</Text>
                </View>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>You don't have permission to view this page.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Manage Classes</Text>
                    <Text style={styles.subtitle}>{classes.length} Total</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Add Class</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {classes.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="school-outline" size={48} color="#9CA3AF" />
                        <Text style={styles.emptyText}>No classes found</Text>
                    </View>
                ) : (
                    classes.map((cls) => (
                        <View key={cls.class_id} style={styles.classCard}>
                            <View style={styles.classHeader}>
                                <View style={styles.classIcon}>
                                    <Ionicons name="school" size={24} color="#059669" />
                                </View>
                                <View style={styles.classInfo}>
                                    <Text style={styles.className}>{cls.name}</Text>
                                    <Text style={styles.sectionText}>
                                        {cls.sections.length} Sections: {cls.sections.join(', ')}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.cardActions}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.editButton]}
                                    onPress={() => openEditModal(cls)}
                                >
                                    <Ionicons name="pencil" size={16} color="#059669" />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteButton]}
                                    onPress={() => handleDeleteClass(cls.class_id, cls.name)}
                                >
                                    <Ionicons name="trash" size={16} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add / Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingClass ? 'Edit Class' : 'Add New Class'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Class Name *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={className}
                                    onChangeText={setClassName}
                                    placeholder="e.g. Class 12"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Sections (Comma separated) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={sectionsInput}
                                    onChangeText={setSectionsInput}
                                    placeholder="e.g. A, B, C"
                                />
                                <Text style={styles.helperText}>
                                    Separate multiple sections with commas
                                </Text>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton, loading && styles.saveButtonDisabled]}
                                onPress={handleSaveClass}
                                disabled={loading}
                            >
                                <Text style={styles.saveButtonText}>
                                    {loading ? 'Saving...' : 'Save Class'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#059669',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 6,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
        fontWeight: '500',
    },
    listContainer: {
        padding: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
    },
    classCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    classHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    classIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    classInfo: {
        flex: 1,
    },
    className: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    sectionText: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginLeft: 8,
    },
    editButton: {
        backgroundColor: '#ECFDF5',
    },
    editButtonText: {
        color: '#059669',
        fontWeight: '600',
        marginLeft: 4,
        fontSize: 14,
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalBody: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'android' ? 8 : 12,
        fontSize: 16,
        color: '#111827',
    },
    helperText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    cancelButtonText: {
        color: '#4B5563',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#059669',
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
