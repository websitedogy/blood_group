import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { authService } from '../../services/authService';
import { UserProfile } from '../../types/auth';
import MainAppScreen from '../MainAppScreen';

export default function AuthScreen(): React.JSX.Element {
  // Screen and form state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Status and response states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authenticated state
  const [authenticatedUser, setAuthenticatedUser] = useState<{ id: string; phone?: string } | null>(null);
  const [, setUserProfile] = useState<UserProfile | null>(null);

  // Cooldown interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Attempt session restoration on startup
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const session = await authService.restoreSession();
      if (isMounted) {
        if (session.user) {
          setAuthenticatedUser(session.user);
          setUserProfile(session.profile);
        }
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Cooldown timer handler
  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Action: Send OTP
  const handleSendOtp = async () => {
    if (loading || cooldown > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const result = await authService.requestPhoneOtp(phone, consentGiven);
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
      setSuccessMessage(result.message || 'OTP sent successfully.');
      startCooldown(result.cooldownSeconds || 60);
    } else {
      setErrorMessage(result.error || 'Failed to send OTP.');
      if (result.cooldownSeconds) {
        startCooldown(result.cooldownSeconds);
      }
    }
  };

  // Action: Verify OTP
  const handleVerifyOtp = async () => {
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const result = await authService.verifyOtp(phone, otp);
    setLoading(false);

    if (result.success && result.user) {
      setAuthenticatedUser(result.user);
      setUserProfile(result.profile || null);
      setSuccessMessage('Successfully authenticated.');
      setOtpSent(false);
      setOtp('');
    } else {
      setErrorMessage(result.error || 'Verification failed. Please check the OTP.');
    }
  };

  // Action: Instant Demo / QA Login
  const handleDemoLogin = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPhone('9876543210');
    setConsentGiven(true);

    const result = await authService.quickDemoLogin();
    setLoading(false);

    if (result.success && result.user) {
      setAuthenticatedUser(result.user);
      setUserProfile(result.profile || null);
      setSuccessMessage('Logged in with Demo Donor account.');
    } else {
      setErrorMessage(result.error || 'Failed to authenticate demo user.');
    }
  };

  // Action: Logout
  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    await authService.signOut();
    setAuthenticatedUser(null);
    setUserProfile(null);
    setPhone('');
    setOtp('');
    setOtpSent(false);
    setSuccessMessage('Logged out successfully.');
    setErrorMessage(null);
    setLoading(false);
  };

  // Authenticated View: Complete Main App with Bottom Navigation
  if (authenticatedUser) {
    return (
      <MainAppScreen
        userId={authenticatedUser.id}
        phone={authenticatedUser.phone || phone}
        onLogout={handleLogout}
      />
    );
  }

  // Login & Registration Flow
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle} accessibilityRole="header">
        LIFELOOP AI Authentication
      </Text>
      <Text style={styles.headerSubtitle}>
        Secure Phone OTP Login & Emergency Donor Verification
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

      {/* Phone Number Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Mobile Phone Number (+91)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 9876543210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading && !otpSent}
          accessibilityLabel="Mobile Phone Number input"
          maxLength={15}
        />
      </View>

      {/* Mandatory Explicit Consent Checkbox */}
      {!otpSent && (
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setConsentGiven(!consentGiven)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentGiven }}
          accessibilityLabel="I consent to receive emergency blood requests and alerts"
        >
          <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
            {consentGiven && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            I explicitly consent to register my mobile number to receive critical emergency blood alerts.
          </Text>
        </TouchableOpacity>
      )}

      {/* Action: Send OTP Button */}
      {!otpSent && (
        <TouchableOpacity
          style={[styles.primaryButton, (!consentGiven || !phone || loading) && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={!consentGiven || !phone || loading}
          accessibilityLabel="Send OTP via SMS"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Send Verification OTP</Text>
          )}
        </TouchableOpacity>
      )}

      {/* QA / Demo Test Mode when live SMS gateway is not configured */}
      {!otpSent && (
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleDemoLogin}
          disabled={loading}
          accessibilityLabel="Quick QA Demo Login"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#0284c7" />
          ) : (
            <Text style={styles.demoButtonText}>⚡ Quick Demo / QA Login (Bypass SMS)</Text>
          )}
        </TouchableOpacity>
      )}

      {/* OTP Verification Section */}
      {otpSent && (
        <View style={styles.otpSection}>
          <Text style={styles.label}>Enter 6-Digit OTP</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            accessibilityLabel="6-digit One Time Password input"
          />

          <TouchableOpacity
            style={[styles.primaryButton, (otp.length !== 6 || loading) && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={otp.length !== 6 || loading}
            accessibilityLabel="Verify OTP and Authenticate"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP & Login</Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP with Cooldown */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSendOtp}
            disabled={cooldown > 0 || loading}
            accessibilityLabel={
              cooldown > 0
                ? `Resend OTP disabled for ${cooldown} seconds`
                : 'Resend Verification OTP'
            }
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, cooldown > 0 && styles.textDisabled]}>
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>

          {/* Change Phone Number */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setOtpSent(false);
              setOtp('');
              setErrorMessage(null);
            }}
            disabled={loading}
            accessibilityLabel="Change entered phone number"
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Change Phone Number</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#fca5a5',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#6b7280',
    fontSize: 13,
  },
  textDisabled: {
    color: '#9ca3af',
  },
  otpSection: {
    marginTop: 8,
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
  demoButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '600',
  },
});
