import { BloodGroup, NotificationChannel } from '../types/donor';
import { CreateEmergencyRequestParams } from '../types/emergency';

/**
 * Validates and normalizes phone numbers into E.164 format.
 * LIFELOOP AI standard default prefix is +91 (India) if 10-digit format is entered.
 */
export function validateAndFormatPhone(phone: string): { isValid: boolean; formatted: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, formatted: '', error: 'Phone number is required.' };
  }

  const cleaned = phone.replace(/[\s\-()]/g, '');

  if (!cleaned) {
    return { isValid: false, formatted: '', error: 'Phone number is required.' };
  }

  // Check 10-digit domestic phone number (e.g., 9876543210)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, formatted: `+91${cleaned}` };
  }

  // Check international format starting with +91 (e.g., +919876543210)
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: true, formatted: cleaned };
  }

  // Check generic E.164 format (8 to 15 digits)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return { isValid: true, formatted: cleaned };
  }

  return {
    isValid: false,
    formatted: cleaned,
    error: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.',
  };
}

/**
 * Validates a 6-digit one-time password (OTP).
 */
export function validateOtpToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'OTP is required.' };
  }

  const trimmed = token.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { isValid: false, error: 'OTP must be exactly 6 numeric digits.' };
  }

  return { isValid: true };
}

export const VALID_BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const VALID_NOTIFICATION_CHANNELS: NotificationChannel[] = ['push', 'sms', 'whatsapp', 'email'];

/**
 * Validates blood group format against approved clinical types.
 */
export function validateBloodGroup(bloodGroup: string): { isValid: boolean; value?: BloodGroup; error?: string } {
  if (!bloodGroup || typeof bloodGroup !== 'string') {
    return { isValid: false, error: 'Blood group is required.' };
  }

  const normalized = bloodGroup.trim().toUpperCase() as BloodGroup;
  if (!VALID_BLOOD_GROUPS.includes(normalized)) {
    return {
      isValid: false,
      error: `Invalid blood group '${bloodGroup}'. Must be one of: ${VALID_BLOOD_GROUPS.join(', ')}`,
    };
  }

  return { isValid: true, value: normalized };
}

/**
 * Validates notification alert radius (between 1 and 50 km).
 */
export function validateRadius(radius: number): { isValid: boolean; value?: number; error?: string } {
  if (typeof radius !== 'number' || isNaN(radius)) {
    return { isValid: false, error: 'Radius must be a valid number.' };
  }

  if (radius < 1 || radius > 50) {
    return { isValid: false, error: 'Notification radius must be between 1 km and 50 km.' };
  }

  return { isValid: true, value: Math.round(radius) };
}

/**
 * Validates parameters for creating an emergency blood request.
 */
export function validateEmergencyRequest(params: CreateEmergencyRequestParams): { isValid: boolean; error?: string } {
  if (!params.patient_name || params.patient_name.trim().length === 0) {
    return { isValid: false, error: 'Patient name is mandatory.' };
  }

  const bgVal = validateBloodGroup(params.blood_group);
  if (!bgVal.isValid) {
    return { isValid: false, error: bgVal.error };
  }

  if (
    typeof params.units_needed !== 'number' ||
    isNaN(params.units_needed) ||
    params.units_needed < 1 ||
    params.units_needed > 20
  ) {
    return { isValid: false, error: 'Units needed must be between 1 and 20 units.' };
  }

  if (!params.hospital_name || params.hospital_name.trim().length === 0) {
    return { isValid: false, error: 'Hospital name is mandatory.' };
  }

  if (!params.hospital_address || params.hospital_address.trim().length === 0) {
    return { isValid: false, error: 'Hospital address is mandatory.' };
  }

  const phoneVal = validateAndFormatPhone(params.contact_phone);
  if (!phoneVal.isValid) {
    return { isValid: false, error: phoneVal.error || 'Valid contact phone number is mandatory.' };
  }

  if (
    typeof params.latitude !== 'number' ||
    isNaN(params.latitude) ||
    params.latitude < -90 ||
    params.latitude > 90
  ) {
    return { isValid: false, error: 'Valid latitude coordinate between -90 and 90 is required.' };
  }

  if (
    typeof params.longitude !== 'number' ||
    isNaN(params.longitude) ||
    params.longitude < -180 ||
    params.longitude > 180
  ) {
    return { isValid: false, error: 'Valid longitude coordinate between -180 and 180 is required.' };
  }

  // Ensure AI-extracted fields require explicit user confirmation
  if (params.is_ai_extracted && params.user_confirmed !== true) {
    return { isValid: false, error: 'AI-extracted request fields require explicit user review and confirmation.' };
  }

  return { isValid: true };
}
