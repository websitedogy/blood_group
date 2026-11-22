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
      if (p) {
        setProfile(p);
        setSelectedBloodGroup(p.blood_group);
      }
      const h = await donorService.getResponseHistory(userId);
      setHistory(h);
    } catch {
      setErrorMessage('Failed to load donor profile from server.');
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
      preferred_channels: profile ? profile.preferred_channels : ['push', 'sms'],
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
    if (!profile || actionLoading) return;
    const newState = !profile.is_available;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setAvailability(userId, newState);
    setActionLoading(false);
    if (res.success) {
      setProfile({ ...profile, is_available: newState });
      setSuccessMessage(
        newState ? 'You are now marked AVAILABLE for emergency alerts.' : 'You are marked UNAVAILABLE.'
      );
    } else {
      setErrorMessage(res.error || 'Failed to update availability.');
    }
  };

  // Toggle notifications pause
  const handleTogglePause = async () => {
    if (!profile || actionLoading) return;
    const newPauseState = !profile.notifications_paused;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setNotificationsPaused(userId, newPauseState);
    setActionLoading(false);
    if (res.success) {
      setProfile({ ...profile, notifications_paused: newPauseState });
      setSuccessMessage(
        newPauseState
          ? 'Emergency notifications PAUSED.'
          : 'Emergency notifications RESUMED.'
      );
    } else {
      setErrorMessage(res.error || 'Failed to update notification pause state.');
    }
  };

  // Adjust Radius
  const handleAdjustRadius = async (deltaKm: number) => {
    if (!profile || actionLoading) return;
    const current = profile.notification_radius_km;
    const updated = Math.min(50, Math.max(1, current + deltaKm));
    if (updated === current) return;

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await donorService.setNotificationRadius(userId, updated);
    setActionLoading(false);
    if (res.success && res.data !== undefined) {
      setProfile({ ...profile, notification_radius_km: res.data });
      setSuccessMessage(`Notification radius adjusted to ${res.data} km.`);
    } else {
      setErrorMessage(res.error || 'Failed to update radius.');
    }
  };

  // Toggle Channel
  const handleToggleChannel = async (channel: NotificationChannel) => {
    if (!profile || actionLoading) return;
    const currentChannels = profile.preferred_channels || [];
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
      setProfile({ ...profile, preferred_channels: res.data });
      setSuccessMessage('Communication channels updated.');
    } else {
      setErrorMessage(res.error || 'Failed to update communication channels.');
    }
  };

  // Withdraw Consent
  const handleWithdrawConsent = async () => {
    if (actionLoading) return;
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
      setSuccessMessage('Consent withdrawn. You will no longer receive emergency alerts.');
    } else {
      setErrorMessage(res.error || 'Failed to withdraw consent.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading Donor Dashboard...</Text>
      </View>
    );
  }

  if (viewingSos) {
    return (
      <EmergencySosScreen
        userId={userId}
        defaultPhone={phone}
        onBack={() => {
          setViewingSos(false);
          loadDonorData();
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle} accessibilityRole="header">
        Donor Control Center
      </Text>
      <Text style={styles.headerSubtitle}>
        Manage blood group, emergency availability & alert radius
      </Text>

      {/* Emergency SOS Banner Button */}
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
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Donor Overview Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Emergency Profile</Text>
          <View
            style={[
              styles.statusBadge,
              profile?.is_available ? styles.badgeSuccess : styles.badgeMuted,
            ]}
          >
            <Text style={styles.badgeText}>
              {profile?.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}
            </Text>
          </View>
        </View>

        <Text style={styles.infoRow}>Mobile: {phone || 'Not provided'}</Text>
        <Text style={styles.infoRow}>
          Current Blood Group: <Text style={styles.boldText}>{profile?.blood_group || 'Not Set'}</Text>
        </Text>
        <Text style={styles.infoRow}>
          Notifications:{' '}
          <Text style={styles.boldText}>
            {profile?.notifications_paused ? 'Paused' : 'Active'}
          </Text>
        </Text>
        <Text style={styles.infoRow}>
          Alert Radius: <Text style={styles.boldText}>{profile?.notification_radius_km || 10} km</Text>
        </Text>
      </View>

      {/* Blood Group Selection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Blood Group Selection</Text>
        <Text style={styles.sectionHelp}>Select and register your clinical blood group:</Text>
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

      {/* Emergency Availability & Pause Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Response Controls</Text>

        <TouchableOpacity
          style={[
            styles.actionButton,
            profile?.is_available ? styles.btnWarning : styles.btnSuccess,
          ]}
          onPress={handleToggleAvailability}
          disabled={actionLoading || !profile}
          accessibilityRole="button"
          accessibilityLabel={
            profile?.is_available
              ? 'Mark yourself unavailable for donations'
              : 'Mark yourself available for donations'
          }
        >
          <Text style={styles.actionButtonText}>
            {profile?.is_available ? 'Switch to UNAVAILABLE' : 'Switch to AVAILABLE'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.btnSecondary]}
          onPress={handleTogglePause}
          disabled={actionLoading || !profile}
          accessibilityRole="button"
          accessibilityLabel={
            profile?.notifications_paused
              ? 'Resume emergency alert notifications'
              : 'Pause emergency alert notifications'
          }
        >
          <Text style={styles.actionButtonTextSecondary}>
            {profile?.notifications_paused ? 'Resume Notifications' : 'Pause Notifications'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification Radius Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Alert Radius</Text>
        <Text style={styles.sectionHelp}>
          Receive alerts within: <Text style={styles.boldText}>{profile?.notification_radius_km || 10} km</Text>
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => handleAdjustRadius(-5)}
            disabled={actionLoading || !profile || (profile?.notification_radius_km || 10) <= 1}
            accessibilityRole="button"
            accessibilityLabel="Decrease alert radius by 5 km"
          >
            <Text style={styles.stepperButtonText}>- 5 km</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => handleAdjustRadius(5)}
            disabled={actionLoading || !profile || (profile?.notification_radius_km || 10) >= 50}
            accessibilityRole="button"
            accessibilityLabel="Increase alert radius by 5 km"
          >
            <Text style={styles.stepperButtonText}>+ 5 km</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Communication Channel Preferences */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Communication Preferences</Text>
        <Text style={styles.sectionHelp}>Select channels to receive urgent blood requests:</Text>
        <View style={styles.channelRow}>
          {VALID_NOTIFICATION_CHANNELS.map((ch) => {
            const isActive = profile?.preferred_channels?.includes(ch);
            return (
              <TouchableOpacity
                key={ch}
                style={[styles.channelChip, isActive && styles.channelChipActive]}
                onPress={() => handleToggleChannel(ch)}
                disabled={actionLoading || !profile}
                accessibilityRole="button"
                accessibilityLabel={`Toggle notification channel ${ch}`}
              >
                <Text style={[styles.channelText, isActive && styles.channelTextActive]}>
                  {ch.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Response History Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Response History</Text>
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
          You may revoke consent at any time. This stops all emergency alerts and marks your donor
          profile inactive.
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
    padding: 20,
    backgroundColor: '#f3f4f6',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4b5563',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  sosBannerButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sosBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  sectionHelp: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  infoRow: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  boldText: {
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#d1fae5',
  },
  badgeMuted: {
    backgroundColor: '#e5e7eb',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    width: '22%',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  bloodChipSelected: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  bloodChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  bloodChipTextSelected: {
    color: '#ffffff',
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSuccess: {
    backgroundColor: '#059669',
  },
  btnWarning: {
    backgroundColor: '#d97706',
  },
  btnSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  channelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  channelChipActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  channelText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  channelTextActive: {
    color: '#b91c1c',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyRequest: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  historyTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#4b5563',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  successBox: {
    backgroundColor: '#d1fae5',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  successText: {
    color: '#065f46',
    fontSize: 13,
  },
});
