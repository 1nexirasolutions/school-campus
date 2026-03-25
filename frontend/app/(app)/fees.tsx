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
import UniversalDatePicker from '../../src/components/UniversalDatePicker';

interface FeeStructure {
    fee_id: string;
    class_name: string;
    section?: string;
    fee_type: string;
    amount: number;
    installments: number;
    deadline: string;
    academic_year: string;
    created_by: string;
    created_at: string;
}

interface FeePayment {
    payment_id: string;
    fee_id: string;
    student_id: string;
    student_name: string;
    class_name: string;
    section: string;
    amount_paid: number;
    installment_number: number;
    mode_of_payment: string;
    status: string;
    remarks?: string;
    collected_by_name?: string;
    payment_date: string;
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

const FEE_TYPES = ['Tuition', 'Lab', 'Transport', 'Annual', 'Exam', 'Library', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Physical Appearance'];

const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

export default function FeesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'structure' | 'payments'>('structure');
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [payments, setPayments] = useState<FeePayment[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [structureModalVisible, setStructureModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedClass, setSelectedClass] = useState('');

    const isPrincipal = user?.role === 'principal';
    const isTeacherOrPrincipal = user?.role === 'teacher' || user?.role === 'class_teacher' || user?.role === 'principal';
    const isStudent = user?.role === 'student';

    const [feeFormData, setFeeFormData] = useState({
        class_name: '',
        section: '',
        fee_type: FEE_TYPES[0],
        amount: '',
        installments: '1',
        deadline: '',
        academic_year: '2025-2026',
    });

    const [paymentFormData, setPaymentFormData] = useState({
        fee_id: '',
        student_id: '',
        student_name: '',
        class_name: '',
        section: '',
        amount_paid: '',
        installment_number: '1',
        mode_of_payment: PAYMENT_MODES[0],
        remarks: '',
        payment_date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        loadClasses();
        loadFeeStructures();
        loadPayments();
    }, []);

    const loadClasses = async () => {
        try {
            const response = await apiRequest('/api/classes');
            if (response.ok) {
                const data = await response.json();
                setClasses(data);
                if (data.length > 0) {
                    setFeeFormData(prev => ({ ...prev, class_name: data[0].name, section: data[0].sections[0] || '' }));
                    setSelectedClass(data[0].name);
                }
            }
        } catch (error) {
            console.error('Load classes error:', error);
        }
    };

    const loadFeeStructures = async () => {
        try {
            const response = await apiRequest('/api/fees/structure');
            if (response.ok) {
                const data = await response.json();
                setFeeStructures(data);
            }
        } catch (error) {
            console.error('Load fee structures error:', error);
        }
    };

    const loadPayments = async () => {
        try {
            const response = await apiRequest('/api/fees/payments');
            if (response.ok) {
                const data = await response.json();
                setPayments(data);
            }
        } catch (error) {
            console.error('Load payments error:', error);
        }
    };

    const loadStudents = async (className: string, section: string) => {
        try {
            const response = await apiRequest(
                `/api/users/students?class_name=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`
            );
            if (response.ok) {
                const data = await response.json();
                setStudents(data);
                if (data.length > 0) {
                    setPaymentFormData(prev => ({
                        ...prev,
                        student_id: data[0].user_id,
                        student_name: data[0].name,
                        class_name: className,
                        section: section,
                    }));
                }
            }
        } catch (error) {
            console.error('Load students error:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFeeStructures(), loadPayments()]);
        setRefreshing(false);
    };

    const handleCreateFeeStructure = async () => {
        if (!feeFormData.amount || !feeFormData.deadline) {
            showAlert('Error', 'Please fill Amount and Deadline');
            return;
        }

        setLoading(true);
        try {
            const response = await apiRequest('/api/fees/structure', {
                method: 'POST',
                body: JSON.stringify({
                    ...feeFormData,
                    amount: parseFloat(feeFormData.amount),
                    installments: parseInt(feeFormData.installments),
                    section: feeFormData.section || null,
                }),
            });

            if (response.ok) {
                showAlert('Success', 'Fee structure created');
                setStructureModalVisible(false);
                loadFeeStructures();
            } else {
                const error = await response.json();
                showAlert('Error', error.detail || 'Failed to create fee structure');
            }
        } catch (error) {
            showAlert('Error', 'Failed to create fee structure');
        } finally {
            setLoading(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!paymentFormData.amount_paid || !paymentFormData.student_id || !paymentFormData.fee_id) {
            showAlert('Error', 'Please fill required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await apiRequest('/api/fees/payment', {
                method: 'POST',
                body: JSON.stringify({
                    ...paymentFormData,
                    amount_paid: parseFloat(paymentFormData.amount_paid),
                    installment_number: parseInt(paymentFormData.installment_number),
                }),
            });

            if (response.ok) {
                showAlert('Success', 'Payment recorded');
                setPaymentModalVisible(false);
                loadPayments();
            } else {
                const error = await response.json();
                showAlert('Error', error.detail || 'Failed to record payment');
            }
        } catch (error) {
            showAlert('Error', 'Failed to record payment');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFee = async (feeId: string) => {
        const doDelete = async () => {
            try {
                const response = await apiRequest(`/api/fees/structure/${feeId}`, { method: 'DELETE' });
                if (response.ok) {
                    showAlert('Success', 'Fee structure deleted');
                    loadFeeStructures();
                }
            } catch (error) {
                showAlert('Error', 'Failed to delete');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Delete this fee structure?')) doDelete();
        } else {
            Alert.alert('Delete', 'Delete this fee structure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', onPress: doDelete, style: 'destructive' },
            ]);
        }
    };

    const handleUpdatePaymentStatus = async (paymentId: string, status: string) => {
        try {
            const response = await apiRequest(`/api/fees/payment/${paymentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            if (response.ok) {
                showAlert('Success', `Payment ${status}`);
                loadPayments();
            }
        } catch (error) {
            showAlert('Error', 'Failed to update status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return '#059669';
            case 'rejected': return '#DC2626';
            default: return '#F59E0B';
        }
    };

    const getModeIcon = (mode: string): keyof typeof Ionicons.glyphMap => {
        switch (mode) {
            case 'Cash': return 'cash';
            case 'UPI': return 'phone-portrait';
            case 'Card': return 'card';
            default: return 'person';
        }
    };

    const getSectionsForClass = (className: string) => {
        const cls = classes.find(c => c.name === className);
        return cls?.sections || [];
    };

    const openPaymentModal = (fee: FeeStructure) => {
        setPaymentFormData(prev => ({
            ...prev,
            fee_id: fee.fee_id,
            class_name: fee.class_name,
            section: fee.section || '',
            amount_paid: fee.amount.toString(),
        }));
        loadStudents(fee.class_name, fee.section || '');
        setPaymentModalVisible(true);
    };

    const filteredStructures = feeStructures.filter(f =>
        !selectedClass || f.class_name === selectedClass
    );

    const filteredPayments = payments.filter(p =>
        !selectedClass || p.class_name === selectedClass
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Fee Management</Text>
                <Text style={styles.subtitle}>
                    {isPrincipal ? 'Financial Authority' : isStudent ? 'Your Fee Details' : 'Fee Collection'}
                </Text>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'structure' && styles.tabActive]}
                    onPress={() => setActiveTab('structure')}
                >
                    <Ionicons name="receipt" size={18} color={activeTab === 'structure' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[styles.tabText, activeTab === 'structure' && styles.tabTextActive]}>
                        Fee Structure
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
                    onPress={() => setActiveTab('payments')}
                >
                    <Ionicons name="wallet" size={18} color={activeTab === 'payments' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
                        Payments
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Class Filter */}
            {isTeacherOrPrincipal && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilter}>
                    <TouchableOpacity
                        style={[styles.classChip, !selectedClass && styles.classChipActive]}
                        onPress={() => setSelectedClass('')}
                    >
                        <Text style={[styles.classChipText, !selectedClass && styles.classChipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {classes.map(cls => (
                        <TouchableOpacity
                            key={cls.class_id}
                            style={[styles.classChip, selectedClass === cls.name && styles.classChipActive]}
                            onPress={() => setSelectedClass(cls.name === selectedClass ? '' : cls.name)}
                        >
                            <Text style={[styles.classChipText, selectedClass === cls.name && styles.classChipTextActive]}>
                                {cls.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {activeTab === 'structure' ? (
                    <>
                        {filteredStructures.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                                <Text style={styles.emptyText}>No fee structures</Text>
                            </View>
                        ) : (
                            filteredStructures.map(fee => (
                                <View key={fee.fee_id} style={styles.feeCard}>
                                    <View style={styles.feeHeader}>
                                        <View style={styles.feeTypeBadge}>
                                            <Text style={styles.feeTypeText}>{fee.fee_type}</Text>
                                        </View>
                                        <Text style={styles.feeAmount}>₹{fee.amount.toLocaleString()}</Text>
                                    </View>

                                    <View style={styles.feeDetails}>
                                        <View style={styles.feeDetail}>
                                            <Ionicons name="school" size={14} color="#6B7280" />
                                            <Text style={styles.feeDetailText}>
                                                {fee.class_name}{fee.section ? ` - ${fee.section}` : ' (All)'}
                                            </Text>
                                        </View>
                                        <View style={styles.feeDetail}>
                                            <Ionicons name="calendar" size={14} color="#6B7280" />
                                            <Text style={styles.feeDetailText}>Due: {fee.deadline}</Text>
                                        </View>
                                        <View style={styles.feeDetail}>
                                            <Ionicons name="layers" size={14} color="#6B7280" />
                                            <Text style={styles.feeDetailText}>
                                                {fee.installments} installment{fee.installments > 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                        <View style={styles.feeDetail}>
                                            <Ionicons name="time" size={14} color="#6B7280" />
                                            <Text style={styles.feeDetailText}>AY: {fee.academic_year}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.feeActions}>
                                        {isTeacherOrPrincipal && (
                                            <TouchableOpacity
                                                style={styles.collectButton}
                                                onPress={() => openPaymentModal(fee)}
                                            >
                                                <Ionicons name="wallet" size={16} color="#FFFFFF" />
                                                <Text style={styles.collectButtonText}>Collect</Text>
                                            </TouchableOpacity>
                                        )}
                                        {isPrincipal && (
                                            <TouchableOpacity
                                                style={styles.deleteFeeButton}
                                                onPress={() => handleDeleteFee(fee.fee_id)}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                ) : (
                    <>
                        {filteredPayments.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="wallet-outline" size={48} color="#9CA3AF" />
                                <Text style={styles.emptyText}>No payments recorded</Text>
                            </View>
                        ) : (
                            filteredPayments.map(payment => (
                                <View key={payment.payment_id} style={styles.paymentCard}>
                                    <View style={styles.paymentHeader}>
                                        <View>
                                            <Text style={styles.paymentName}>{payment.student_name}</Text>
                                            <Text style={styles.paymentClass}>
                                                {payment.class_name} - {payment.section}
                                            </Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                                            <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.paymentDetails}>
                                        <View style={styles.paymentDetail}>
                                            <Ionicons name="cash" size={16} color="#059669" />
                                            <Text style={styles.paymentAmountText}>₹{payment.amount_paid.toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.paymentDetail}>
                                            <Ionicons name={getModeIcon(payment.mode_of_payment)} size={16} color="#6B7280" />
                                            <Text style={styles.paymentDetailText}>{payment.mode_of_payment}</Text>
                                        </View>
                                        <View style={styles.paymentDetail}>
                                            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                                            <Text style={styles.paymentDetailText}>{payment.payment_date}</Text>
                                        </View>
                                    </View>

                                    {payment.remarks && (
                                        <Text style={styles.paymentRemarks}>📝 {payment.remarks}</Text>
                                    )}

                                    {isPrincipal && payment.status === 'submitted' && (
                                        <View style={styles.paymentActions}>
                                            <TouchableOpacity
                                                style={styles.verifyButton}
                                                onPress={() => handleUpdatePaymentStatus(payment.payment_id, 'verified')}
                                            >
                                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                                <Text style={styles.actionBtnText}>Verify</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.rejectButton}
                                                onPress={() => handleUpdatePaymentStatus(payment.payment_id, 'rejected')}
                                            >
                                                <Ionicons name="close" size={16} color="#FFFFFF" />
                                                <Text style={styles.actionBtnText}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {payment.collected_by_name && (
                                        <Text style={styles.collectedByText}>
                                            Collected by: {payment.collected_by_name}
                                        </Text>
                                    )}
                                </View>
                            ))
                        )}
                    </>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FAB */}
            {isPrincipal && activeTab === 'structure' && (
                <TouchableOpacity style={styles.fab} onPress={() => setStructureModalVisible(true)}>
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            {/* Create Fee Structure Modal */}
            <Modal
                visible={structureModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setStructureModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Fee Structure</Text>
                            <TouchableOpacity onPress={() => setStructureModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Fee Type</Text>
                            <View style={styles.inputWrapper}>
                                <Picker
                                    selectedValue={feeFormData.fee_type}
                                    onValueChange={(value) => setFeeFormData({ ...feeFormData, fee_type: value })}
                                    style={styles.picker}
                                >
                                    {FEE_TYPES.map(t => (
                                        <Picker.Item color="#000" key={t} label={t} value={t} />
                                    ))}
                                </Picker>
                            </View>

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Class</Text>
                                    <View style={styles.inputWrapper}>
                                        <Picker
                                            selectedValue={feeFormData.class_name}
                                            onValueChange={(value) => {
                                                const cls = classes.find(c => c.name === value);
                                                setFeeFormData({
                                                    ...feeFormData,
                                                    class_name: value,
                                                    section: cls?.sections[0] || '',
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
                                            selectedValue={feeFormData.section}
                                            onValueChange={(value) => setFeeFormData({ ...feeFormData, section: value })}
                                            style={styles.picker}
                                        >
                                            <Picker.Item color="#000" label="All Sections" value="" />
                                            {getSectionsForClass(feeFormData.class_name).map(s => (
                                                <Picker.Item color="#000" key={s} label={s} value={s} />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Amount (₹) *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={feeFormData.amount}
                                        onChangeText={(text) => setFeeFormData({ ...feeFormData, amount: text })}
                                        placeholder="e.g. 25000"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Installments</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={feeFormData.installments}
                                        onChangeText={(text) => setFeeFormData({ ...feeFormData, installments: text })}
                                        placeholder="1"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Deadline *</Text>
                            <UniversalDatePicker
                                value={feeFormData.deadline}
                                onChange={(date) => setFeeFormData({ ...feeFormData, deadline: date })}
                                placeholder="YYYY-MM-DD"
                            />

                            <Text style={styles.inputLabel}>Academic Year</Text>
                            <TextInput
                                style={styles.textInput}
                                value={feeFormData.academic_year}
                                onChangeText={(text) => setFeeFormData({ ...feeFormData, academic_year: text })}
                                placeholder="2025-2026"
                                placeholderTextColor="#9CA3AF"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleCreateFeeStructure}
                            disabled={loading}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Creating...' : 'Create Fee Structure'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Record Payment Modal */}
            <Modal
                visible={paymentModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Record Payment</Text>
                            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Student *</Text>
                            <View style={styles.inputWrapper}>
                                <Picker
                                    selectedValue={paymentFormData.student_id}
                                    onValueChange={(value) => {
                                        const student = students.find(s => s.user_id === value);
                                        setPaymentFormData({
                                            ...paymentFormData,
                                            student_id: value,
                                            student_name: student?.name || '',
                                        });
                                    }}
                                    style={styles.picker}
                                >
                                    {students.map(s => (
                                        <Picker.Item color="#000" key={s.user_id} label={s.name} value={s.user_id} />
                                    ))}
                                </Picker>
                            </View>

                            <View style={styles.rowInputs}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Amount (₹) *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={paymentFormData.amount_paid}
                                        onChangeText={(text) => setPaymentFormData({ ...paymentFormData, amount_paid: text })}
                                        placeholder="Amount"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.inputLabel}>Installment #</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={paymentFormData.installment_number}
                                        onChangeText={(text) => setPaymentFormData({ ...paymentFormData, installment_number: text })}
                                        placeholder="1"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Mode of Payment *</Text>
                            <View style={styles.modeButtons}>
                                {PAYMENT_MODES.map(mode => (
                                    <TouchableOpacity
                                        key={mode}
                                        style={[
                                            styles.modeButton,
                                            paymentFormData.mode_of_payment === mode && styles.modeButtonActive,
                                        ]}
                                        onPress={() => setPaymentFormData({ ...paymentFormData, mode_of_payment: mode })}
                                    >
                                        <Ionicons
                                            name={getModeIcon(mode)}
                                            size={18}
                                            color={paymentFormData.mode_of_payment === mode ? '#FFFFFF' : '#6B7280'}
                                        />
                                        <Text
                                            style={[
                                                styles.modeButtonText,
                                                paymentFormData.mode_of_payment === mode && styles.modeButtonTextActive,
                                            ]}
                                        >
                                            {mode}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Payment Date *</Text>
                            <UniversalDatePicker
                                value={paymentFormData.payment_date}
                                onChange={(text) => setPaymentFormData({ ...paymentFormData, payment_date: text })}
                                placeholder="YYYY-MM-DD"
                            />

                            <Text style={styles.inputLabel}>Remarks</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                value={paymentFormData.remarks}
                                onChangeText={(text) => setPaymentFormData({ ...paymentFormData, remarks: text })}
                                placeholder="Optional notes"
                                multiline
                                numberOfLines={3}
                                placeholderTextColor="#9CA3AF"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.submitButton, styles.paySubmitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleRecordPayment}
                            disabled={loading}
                        >
                            <Ionicons name="wallet" size={20} color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Recording...' : 'Record Payment'}
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
    tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginVertical: 12, backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
    tabActive: { backgroundColor: '#4F46E5' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    tabTextActive: { color: '#FFFFFF' },
    classFilter: { paddingHorizontal: 16, marginBottom: 8, maxHeight: 44 },
    classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', marginHorizontal: 4, borderWidth: 1, borderColor: '#E5E7EB' },
    classChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    classChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
    classChipTextActive: { color: '#FFFFFF' },
    content: { flex: 1, paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
    feeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    feeTypeBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    feeTypeText: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
    feeAmount: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
    feeDetails: { gap: 6, marginBottom: 12 },
    feeDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    feeDetailText: { fontSize: 13, color: '#6B7280' },
    feeActions: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    collectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, gap: 6 },
    collectButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
    deleteFeeButton: { padding: 10, borderRadius: 8, backgroundColor: '#FEF2F2' },
    paymentCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    paymentName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    paymentClass: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600' },
    paymentDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
    paymentDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    paymentAmountText: { fontSize: 16, fontWeight: '700', color: '#059669' },
    paymentDetailText: { fontSize: 13, color: '#6B7280' },
    paymentRemarks: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    paymentActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    verifyButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, gap: 6 },
    rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', paddingVertical: 10, borderRadius: 8, gap: 6 },
    actionBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
    collectedByText: { fontSize: 11, color: '#9CA3AF', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
    modalBody: { padding: 20 },
    inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 12 },
    inputWrapper: { backgroundColor: '#F9FAFB', borderRadius: Platform.OS === 'android' ? 4 : 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    textInput: { backgroundColor: '#F9FAFB', borderRadius: Platform.OS === 'android' ? 4 : 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: Platform.OS === 'android' ? 8 : 12, fontSize: 16 },
    textArea: { height: 80, textAlignVertical: 'top' },
    picker: { height: Platform.OS === 'android' ? 50 : 44 },
    rowInputs: { flexDirection: 'row', gap: 12 },
    halfInput: { flex: 1 },
    modeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    modeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', gap: 6 },
    modeButtonActive: { backgroundColor: '#4F46E5' },
    modeButtonText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
    modeButtonTextActive: { color: '#FFFFFF' },
    submitButton: { backgroundColor: '#4F46E5', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
    paySubmitButton: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    submitButtonDisabled: { backgroundColor: '#9CA3AF' },
    submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
