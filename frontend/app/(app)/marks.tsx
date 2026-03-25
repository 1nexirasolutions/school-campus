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

interface MarkEntry {
    mark_id: string;
    student_id: string;
    student_name: string;
    class_name: string;
    section: string;
    subject: string;
    exam_type: string;
    marks_obtained: number;
    total_marks: number;
    grade?: string;
    remarks?: string;
    entered_by: string;
    entered_by_name: string;
    created_at: string;
}

interface ClassInfo {
    class_id: string;
    name: string;
    sections: string[];
}

interface Student {
    user_id: string;
    name: string;
    assigned_class?: string;
    assigned_section?: string;
}

const SUBJECTS = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'English', 'History', 'Geography', 'Computer Science',
];

const EXAM_TYPES = [
    'Unit Test 1', 'Unit Test 2', 'Unit Test 3',
    'Mid Term', 'Final', 'Practice Test',
];

const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

export default function MarksScreen() {
    const { user } = useAuth();
    const [marks, setMarks] = useState<MarkEntry[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedExamType, setSelectedExamType] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);

    const isTeacherOrPrincipal = user?.role === 'teacher' || user?.role === 'class_teacher' || user?.role === 'principal';
    const isStudent = user?.role === 'student';

    const availableSubjects = user?.role === 'principal' ? SUBJECTS :
        (user?.role === 'class_teacher' && user.assigned_class === selectedClass) ? SUBJECTS :
            (user?.assigned_subjects || []);

    const [formData, setFormData] = useState({
        student_id: '',
        student_name: '',
        subject: availableSubjects.length > 0 ? availableSubjects[0] : SUBJECTS[0],
        exam_type: EXAM_TYPES[0],
        marks_obtained: '',
        total_marks: '100',
        remarks: '',
    });

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        if (selectedClass && selectedSection) {
            loadMarks();
            if (isTeacherOrPrincipal) {
                loadStudents();
            }
        }
    }, [selectedClass, selectedSection, selectedSubject, selectedExamType]);

    const loadClasses = async () => {
        try {
            const response = await apiRequest('/api/classes');
            if (response.ok) {
                const data = await response.json();
                setClasses(data);
                if (data.length > 0) {
                    if (isStudent && user?.assigned_class) {
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

    const loadStudents = async () => {
        if (!selectedClass) return;
        try {
            const response = await apiRequest(
                `/api/users/students?class_name=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}`
            );
            if (response.ok) {
                const data = await response.json();
                setStudents(data);
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, student_id: data[0].user_id, student_name: data[0].name }));
                }
            }
        } catch (error) {
            console.error('Load students error:', error);
        }
    };

    const loadMarks = async () => {
        try {
            let url = '/api/marks?';
            if (isStudent) {
                url += `student_id=${user?.user_id}`;
            } else {
                url += `class_name=${encodeURIComponent(selectedClass)}&section=${encodeURIComponent(selectedSection)}`;
            }
            if (selectedSubject) url += `&subject=${encodeURIComponent(selectedSubject)}`;
            if (selectedExamType) url += `&exam_type=${encodeURIComponent(selectedExamType)}`;

            const response = await apiRequest(url);
            if (response.ok) {
                const data = await response.json();
                setMarks(data);
            }
        } catch (error) {
            console.error('Load marks error:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadMarks();
        setRefreshing(false);
    };

    const handleAddMark = async () => {
        if (!formData.student_id || !formData.marks_obtained || !formData.total_marks) {
            showAlert('Error', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            const payload = [{
                student_id: formData.student_id,
                student_name: formData.student_name,
                class_name: selectedClass,
                section: selectedSection,
                subject: formData.subject,
                exam_type: formData.exam_type,
                marks_obtained: parseFloat(formData.marks_obtained),
                total_marks: parseFloat(formData.total_marks),
                remarks: formData.remarks || null,
            }];

            const response = await apiRequest('/api/marks', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                showAlert('Success', 'Marks saved successfully');
                setModalVisible(false);
                setFormData({
                    student_id: students[0]?.user_id || '',
                    student_name: students[0]?.name || '',
                    subject: SUBJECTS[0],
                    exam_type: EXAM_TYPES[0],
                    marks_obtained: '',
                    total_marks: '100',
                    remarks: '',
                });
                loadMarks();
            } else {
                const error = await response.json();
                showAlert('Error', error.detail || 'Failed to save marks');
            }
        } catch (error) {
            showAlert('Error', 'Failed to save marks');
        } finally {
            setLoading(false);
        }
    };

    const getGradeColor = (grade?: string) => {
        switch (grade) {
            case 'A+': return '#059669';
            case 'A': return '#10B981';
            case 'B+': return '#3B82F6';
            case 'B': return '#6366F1';
            case 'C': return '#F59E0B';
            case 'D': return '#F97316';
            case 'F': return '#DC2626';
            default: return '#6B7280';
        }
    };

    const getPercentage = (obtained: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((obtained / total) * 100);
    };

    const getCurrentSections = () => {
        const cls = classes.find(c => c.name === selectedClass);
        return cls?.sections || [];
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Academic Performance</Text>
                <Text style={styles.subtitle}>
                    {isStudent ? 'Your Marks & Grades' : 'Manage Student Marks'}
                </Text>
            </View>

            {/* Class/Section Selectors */}
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
                                        const cls = classes.find(c => c.name === value);
                                        if (cls) setSelectedSection(cls.sections[0] || '');
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
                                    {getCurrentSections().map(s => (
                                        <Picker.Item color="#000" key={s} label={s} value={s} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* Subject Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
                <TouchableOpacity
                    style={[styles.filterChip, !selectedSubject && styles.filterChipActive]}
                    onPress={() => setSelectedSubject('')}
                >
                    <Text style={[styles.filterChipText, !selectedSubject && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {SUBJECTS.map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.filterChip, selectedSubject === s && styles.filterChipActive]}
                        onPress={() => setSelectedSubject(s === selectedSubject ? '' : s)}
                    >
                        <Text style={[styles.filterChipText, selectedSubject === s && styles.filterChipTextActive]}>
                            {s}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Marks List */}
            <ScrollView
                style={styles.marksList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {marks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="stats-chart-outline" size={48} color="#9CA3AF" />
                        <Text style={styles.emptyText}>No marks recorded</Text>
                    </View>
                ) : (
                    marks.map(mark => (
                        <View key={mark.mark_id} style={styles.markCard}>
                            <View style={styles.markHeader}>
                                <View>
                                    <Text style={styles.studentNameText}>{mark.student_name}</Text>
                                    <Text style={styles.examTypeText}>{mark.exam_type}</Text>
                                </View>
                                <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(mark.grade) + '20' }]}>
                                    <Text style={[styles.gradeText, { color: getGradeColor(mark.grade) }]}>
                                        {mark.grade || 'N/A'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.markDetails}>
                                <View style={styles.subjectBadge}>
                                    <Ionicons name="book" size={12} color="#4F46E5" />
                                    <Text style={styles.subjectText}>{mark.subject}</Text>
                                </View>
                                <View style={styles.marksDisplay}>
                                    <Text style={styles.marksValue}>
                                        {mark.marks_obtained}/{mark.total_marks}
                                    </Text>
                                    <Text style={styles.percentageText}>
                                        ({getPercentage(mark.marks_obtained, mark.total_marks)}%)
                                    </Text>
                                </View>
                            </View>

                            {mark.remarks && (
                                <Text style={styles.remarksText}>📝 {mark.remarks}</Text>
                            )}

                            <Text style={styles.enteredByText}>
                                Entered by: {mark.entered_by_name}
                            </Text>
                        </View>
                    ))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Marks FAB */}
            {isTeacherOrPrincipal && availableSubjects.length > 0 && (
                <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            {/* Add Marks Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Marks</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Student *</Text>
                            <View style={styles.inputWrapper}>
                                <Picker
                                    selectedValue={formData.student_id}
                                    onValueChange={(value) => {
                                        const student = students.find(s => s.user_id === value);
                                        setFormData({ ...formData, student_id: value, student_name: student?.name || '' });
                                    }}
                                    style={styles.picker}
                                >
                                    {students.map(s => (
                                        <Picker.Item color="#000" key={s.user_id} label={s.name} value={s.user_id} />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={styles.inputLabel}>Subject</Text>
                            <View style={styles.inputWrapper}>
                                <Picker
                                    selectedValue={formData.subject}
                                    onValueChange={(value) => setFormData({ ...formData, subject: value })}
                                    style={styles.picker}
                                >
                                    {availableSubjects.map(s => (
                                        <Picker.Item color="#000" key={s} label={s} value={s} />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={styles.inputLabel}>Exam Type</Text>
                            <View style={styles.inputWrapper}>
                                <Picker
                                    selectedValue={formData.exam_type}
                                    onValueChange={(value) => setFormData({ ...formData, exam_type: value })}
                                    style={styles.picker}
                                >
                                    {EXAM_TYPES.map(e => (
                                        <Picker.Item color="#000" key={e} label={e} value={e} />
                                    ))}
                                </Picker>
                            </View>

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Marks Obtained *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={formData.marks_obtained}
                                        onChangeText={(text) => setFormData({ ...formData, marks_obtained: text })}
                                        placeholder="e.g. 85"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Total Marks *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={formData.total_marks}
                                        onChangeText={(text) => setFormData({ ...formData, total_marks: text })}
                                        placeholder="e.g. 100"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Remarks (Optional)</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                value={formData.remarks}
                                onChangeText={(text) => setFormData({ ...formData, remarks: text })}
                                placeholder="Any remarks..."
                                multiline
                                numberOfLines={3}
                                placeholderTextColor="#9CA3AF"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleAddMark}
                            disabled={loading}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Saving...' : 'Save Marks'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    filtersContainer: { paddingHorizontal: 20, paddingBottom: 8 },
    filterRow: { flexDirection: 'row', gap: 12 },
    pickerContainer: { flex: 1 },
    filterLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 4 },
    pickerWrapper: { backgroundColor: '#FFFFFF', borderRadius: Platform.OS === 'android' ? 4 : 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    picker: { height: Platform.OS === 'android' ? 50 : 44 },
    filterTabs: { paddingHorizontal: 16, marginBottom: 8, maxHeight: 44 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', marginHorizontal: 4, borderWidth: 1, borderColor: '#E5E7EB' },
    filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    filterChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
    filterChipTextActive: { color: '#FFFFFF' },
    marksList: { flex: 1, paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
    markCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    markHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    studentNameText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    examTypeText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    gradeBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
    gradeText: { fontSize: 16, fontWeight: '700' },
    markDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    subjectBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    subjectText: { fontSize: 12, fontWeight: '500', color: '#4F46E5' },
    marksDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    marksValue: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
    percentageText: { fontSize: 13, color: '#6B7280' },
    remarksText: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    enteredByText: { fontSize: 11, color: '#9CA3AF', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
    modalBody: { padding: 20 },
    inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 12 },
    inputWrapper: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    textInput: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, fontSize: 16 },
    textArea: { height: 80, textAlignVertical: 'top' },
    rowInputs: { flexDirection: 'row', gap: 12 },
    halfInput: { flex: 1 },
    submitButton: { backgroundColor: '#4F46E5', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
    submitButtonDisabled: { backgroundColor: '#9CA3AF' },
    submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
