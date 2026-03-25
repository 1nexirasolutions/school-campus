import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, formatDate } from '../../src/utils/api';
import { useAuth } from '../../src/context/AuthContext';

interface ActivityLog {
    log_id: string;
    user_id: string;
    user_name: string;
    role: string;
    action: string;
    details?: string;
    created_at: string;
}

export default function LogsScreen() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const response = await apiRequest('/api/logs?limit=100');
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLogs();
        setRefreshing(false);
    };

    const getActionIcon = (action: string) => {
        if (action.includes('User')) return 'people';
        if (action.includes('Assignment')) return 'document-text';
        if (action.includes('Payment')) return 'wallet';
        if (action.includes('Leave')) return 'calendar';
        if (action.includes('Announcement')) return 'notifications';
        return 'information-circle';
    };

    const getActionColor = (action: string) => {
        if (action.includes('Created') || action.includes('Recorded')) return '#059669'; // Green
        if (action.includes('Updated')) return '#4F46E5'; // Blue
        if (action.includes('Deleted')) return '#DC2626'; // Red
        return '#6B7280'; // Gray
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerText]}>
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Activity Logs</Text>
                <Text style={styles.subtitle}>Track system modifications</Text>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {logs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="list" size={48} color="#9CA3AF" />
                        <Text style={styles.emptyText}>No activity logs found</Text>
                    </View>
                ) : (
                    logs.map((log) => (
                        <View key={log.log_id} style={styles.logCard}>
                            <View style={[styles.iconContainer, { backgroundColor: getActionColor(log.action) + '15' }]}>
                                <Ionicons name={getActionIcon(log.action) as any} size={20} color={getActionColor(log.action)} />
                            </View>

                            <View style={styles.logContent}>
                                <View style={styles.logHeader}>
                                    <Text style={styles.userName}>{log.user_name} ({log.role})</Text>
                                    <Text style={styles.timeText}>{new Date(log.created_at).toLocaleString()}</Text>
                                </View>

                                <Text style={styles.actionText}>{log.action}</Text>

                                {log.details && (
                                    <Text style={styles.detailsText}>{log.details}</Text>
                                )}
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centerText: { justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    content: { flex: 1, paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
    logCard: {
        flexDirection: 'row',
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
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    logContent: { flex: 1 },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    userName: { fontSize: 14, fontWeight: '600', color: '#374151' },
    timeText: { fontSize: 12, color: '#9CA3AF' },
    actionText: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
    detailsText: { fontSize: 13, color: '#6B7280' },
});
