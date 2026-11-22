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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedRequestIdForModal, setSelectedRequestIdForModal] = useState<string | null>(null);

  // Fetch active requests
  const loadUserRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const requests = await emergencyService.getUserRequests(userId);
      setUserRequests(requests);
    } catch {
      setErrorMessage('Failed to load past requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserRequests();
  }, [loadUserRequests]);

  // Handle SOS Submission
  const handleSubmitSos = async () => {
    if (submitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    // Default coordinates: Hyderabad/Telangana center coordinates for testing
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
        `Emergency SOS Broadcast Created! Request #${res.data.id.slice(0, 8)} is pending verification.`
      );
      // Reset form
      setPatientName('');
      setHospitalName('');
      setHospitalAddress('');
      setUnitsNeeded(1);
      loadUserRequests();
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
      setSuccessMessage('Emergency request cancelled successfully.');
      loadUserRequests();
    } else {
      setErrorMessage(res.error || 'Failed to cancel request.');
    }
  };

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

      <Text style={styles.headerTitle} accessibilityRole="header">
        Emergency Blood SOS
      </Text>
      <Text style={styles.headerSubtitle}>
        Broadcast life-saving blood alerts to verified nearby donors
      </Text>

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

      {/* SOS Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>New Emergency Request</Text>

        {/* Patient Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Patient Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh Kumar"
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
          <Text style={styles.label}>Units Needed (1 to 20): {unitsNeeded} Unit(s)</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setUnitsNeeded((prev) => Math.max(1, prev - 1))}
              disabled={submitting || unitsNeeded <= 1}
              accessibilityRole="button"
              accessibilityLabel="Decrease units needed"
            >
              <Text style={styles.stepperText}>- 1 Unit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepperButton}
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
            value={hospitalAddress}
            onChangeText={setHospitalAddress}
            editable={!submitting}
            accessibilityLabel="Hospital address and location input"
          />
        </View>

        {/* Contact Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contact Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9876543210"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            editable={!submitting}
            accessibilityLabel="Attendant contact phone number input"
          />
        </View>

        {/* Urgency Level */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Urgency Level</Text>
          <View style={styles.urgencyRow}>
            {(['critical', 'urgent', 'standard'] as UrgencyLevel[]).map((lvl) => {
              const isSelected = urgencyLevel === lvl;
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
                    {lvl.toUpperCase()}
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
            I confirm that this emergency blood requirement is genuine and verified with the treating
            hospital.
          </Text>
        </TouchableOpacity>

        {/* Broadcast Button */}
        <TouchableOpacity
          style={[styles.sosButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmitSos}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Broadcast Emergency SOS request"
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.sosButtonText}>🚨 BROADCAST EMERGENCY SOS</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Requests List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Emergency Requests</Text>
        {loadingRequests ? (
          <ActivityIndicator color="#dc2626" style={{ marginVertical: 12 }} />
        ) : userRequests.length === 0 ? (
          <Text style={styles.emptyText}>No emergency requests submitted yet.</Text>
        ) : (
          userRequests.map((req) => (
            <View key={req.id} style={styles.requestItem}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestPatient}>{req.patient_name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    req.status === 'verified' || req.status === 'broadcasting'
                      ? styles.badgeVerified
                      : req.status === 'fulfilled'
                      ? styles.badgeSuccess
                      : req.status === 'cancelled'
                      ? styles.badgeCancelled
                      : styles.badgePending,
                  ]}
                >
                  <Text style={styles.badgeText}>{req.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.requestDetails}>
                Blood Group: <Text style={styles.bold}>{req.blood_group}</Text> | Units:{' '}
                <Text style={styles.bold}>{req.units_needed}</Text>
              </Text>
              <Text style={styles.requestDetails}>Hospital: {req.hospital_name}</Text>
              <Text style={styles.requestTime}>
                Created: {new Date(req.created_at).toLocaleString()}
              </Text>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.statusViewButton}
                  onPress={() => setSelectedRequestIdForModal(req.id)}
                  accessibilityRole="button"
                  accessibilityLabel="View 4-channel dispatch status"
                >
                  <Text style={styles.statusViewButtonText}>📡 4-Channel Status</Text>
                </TouchableOpacity>

                {req.status !== 'cancelled' && req.status !== 'fulfilled' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelRequest(req.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel emergency request for ${req.patient_name}`}
                  >
                    <Text style={styles.cancelButtonText}>Cancel Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

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
    padding: 20,
    backgroundColor: '#f3f4f6',
    flexGrow: 1,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    width: '22%',
    paddingVertical: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bloodChipTextSelected: {
    color: '#ffffff',
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
  stepperText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencyChip: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
  },
  urgencyChipSelected: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  urgencyTextSelected: {
    color: '#ffffff',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confirmText: {
    flex: 1,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: '#fca5a5',
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  requestItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestPatient: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  requestDetails: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  bold: {
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgePending: {
    backgroundColor: '#fef3c7',
  },
  badgeVerified: {
    backgroundColor: '#dbeafe',
  },
  badgeSuccess: {
    backgroundColor: '#d1fae5',
  },
  badgeCancelled: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusViewButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusViewButtonText: {
    fontSize: 12,
    color: '#1d4ed8',
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
