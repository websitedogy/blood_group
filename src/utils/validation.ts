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
