import { supabase } from '../lib/supabase';
import { validateAndFormatPhone, validateOtpToken } from '../utils/validation';
import { UserProfile, UserRole } from '../types/auth';

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  cooldownSeconds?: number;
  error?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  user?: { id: string; phone?: string };
  profile?: UserProfile | null;
  error?: string;
}

// In-memory rate limiting and cooldown state tracker
const lastOtpSentTimestamps: Record<string, number> = {};
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown

export const authService = {
  /**
   * Request a one-time password (OTP) via SMS.
   * Enforces phone validation, explicit consent capture, and resend cooldown.
   */
  async requestPhoneOtp(phone: string, consentGiven: boolean): Promise<SendOtpResponse> {
    if (!consentGiven) {
      return {
        success: false,
        error: 'Explicit consent is required to register and receive emergency blood alerts.',
      };
    }

    const validation = validateAndFormatPhone(phone);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'Invalid phone number.',
      };
    }

    const formattedPhone = validation.formatted;
    const now = Date.now();
    const lastSent = lastOtpSentTimestamps[formattedPhone] || 0;
    const elapsed = now - lastSent;

    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
        cooldownSeconds: remainingSeconds,
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to send OTP. Please check your network or try again.',
        };
      }

      lastOtpSentTimestamps[formattedPhone] = Date.now();

      return {
        success: true,
        message: 'OTP sent successfully via SMS.',
        cooldownSeconds: 60,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error while sending OTP.';
      return { success: false, error: message };
    }
  },

  /**
   * Verify the 6-digit OTP token and restore/create user profile.
   */
  async verifyOtp(phone: string, token: string): Promise<VerifyOtpResponse> {
    const phoneValidation = validateAndFormatPhone(phone);
    if (!phoneValidation.isValid) {
      return { success: false, error: phoneValidation.error || 'Invalid phone number.' };
    }

    const otpValidation = validateOtpToken(token);
    if (!otpValidation.isValid) {
      return { success: false, error: otpValidation.error || 'Invalid OTP.' };
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneValidation.formatted,
        token: token.trim(),
        type: 'sms',
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Invalid or expired OTP. Please try again.',
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Verification succeeded but no authenticated user was returned.',
        };
      }

      const userId = data.user.id;

      // Fetch existing profile or initialize default donor profile with consent
      let profile = await authService.getProfile(userId);

      if (!profile) {
        profile = await authService.upsertProfile(userId, {
          phone: phoneValidation.formatted,
          full_name: null,
          role: 'donor',
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          status: 'active',
        });
      }

      // Check if account is suspended or deleted
      if (profile && profile.status !== 'active') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: `Your account is ${profile.status}. Please contact LIFELOOP support.`,
        };
      }

      return {
        success: true,
        user: { id: data.user.id, phone: data.user.phone },
        profile,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network failure during OTP verification.';
      return { success: false, error: message };
    }
  },

  /**
   * Fetch user profile under strict RLS rules (users can only access their own profile).
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as UserProfile;
    } catch {
      return null;
    }
  },

  /**
   * Upsert user profile row ensuring role integrity and consent record.
   */
  async upsertProfile(
    userId: string,
    profileData: Partial<UserProfile> & { phone: string; consent_given: boolean }
  ): Promise<UserProfile | null> {
    try {
      const payload = {
        id: userId,
        phone: profileData.phone,
        full_name: profileData.full_name || null,
        role: (profileData.role || 'donor') as UserRole,
        consent_given: profileData.consent_given,
        consent_timestamp: profileData.consent_timestamp || new Date().toISOString(),
        status: 'active' as const,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return data as UserProfile;
    } catch {
      return null;
    }
  },

  /**
   * Restore existing session from platform hardware-backed secure storage.
   */
  async restoreSession(): Promise<{ user: { id: string; phone?: string } | null; profile: UserProfile | null }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session || !session.user) {
        return { user: null, profile: null };
      }

      const profile = await authService.getProfile(session.user.id);
      if (profile && profile.status !== 'active') {
        await supabase.auth.signOut();
        return { user: null, profile: null };
      }

      return {
        user: { id: session.user.id, phone: session.user.phone },
        profile,
      };
    } catch {
      return { user: null, profile: null };
    }
  },

  /**
   * Terminate authenticated session and clear secure hardware storage.
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error signing out.';
      return { success: false, error: message };
    }
  },

  /**
   * Helper to reset in-memory rate limiting state (used strictly for test isolation).
   */
  _resetRateLimiter(): void {
    Object.keys(lastOtpSentTimestamps).forEach((key) => {
      delete lastOtpSentTimestamps[key];
    });
  },
};
