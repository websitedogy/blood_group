import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { emergencyService } from '../../services/emergencyService';
import {
  EmergencyRequest,
  UrgencyLevel,
  CreateEmergencyRequestParams,
} from '../../types/emergency';
import { BloodGroup } from '../../types/donor';
import { VALID_BLOOD_GROUPS } from '../../utils/validation';
import NotificationDispatchModal from '../../components/notifications/NotificationDispatchModal';

interface EmergencySosScreenProps {
  userId: string;
  defaultPhone?: string;
  onBack?: () => void;
}

export default function EmergencySosScreen({
  userId,
  defaultPhone,
  onBack,
}: EmergencySosScreenProps): React.JSX.Element {
  // Navigation / View Switcher
  const [activeView, setActiveView] = useState<'create' | 'feed'>('create');

  // Form State
  const [patientName, setPatientName] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [unitsNeeded, setUnitsNeeded] = useState<number>(1);
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [contactPhone, setContactPhone] = useState(defaultPhone || '');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('urgent');
  const [userConfirmed, setUserConfirmed] = useState(true);

  // Status & Request tracking
  const [submitting, setSubmitting] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [userRequests, setUserRequests] = useState<EmergencyRequest[]>([]);
  const [allPublicRequests, setAllPublicRequests] = useState<EmergencyRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedRequestIdForModal, setSelectedRequestIdForModal] = useState<string | null>(null);

  // Feed Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterBloodGroup, setSelectedFilterBloodGroup] = useState<string>('ALL');

  // Fetch active requests
  const loadData = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const [mine, pub] = await Promise.all([
        emergencyService.getUserRequests(userId),
        emergencyService.getAllPublicRequests(),
      ]);
      setUserRequests(mine);
      setAllPublicRequests(pub);
    } catch {
      setErrorMessage('Failed to load past requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle SOS Submission
  const handleSubmitSos = async () => {
    if (submitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const params: CreateEmergencyRequestParams = {
      patient_name: patientName,
      blood_group: bloodGroup,
      units_needed: unitsNeeded,
      hospital_name: hospitalName,
      hospital_address: hospitalAddress,
      latitude: 17.385,
      longitude: 78.4867,
      contact_phone: contactPhone,
      urgency_level: urgencyLevel,
      is_ai_extracted: false,
      user_confirmed: userConfirmed,
    };

    const res = await emergencyService.createRequest(userId, params);
    setSubmitting(false);

    if (res.success && res.data) {
      setSuccessMessage(
        `🚨 AI Emergency Broadcast Dispatched! Request #${res.data.id.slice(0, 8)} is live across 4 channels.`
      );
      setPatientName('');
      setHospitalName('');
      setHospitalAddress('');
      setUnitsNeeded(1);
      loadData();
      setActiveView('feed');
    } else {
      setErrorMessage(res.error || 'Failed to submit emergency request.');
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async (requestId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = await emergencyService.cancelRequest(requestId, userId);
    if (res.success) {
      setSuccessMessage('Emergency request cancelled.');
      loadData();
    } else {
      setErrorMessage(res.error || 'Failed to cancel request.');
    }
  };

  // Handle Mark Blood Received
  const handleMarkBloodReceived = async (requestId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = await emergencyService.markBloodReceived(requestId);
    if (res.success) {
      setSuccessMessage('❤️ Blood Received! Donors have been notified and thanked!');
      loadData();
    } else {
      setErrorMessage(res.error || 'Failed to update request.');
    }
  };

  // Filtered public requests
  const filteredFeed = allPublicRequests.filter((req) => {
    const matchesGroup =
      selectedFilterBloodGroup === 'ALL' || req.blood_group === selectedFilterBloodGroup;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      req.patient_name.toLowerCase().includes(q) ||
      req.contact_phone.includes(q) ||
      req.hospital_name.toLowerCase().includes(q) ||
      req.blood_group.toLowerCase().includes(q);
    return matchesGroup && matchesSearch;
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Dashboard"
        >
          <Text style={styles.backButtonText}>← Back to Dashboard</Text>
        </TouchableOpacity>
      )}

      {/* 2027 AI Neural Status Badge */}
      <View style={styles.aiBadgeRow}>
        <View style={styles.pulseDot} />
        <Text style={styles.aiBadgeText}>AI EMERGENCY PROTOCOL v2.7 • READY</Text>
      </View>

      <Text style={styles.headerTitle} accessibilityRole="header">
        LIFELOOP AI
      </Text>
      <Text style={styles.headerSubtitle}>
        Autonomous Emergency Blood Dispatch & Spatial Matching
      </Text>

      {/* View Segment Switcher */}
      <View style={styles.viewSwitcher}>
        <TouchableOpacity
          style={[styles.switchTab, activeView === 'create' && styles.switchTabActive]}
          onPress={() => setActiveView('create')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Broadcast SOS form"
        >
          <Text style={[styles.switchTabText, activeView === 'create' && styles.switchTabTextActive]}>
            🚨 Broadcast SOS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchTab, activeView === 'feed' && styles.switchTabActive]}
          onPress={() => setActiveView('feed')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Live Requests Feed and Search"
        >
          <Text style={[styles.switchTabText, activeView === 'feed' && styles.switchTabTextActive]}>
            📡 Live Feed & Search ({allPublicRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

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

      {/* VIEW 1: CREATE EMERGENCY SOS */}
      {activeView === 'create' && (
        <>
          {/* AI Radar Status Banner */}
          <View style={styles.radarBanner}>
            <View style={styles.radarIconBox}>
              <Text style={styles.radarIcon}>⚡</Text>
            </View>
            <View style={styles.radarInfo}>
              <Text style={styles.radarTitle}>PostGIS AI Satellite Matching Active</Text>
              <Text style={styles.radarSubtitle}>
                10km Radius Scan • 4-Channel Parallel Dispatch Ready
              </Text>
            </View>
          </View>

          {/* SOS Form Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>New Emergency SOS Broadcast</Text>
              <View style={styles.liveTag}>
                <Text style={styles.liveTagText}>LIVE DISPATCH</Text>
              </View>
            </View>

            {/* Patient Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patient Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#64748b"
                value={patientName}
                onChangeText={setPatientName}
                editable={!submitting}
                accessibilityLabel="Patient full name input"
              />
            </View>

            {/* Required Blood Group */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Required Blood Group *</Text>
              <View style={styles.chipGrid}>
                {VALID_BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <TouchableOpacity
                      key={bg}
                      style={[styles.bloodChip, isSelected && styles.bloodChipSelected]}
                      onPress={() => setBloodGroup(bg)}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel={`Select required blood group ${bg}`}
                    >
                      <Text style={[styles.bloodChipText, isSelected && styles.bloodChipTextSelected]}>
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Units Needed */}
            <View style={styles.inputGroup}>
              <View style={styles.unitsHeaderRow}>
                <Text style={styles.label}>Units Needed (1 to 20)</Text>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>{unitsNeeded} Unit(s)</Text>
                </View>
              </View>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperButton, unitsNeeded <= 1 && styles.stepperDisabled]}
                  onPress={() => setUnitsNeeded((prev) => Math.max(1, prev - 1))}
                  disabled={submitting || unitsNeeded <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease units needed"
                >
                  <Text style={styles.stepperText}>- 1 Unit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepperButton, unitsNeeded >= 20 && styles.stepperDisabled]}
                  onPress={() => setUnitsNeeded((prev) => Math.min(20, prev + 1))}
                  disabled={submitting || unitsNeeded >= 20}
                  accessibilityRole="button"
                  accessibilityLabel="Increase units needed"
                >
                  <Text style={styles.stepperText}>+ 1 Unit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hospital Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apollo Hospitals / Gandhi Hospital"
                placeholderTextColor="#64748b"
                value={hospitalName}
                onChangeText={setHospitalName}
                editable={!submitting}
                accessibilityLabel="Hospital name input"
              />
            </View>

            {/* Hospital Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital Address / Locality *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Jubilee Hills, Hyderabad"
                placeholderTextColor="#64748b"
                value={hospitalAddress}
                onChangeText={setHospitalAddress}
                editable={!submitting}
                accessibilityLabel="Hospital address and location input"
              />
            </View>

            {/* Contact Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Attendant Contact Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#64748b"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                editable={!submitting}
                accessibilityLabel="Attendant contact phone number input"
              />
            </View>

            {/* Urgency Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Urgency Level *</Text>
              <View style={styles.urgencyRow}>
                {(['critical', 'urgent', 'standard'] as UrgencyLevel[]).map((lvl) => {
                  const isSelected = urgencyLevel === lvl;
                  const label =
                    lvl === 'critical'
                      ? '🚨 CRITICAL (<15m)'
                      : lvl === 'urgent'
                      ? '⚡ HIGH (<1h)'
                      : '🛡️ STANDARD (<4h)';
                  return (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.urgencyChip, isSelected && styles.urgencyChipSelected]}
                      onPress={() => setUrgencyLevel(lvl)}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel={`Select urgency level ${lvl}`}
                    >
                      <Text style={[styles.urgencyText, isSelected && styles.urgencyTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Mandatory Confirmation */}
            <TouchableOpacity
              style={styles.confirmRow}
              onPress={() => setUserConfirmed(!userConfirmed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: userConfirmed }}
              accessibilityLabel="I confirm all entered emergency details are accurate"
            >
              <View style={[styles.checkbox, userConfirmed && styles.checkboxChecked]}>
                {userConfirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.confirmText}>
                I confirm this emergency blood requirement is genuine and verified with the treating
                hospital.
              </Text>
            </TouchableOpacity>

            {/* 2027 Futuristic SOS Action Button */}
            <TouchableOpacity
              style={[styles.sosButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmitSos}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Broadcast Emergency SOS request"
            >
              {submitting ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.sosButtonText}>  ACTIVATING AI SATELLITE DISPATCH...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonFireIcon}>🚨</Text>
                  <View style={styles.buttonTextCol}>
                    <Text style={styles.sosButtonText}>BROADCAST EMERGENCY SOS</Text>
                    <Text style={styles.sosButtonSub}>Instant 10km spatial donor match & multi-channel alerts</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* VIEW 2: LIVE SOS FEED & SEARCH */}
      {activeView === 'feed' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Live Emergency Blood Stream</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.refreshBtn}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by patient name, mobile, hospital..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearch}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Blood Group Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedFilterBloodGroup === 'ALL' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilterBloodGroup('ALL')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilterBloodGroup === 'ALL' && styles.filterChipTextActive,
                ]}
              >
                ALL
              </Text>
            </TouchableOpacity>
            {VALID_BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[
                  styles.filterChip,
                  selectedFilterBloodGroup === bg && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilterBloodGroup(bg)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilterBloodGroup === bg && styles.filterChipTextActive,
                  ]}
                >
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Feed List */}
          {loadingRequests ? (
            <ActivityIndicator color="#ff2e56" style={{ marginVertical: 20 }} />
          ) : filteredFeed.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>No emergency requests matching your search.</Text>
              <Text style={styles.emptySubText}>Try clearing search terms or blood group filter.</Text>
            </View>
          ) : (
            filteredFeed.map((req) => {
              const isFulfilled = req.status === 'fulfilled';
              const isMine = req.requester_id === userId;

              return (
                <View
                  key={req.id}
                  style={[styles.requestItem, isFulfilled && styles.requestItemFulfilled]}
                >
                  <View style={styles.requestHeader}>
                    <View style={styles.requestHeaderLeft}>
                      <View style={styles.patientRow}>
                        <Text style={styles.requestPatient}>{req.patient_name}</Text>
                        {isMine && <Text style={styles.mineBadge}>YOU</Text>}
                      </View>
                      <Text style={styles.requestHospital}>🏥 {req.hospital_name}</Text>
                      <Text style={styles.requestAddress}>📍 {req.hospital_address}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isFulfilled
                          ? styles.badgeSuccess
                          : req.status === 'verified' || req.status === 'broadcasting'
                          ? styles.badgeVerified
                          : req.status === 'cancelled'
                          ? styles.badgeCancelled
                          : styles.badgePending,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {isFulfilled ? '❤️ BLOOD RECEIVED' : req.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pillRow}>
                    <View style={styles.infoPillBlood}>
                      <Text style={styles.infoPillLabel}>Blood Group</Text>
                      <Text style={styles.infoPillValueBlood}>{req.blood_group}</Text>
                    </View>
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillLabel}>Units</Text>
                      <Text style={styles.infoPillValue}>{req.units_needed}</Text>
                    </View>
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillLabel}>Urgency</Text>
                      <Text style={styles.infoPillValue}>{req.urgency_level.toUpperCase()}</Text>
                    </View>
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillLabel}>Attendant</Text>
                      <Text style={styles.infoPillValue}>{req.contact_phone}</Text>
                    </View>
                  </View>

                  <Text style={styles.requestTime}>
                    Dispatched: {new Date(req.created_at).toLocaleString()}
                  </Text>

                  {/* Actions */}
                  <View style={styles.actionBtnRow}>
                    {!isFulfilled ? (
                      <TouchableOpacity
                        style={styles.receivedBloodButton}
                        onPress={() => handleMarkBloodReceived(req.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Mark blood received and thank donors"
                      >
                        <Text style={styles.receivedBloodButtonText}>
                          ✅ Blood Received • Thank Donors
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.fulfilledBanner}>
                        <Text style={styles.fulfilledBannerText}>
                          ❤️ Blood Received • Donors Thanked & Honored!
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.statusViewButton}
                      onPress={() => setSelectedRequestIdForModal(req.id)}
                      accessibilityRole="button"
                      accessibilityLabel="View 4-channel dispatch status"
                    >
                      <Text style={styles.statusViewButtonText}>📡 4-Channel Status</Text>
                    </TouchableOpacity>

                    {isMine && !isFulfilled && req.status !== 'cancelled' && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelRequest(req.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel emergency request for ${req.patient_name}`}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* MY BROADCASTS SUMMARY (Always visible on Create tab) */}
      {activeView === 'create' && userRequests.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>My Recent Broadcasts</Text>
            <TouchableOpacity onPress={() => setActiveView('feed')}>
              <Text style={styles.viewAllText}>View All ({userRequests.length}) →</Text>
            </TouchableOpacity>
          </View>
          {userRequests.slice(0, 3).map((req) => (
            <View key={req.id} style={styles.miniItem}>
              <View style={styles.miniHeader}>
                <Text style={styles.miniPatient}>{req.patient_name} ({req.blood_group})</Text>
                <Text style={styles.miniStatus}>{req.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.miniSub}>{req.hospital_name} • {req.units_needed} unit(s)</Text>
            </View>
          ))}
        </View>
      )}

      <NotificationDispatchModal
        visible={!!selectedRequestIdForModal}
        requestId={selectedRequestIdForModal}
        onClose={() => setSelectedRequestIdForModal(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#080c14',
    flexGrow: 1,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#ff2e56',
    fontSize: 14,
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
    textAlign: 'center',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  switchTabActive: {
    backgroundColor: '#e11d48',
    shadowColor: '#ff2e56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  switchTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  switchTabTextActive: {
    color: '#ffffff',
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  radarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radarIcon: {
    fontSize: 18,
  },
  radarInfo: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
  },
  radarSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  clearSearch: {
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: '#ff2e56',
    borderColor: '#ff6b8b',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  refreshBtn: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  liveTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  liveTagText: {
    color: '#ff4d6d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#f8fafc',
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
  unitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  unitBadge: {
    backgroundColor: 'rgba(255, 46, 86, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 86, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unitBadgeText: {
    color: '#ff4d6d',
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
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  urgencyChip: {
    flex: 1,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  urgencyChipSelected: {
    backgroundColor: '#e11d48',
    borderColor: '#ff4d6d',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textAlign: 'center',
  },
  urgencyTextSelected: {
    color: '#ffffff',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: 'rgba(11, 15, 25, 0.6)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#64748b',
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#ff2e56',
    borderColor: '#ff2e56',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  confirmText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  sosButton: {
    backgroundColor: '#e11d48',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#ff2e56',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#ff4d6d',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonFireIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  buttonTextCol: {
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sosButtonSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  requestItem: {
    backgroundColor: '#0b0f19',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  requestItemFulfilled: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  requestHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestPatient: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  mineBadge: {
    marginLeft: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  requestHospital: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '600',
  },
  requestAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  infoPill: {
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoPillBlood: {
    backgroundColor: 'rgba(255, 46, 86, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 86, 0.3)',
  },
  infoPillLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  infoPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  infoPillValueBlood: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ff2e56',
  },
  requestTime: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  badgeVerified: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  actionBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  receivedBloodButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  receivedBloodButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  fulfilledBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  fulfilledBannerText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
  },
  statusViewButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: '#06b6d4',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusViewButtonText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cancelButtonText: {
    fontSize: 11,
    color: '#ff4d6d',
    fontWeight: '700',
  },
  viewAllText: {
    color: '#ff2e56',
    fontSize: 12,
    fontWeight: '700',
  },
  miniItem: {
    backgroundColor: '#0b0f19',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  miniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniPatient: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  miniStatus: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38bdf8',
  },
  miniSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
