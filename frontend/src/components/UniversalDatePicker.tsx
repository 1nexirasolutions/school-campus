import React, { useState } from 'react';
import { Platform, TouchableOpacity, Text, View, StyleSheet, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    value: string; // YYYY-MM-DD
    onChange: (dateObj: string) => void;
    placeholder?: string;
}

export default function UniversalDatePicker({ value, onChange, placeholder = "Select Date" }: Props) {
    const [show, setShow] = useState(false);

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShow(false);
        }
        if (selectedDate) {
            onChange(selectedDate.toISOString().split('T')[0]);
        }
    };

    const parsedDate = value ? new Date(value) : new Date();

    // For Web, provide a simple native date input fallback if needed
    if (Platform.OS === 'web') {
        return (
            <View style={styles.container}>
                <input
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E7EB', outline: 'none' }}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.inputBox} onPress={() => setShow(true)}>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <Text style={[styles.text, !value && styles.placeholder]}>
                    {value || placeholder}
                </Text>
            </TouchableOpacity>

            {show && (
                <DateTimePicker
                    value={parsedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}
            {Platform.OS === 'ios' && show && (
                <TouchableOpacity onPress={() => setShow(false)} style={{ alignItems: 'center', marginVertical: 8 }}>
                    <Text style={{ color: '#4F46E5', fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
    },
    text: {
        marginLeft: 10,
        fontSize: 16,
        color: '#1F2937',
    },
    placeholder: {
        color: '#9CA3AF',
    }
});
