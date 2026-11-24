import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { donorService } from '../../services/donorService';
import {
  DonorProfile,
  DonorResponseRecord,
  BloodGroup,
  NotificationChannel,
} from '../../types/donor';
import { VALID_BLOOD_GROUPS, VALID_NOTIFICATION_CHANNELS } from '../../utils/validation';
import EmergencySosScreen from '../emergency/EmergencySosScreen';

interface DonorDashboardScreenProps {
  userId: string;
  phone?: string;
  onLogout?: () => void;
}

export default function DonorDashboardScreen({
  userId,
  phone,
  onLogout,
}: DonorDashboardScreenProps): React.JSX.Element {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [history, setHistory] = useState<DonorResponseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodGroup>('O+');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewingSos, setViewingSos] = useState<boolean>(false);

  // Load donor profile and response history
  const loadDonorData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const p = await donorService.getDonorProfile(userId);
      const activeProfile: DonorProfile = p || {
        id: userId,
        user_id: userId,
        blood_group: 'O+',
        is_available: true,
        notifications_paused: false,
        notification_radius_km: 10,
        preferred_channels: ['whatsapp', 'sms', 'push'],
        last_donation_date: null,
        latitude: 17.385,
        longitude: 78.4867,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(activeProfile);
      setSelectedBloodGroup(activeProfile.blood_group);

      const h = await donorService.getResponseHistory(userId);
      setHistory(h);
    } catch {
      // Fallback active state
      const fallbackProfile: DonorProfile = {
        id: userId,
        user_id: userId,
        blood_group: 'O+',
        is_available: true,
        notifications_paused: false,
        notification_radius_km: 10,
        preferred_channels: ['whatsapp', 'sms', 'push'],
        last_donation_date: null,
        latitude: 17.385,
        longitude: 78.4867,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);
      setSelectedBloodGroup('O+');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDonorData();
  }, [loadDonorData]);

  // Handle save/create donor profile
  const handleSaveProfile = async (bg: BloodGroup) => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.saveDonorProfile(userId, {
      blood_group: bg,
      is_available: profile ? profile.is_available : true,
      notifications_paused: profile ? profile.notifications_paused : false,
      notification_radius_km: profile ? profile.notification_radius_km : 10,
      preferred_channels: profile ? profile.preferred_channels : ['whatsapp', 'sms', 'push'],
    });

    setActionLoading(false);
    if (res.success && res.data) {
      setProfile(res.data);
      setSelectedBloodGroup(res.data.blood_group);
      setSuccessMessage(`Donor profile updated with blood group ${bg}.`);
    } else {
      setErrorMessage(res.error || 'Failed to update blood group.');
    }
  };

  // Toggle availability
  const handleToggleAvailability = async () => {
    if (actionLoading) return;
    const currentAvailable = profile ? profile.is_available : false;
    const newState = !currentAvailable;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setAvailability(userId, newState);
    setActionLoading(false);
    if (res.success) {
      const updatedProfile: DonorProfile = profile
        ? { ...profile, is_available: newState }
        : {
            id: userId,
            user_id: userId,
            blood_group: selectedBloodGroup,
            is_available: newState,
            notifications_paused: false,
            notification_radius_km: 10,
            preferred_channels: ['whatsapp', 'sms', 'push'],
            last_donation_date: null,
            latitude: 17.385,
            longitude: 78.4867,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
      setProfile(updatedProfile);
      setSuccessMessage(
        newState ? '✓ You are now marked AVAILABLE for emergency alerts.' : 'You are marked UNAVAILABLE.'
      );
    } else {
      setErrorMessage(res.error || 'Failed to update availability.');
    }
  };

  // Toggle notifications pause
  const handleTogglePause = async () => {
    if (actionLoading) return;
    const currentPaused = profile ? profile.notifications_paused : false;
    const newPauseState = !currentPaused;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setNotificationsPaused(userId, newPauseState);
    setActionLoading(false);
    if (res.success) {
      const updatedProfile: DonorProfile = profile
        ? { ...profile, notifications_paused: newPauseState }
        : {
            id: userId,
            user_id: userId,
            blood_group: selectedBloodGroup,
            is_available: true,
            notifications_paused: newPauseState,
            notification_radius_km: 10,
            preferred_channels: ['whatsapp', 'sms', 'push'],
            last_donation_date: null,
            latitude: 17.385,
            longitude: 78.4867,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
      setProfile(updatedProfile);
      setSuccessMessage(
        newPauseState
          ? 'Emergency notifications PAUSED.'
          : '✓ Emergency notifications RESUMED.'
      );
    } else {
      setErrorMessage(res.error || 'Failed to update notification pause state.');
    }
  };

  // Adjust Radius
  const handleAdjustRadius = async (deltaKm: number) => {
    if (actionLoading) return;
    const current = profile ? profile.notification_radius_km : 10;
    const updated = Math.min(50, Math.max(1, current + deltaKm));
    if (updated === current) return;

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setNotificationRadius(userId, updated);
    setActionLoading(false);
    if (res.success && res.data !== undefined) {
      if (profile) {
        setProfile({ ...profile, notification_radius_km: res.data });
      }
      setSuccessMessage(`Notification radius adjusted to ${res.data} km.`);
    } else {
      setErrorMessage(res.error || 'Failed to update radius.');
    }
  };

  // Toggle Channel
  const handleToggleChannel = async (channel: NotificationChannel) => {
    if (actionLoading) return;
    const currentChannels = profile?.preferred_channels || ['whatsapp', 'sms', 'push'];
    const exists = currentChannels.includes(channel);

    let updatedChannels: NotificationChannel[];
    if (exists) {
      if (currentChannels.length === 1) {
        setErrorMessage('At least one notification channel must remain active.');
        return;
      }
      updatedChannels = currentChannels.filter((c) => c !== channel);
    } else {
      updatedChannels = [...currentChannels, channel];
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setPreferredChannels(userId, updatedChannels);
    setActionLoading(false);
    if (res.success && res.data) {
      if (profile) {
        setProfile({ ...profile, preferred_channels: res.data });
      }
      setSuccessMessage('Communication channels updated.');
    } else {
      setErrorMessage(res.error || 'Failed to update communication channels.');
    }
  };

  // Consent Withdrawal
  const handleWithdrawConsent = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.withdrawConsent(userId);
    setActionLoading(false);
    if (res.success) {
      if (profile) {
        setProfile({
          ...profile,
          is_available: false,
          notifications_paused: true,
        });
      }
      setSuccessMessage('Consent withdrawn. You will not receive emergency alerts.');
    } else {
      setErrorMessage(res.error || 'Failed to withdraw consent.');
    }
  };

  if (viewingSos) {
    return <EmergencySosScreen userId={userId} defaultPhone={phone} onBack={() => setViewingSos(false)} />;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff2e56" />
        <Text style={styles.loadingText}>Loading Donor Telemetry...</Text>
      </View>
    );
  }

  const isAvailable = profile ? profile.is_available : true;
  const isPaused = profile ? profile.notifications_paused : false;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 2027 AI Neural Status Badge */}
      <View style={styles.aiBadgeRow}>
        <View style={[styles.pulseDot, !isAvailable && styles.pulseDotOff]} />
        <Text style={styles.aiBadgeText}>
          {isAvailable ? 'AI DONOR MATCHING ACTIVE' : 'DONOR STANDBY MODE'}
        </Text>
      </View>

      <Text style={styles.headerTitle} accessibilityRole="header">
        Donor Hub
      </Text>
      <Text style={styles.headerSubtitle}>
        Manage your clinical blood group, availability & alert radius
      </Text>

      {/* Emergency SOS Quick Banner */}
      <TouchableOpacity
        style={styles.sosBannerButton}
        onPress={() => setViewingSos(true)}
        accessibilityRole="button"
        accessibilityLabel="Open Emergency Blood SOS Broadcast Screen"
      >
        <Text style={styles.sosBannerText}>🚨 NEED BLOOD? POST EMERGENCY SOS</Text>
      </TouchableOpacity>

      {errorMessage && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ {successMessage}</Text>
        </View>
      )}

      {/* Donor Overview Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Emergency Profile Status</Text>
          <View
            style={[
              styles.statusBadge,
              isAvailable ? styles.badgeSuccess : styles.badgeMuted,
            ]}
          >
            <Text style={styles.badgeText}>
              {isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Mobile Attendant:</Text>
          <Text style={styles.metaValue}>{phone || 'Not provided'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Registered Blood Group:</Text>
          <Text style={styles.boldRedText}>{profile?.blood_group || selectedBloodGroup}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Emergency Alerts:</Text>
          <Text style={styles.metaValue}>{isPaused ? '⏸️ Paused' : '⚡ Live Active'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>PostGIS Alert Radius:</Text>
          <Text style={styles.metaValue}>{profile?.notification_radius_km || 10} km</Text>
        </View>
      </View>

      {/* Emergency Availability & Pause Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Availability & Alert Controls</Text>
        <Text style={styles.sectionHelp}>
          Toggle your donation readiness to receive immediate emergency broadcasts:
        </Text>

        <TouchableOpacity
          style={[
            styles.actionButton,
            isAvailable ? styles.btnWarning : styles.btnSuccess,
          ]}
          onPress={handleToggleAvailability}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isAvailable
              ? 'Mark yourself unavailable for donations'
              : 'Mark yourself available for donations'
          }
        >
          {actionLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.actionButtonText}>
              {isAvailable ? '🔴 Switch to UNAVAILABLE' : '🟢 Switch to AVAILABLE'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.btnSecondary]}
          onPress={handleTogglePause}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isPaused
              ? 'Resume emergency alert notifications'
              : 'Pause emergency alert notifications'
          }
        >
          <Text style={styles.actionButtonTextSecondary}>
            {isPaused ? '▶️ Resume Notifications' : '⏸️ Pause Notifications'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Blood Group Selection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Blood Group Selection</Text>
        <Text style={styles.sectionHelp}>Tap your clinical blood type to update matching rules:</Text>
        <View style={styles.chipGrid}>
          {VALID_BLOOD_GROUPS.map((bg) => {
            const isSelected = selectedBloodGroup === bg;
            return (
              <TouchableOpacity
                key={bg}
                style={[styles.bloodChip, isSelected && styles.bloodChipSelected]}
                onPress={() => handleSaveProfile(bg)}
                disabled={actionLoading}
                accessibilityRole="button"
                accessibilityLabel={`Select blood group ${bg}`}
              >
                <Text style={[styles.bloodChipText, isSelected && styles.bloodChipTextSelected]}>
                  {bg}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notification Radius Controls */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Spatial Dispatch Radius</Text>
          <View style={styles.radiusPill}>
            <Text style={styles.radiusPillText}>{profile?.notification_radius_km || 10} km</Text>
          </View>
        </View>
        <Text style={styles.sectionHelp}>
          Receive instant emergency alerts within this geographic perimeter:
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => handleAdjustRadius(-5)}
            disabled={actionLoading || (profile?.notification_radius_km || 10) <= 1}
            accessibilityRole="button"
            accessibilityLabel="Decrease alert radius by 5 km"
          >
            <Text style={styles.stepperButtonText}>- 5 km</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => handleAdjustRadius(5)}
            disabled={actionLoading || (profile?.notification_radius_km || 10) >= 50}
            accessibilityRole="button"
            accessibilityLabel="Increase alert radius by 5 km"
          >
            <Text style={styles.stepperButtonText}>+ 5 km</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Communication Channel Preferences */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Multi-Channel Alert Dispatch</Text>
        <Text style={styles.sectionHelp}>Active channels to receive emergency donor alerts:</Text>
        <View style={styles.channelRow}>
          {VALID_NOTIFICATION_CHANNELS.map((ch) => {
            const isActive = profile?.preferred_channels?.includes(ch);
            const icon =
              ch === 'whatsapp' ? '💬' : ch === 'sms' ? '📱' : ch === 'email' ? '✉️' : '🔔';
            return (
              <TouchableOpacity
                key={ch}
                style={[styles.channelChip, isActive && styles.channelChipActive]}
                onPress={() => handleToggleChannel(ch)}
                disabled={actionLoading}
                accessibilityRole="button"
                accessibilityLabel={`Toggle notification channel ${ch}`}
              >
                <Text style={[styles.channelText, isActive && styles.channelTextActive]}>
                  {icon} {ch.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Response History Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Response Logs</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No emergency response history recorded yet.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyRequest}>Request #{item.request_id.slice(0, 8)}</Text>
                <Text style={styles.historyTime}>
                  {new Date(item.responded_at).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.response_status === 'accepted'
                    ? styles.badgeSuccess
                    : styles.badgeMuted,
                ]}
              >
                <Text style={styles.badgeText}>{item.response_status.toUpperCase()}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Consent Withdrawal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy & Consent</Text>
        <Text style={styles.sectionHelp}>
          Revoking consent stops all emergency notifications and marks your donor profile inactive.
        </Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleWithdrawConsent}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel="Withdraw emergency communication consent"
        >
          <Text style={styles.dangerButtonText}>Withdraw Consent</Text>
        </TouchableOpacity>
      </View>

      {/* Log out */}
      {onLogout && (
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out of application"
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#080c14',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080c14',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 8,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  pulseDotOff: {
    backgroundColor: '#64748b',
  },
  aiBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  sosBannerButton: {
    backgroundColor: '#e11d48',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#ff2e56',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#ff4d6d',
  },
  sosBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  sectionHelp: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  metaLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  boldRedText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ff2e56',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeMuted: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSuccess: {
    backgroundColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  btnWarning: {
    backgroundColor: '#b91c1c',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  btnSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionButtonTextSecondary: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    width: '22%',
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  bloodChipSelected: {
    backgroundColor: '#ff2e56',
    borderColor: '#ff6b8b',
    shadowColor: '#ff2e56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  bloodChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  bloodChipTextSelected: {
    color: '#ffffff',
  },
  radiusPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  radiusPillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  channelChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06b6d4',
  },
  channelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  channelTextActive: {
    color: '#38bdf8',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  historyRequest: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  historyTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#ff4d6d',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  logoutButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successText: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '600',
  },
});
