import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { notificationService } from '../../services/notificationService';
import { NotificationDispatchSummary, NotificationChannelType } from '../../types/notification';

interface NotificationDispatchModalProps {
  visible: boolean;
  requestId: string | null;
  onClose: () => void;
}

export default function NotificationDispatchModal({
  visible,
  requestId,
  onClose,
}: NotificationDispatchModalProps): React.JSX.Element {
  const [summary, setSummary] = useState<NotificationDispatchSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSummary = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    const data = await notificationService.getDispatchSummary(requestId);
    setSummary(data);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    if (visible && requestId) {
      fetchSummary();
    }
  }, [visible, requestId, fetchSummary]);

  const channels: NotificationChannelType[] = ['whatsapp', 'sms', 'push', 'email'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle} accessibilityRole="header">
            4-Channel Dispatch Monitor
          </Text>
          <Text style={styles.requestSub}>Request #{requestId?.slice(0, 8)}</Text>

          {loading ? (
            <ActivityIndicator color="#dc2626" style={{ marginVertical: 24 }} />
          ) : summary ? (
            <ScrollView style={styles.scrollArea}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>{summary.total_jobs}</Text>
                  <Text style={styles.kpiLabel}>Total Jobs</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>{summary.sent}</Text>
                  <Text style={styles.kpiLabel}>Sent</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>{summary.delivered}</Text>
                  <Text style={styles.kpiLabel}>Delivered</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiVal, { color: '#ef4444' }]}>{summary.failed}</Text>
                  <Text style={styles.kpiLabel}>Failed</Text>
                </View>
              </View>

              <Text style={styles.sectionHeader}>Channel Status Breakdown</Text>
              {channels.map((ch) => {
                const stats = summary.by_channel[ch];
                return (
                  <View key={ch} style={styles.channelRow}>
                    <Text style={styles.channelName}>{ch.toUpperCase()}</Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.tagQueued}>Q: {stats?.queued || 0}</Text>
                      <Text style={styles.tagSent}>S: {stats?.sent || 0}</Text>
                      <Text style={styles.tagDelivered}>D: {stats?.delivered || 0}</Text>
                      <Text style={styles.tagFailed}>F: {stats?.failed || 0}</Text>
                    </View>
                  </View>
                );
              })}

              <View style={styles.safetyBox}>
                <Text style={styles.safetyText}>
                  Pre-dispatch Cancelled: {summary.cancelled_pre_dispatch} | Dead-Letter:{' '}
                  {summary.dead_letter}
                </Text>
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No notification jobs recorded for this request.</Text>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close notification dispatch monitor"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  requestSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollArea: {
    marginVertical: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagQueued: {
    fontSize: 11,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#4b5563',
  },
  tagSent: {
    fontSize: 11,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#1e40af',
  },
  tagDelivered: {
    fontSize: 11,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#065f46',
  },
  tagFailed: {
    fontSize: 11,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#b91c1c',
  },
  safetyBox: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 6,
    marginTop: 12,
  },
  safetyText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 16,
  },
  closeButton: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
