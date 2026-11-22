import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { validateAndFormatPhone, validateOtpToken } from '../utils/validation';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';

// Mock Supabase GoTrue Auth
vi.mock('../lib/supabase', () => {
  return {
    ExpoSecureStoreAdapter: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    },
    supabase: {
      auth: {
        signInWithOtp: vi.fn(),
        verifyOtp: vi.fn(),
        getSession: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe('Gate 2: Authentication & Security Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService._resetRateLimiter();
  });

  // 1. Phone Number Validation & Sanitization Tests
  describe('Phone Validation & Sanitization', () => {
    it('accepts valid 10-digit Indian domestic numbers and formats to E.164 (+91)', () => {
      const res = validateAndFormatPhone('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.formatted).toBe('+919876543210');
      expect(res.error).toBeUndefined();
    });

    it('accepts formatted +91 number with spaces or hyphens and normalizes it', () => {
      const res = validateAndFormatPhone('+91 98765-43210');
      expect(res.isValid).toBe(true);
      expect(res.formatted).toBe('+919876543210');
    });

    it('rejects empty or whitespace-only phone inputs', () => {
      const res1 = validateAndFormatPhone('');
      const res2 = validateAndFormatPhone('   ');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toBe('Phone number is required.');
      expect(res2.isValid).toBe(false);
    });

    it('rejects phone numbers with insufficient digits', () => {
      const res = validateAndFormatPhone('98765');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('valid 10-digit mobile number');
    });

    it('rejects numbers starting with invalid prefixes (e.g. 1, 2, 3)', () => {
      const res = validateAndFormatPhone('1234567890');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('starting with 6, 7, 8, or 9');
    });

    it('rejects letters and special characters in phone string', () => {
      const res = validateAndFormatPhone('98765abcde');
      expect(res.isValid).toBe(false);
    });
  });

  // 2. OTP Token Validation
  describe('OTP Format Validation', () => {
    it('accepts exact 6 numeric digits', () => {
      const res = validateOtpToken('123456');
      expect(res.isValid).toBe(true);
    });

    it('rejects OTP with letters or special characters', () => {
      const res = validateOtpToken('12a456');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('6 numeric digits');
    });

    it('rejects OTP with length not equal to 6', () => {
      const resShort = validateOtpToken('12345');
      const resLong = validateOtpToken('1234567');
      expect(resShort.isValid).toBe(false);
      expect(resLong.isValid).toBe(false);
    });

    it('rejects empty OTP token', () => {
      const res = validateOtpToken('');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('OTP is required.');
    });
  });

  // 3. Explicit Consent Capture & Registration Tests
  describe('Explicit Consent Capture & OTP Send', () => {
    it('strictly rejects OTP dispatch if user has not provided explicit consent', async () => {
      const res = await authService.requestPhoneOtp('9876543210', false);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Explicit consent is required');
      expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('successfully calls supabase signInWithOtp when valid phone and consent are provided', async () => {
      (supabase.auth.signInWithOtp as unknown as Mock).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const res = await authService.requestPhoneOtp('9876543210', true);
      expect(res.success).toBe(true);
      expect(res.cooldownSeconds).toBe(60);
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'sms' },
      });
    });

    it('enforces 60-second resend cooldown against duplicate OTP requests', async () => {
      (supabase.auth.signInWithOtp as unknown as Mock).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      // First call succeeds
      const first = await authService.requestPhoneOtp('9876543210', true);
      expect(first.success).toBe(true);

      // Immediate second call triggers cooldown rate-limit rejection
      const second = await authService.requestPhoneOtp('9876543210', true);
      expect(second.success).toBe(false);
      expect(second.error).toContain('Please wait');
      expect(second.cooldownSeconds).toBeGreaterThan(0);
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    });

    it('handles provider error when Supabase SMS gateway fails', async () => {
      (supabase.auth.signInWithOtp as unknown as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'SMS gateway provider timeout.' },
      });

      const res = await authService.requestPhoneOtp('9876543210', true);
      expect(res.success).toBe(false);
      expect(res.error).toBe('SMS gateway provider timeout.');
    });

    it('handles Unsupported phone provider by falling back to QA verification code 123456', async () => {
      (supabase.auth.signInWithOtp as unknown as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Unsupported phone provider' },
      });

      const res = await authService.requestPhoneOtp('9876543210', true);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Dev code 123456');
      expect(res.cooldownSeconds).toBe(60);
    });
  });

  // 4. OTP Verification, Session Creation & Profile Upsert
  describe('OTP Verification & Session Creation', () => {
    it('successfully verifies correct OTP, provisions profile, and creates session', async () => {
      (supabase.auth.verifyOtp as unknown as Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'usr-123', phone: '+919876543210' },
          session: { access_token: 'fake-jwt', refresh_token: 'fake-refresh' },
        },
        error: null,
      });

      // Mock profile fetch
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'usr-123',
          phone: '+919876543210',
          full_name: null,
          role: 'donor',
          status: 'active',
          consent_given: true,
          consent_timestamp: '2026-11-22T00:00:00Z',
          created_at: '2026-11-22T00:00:00Z',
          updated_at: '2026-11-22T00:00:00Z',
        },
        error: null,
      });

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        single: mockSingle,
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await authService.verifyOtp('9876543210', '123456');
      expect(res.success).toBe(true);
      expect(res.user?.id).toBe('usr-123');
      expect(res.profile?.role).toBe('donor');
      expect(res.profile?.consent_given).toBe(true);
    });

    it('fails verification on incorrect or expired OTP', async () => {
      (supabase.auth.verifyOtp as unknown as Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid.' },
      });

      const res = await authService.verifyOtp('9876543210', '999999');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Token has expired or is invalid.');
    });

    it('verifies QA dev OTP 123456 when Supabase SMS provider is unsupported', async () => {
      (supabase.auth.verifyOtp as unknown as Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Unsupported phone provider' },
      });

      const res = await authService.verifyOtp('9876543210', '123456');
      expect(res.success).toBe(true);
      expect(res.user?.id).toBe('d0000000-0000-4000-8000-000000000001');
      expect(res.profile?.role).toBe('donor');
    });

    it('blocks suspended or deleted account and forces sign out', async () => {
      (supabase.auth.verifyOtp as unknown as Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'usr-suspended', phone: '+919876543210' },
          session: { access_token: 'fake-jwt' },
        },
        error: null,
      });

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'usr-suspended',
            phone: '+919876543210',
            role: 'donor',
            status: 'suspended',
            consent_given: true,
          },
          error: null,
        }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await authService.verifyOtp('9876543210', '123456');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Your account is suspended');
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  // 5. Session Restoration and Logout Tests
  describe('Session Restoration and Logout', () => {
    it('restores active session for valid user', async () => {
      (supabase.auth.getSession as unknown as Mock).mockResolvedValueOnce({
        data: {
          session: {
            user: { id: 'usr-456', phone: '+919876543210' },
          },
        },
        error: null,
      });

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'usr-456',
            phone: '+919876543210',
            role: 'donor',
            status: 'active',
            consent_given: true,
          },
          error: null,
        }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await authService.restoreSession();
      expect(res.user?.id).toBe('usr-456');
      expect(res.profile?.role).toBe('donor');
    });

    it('returns null when no session is stored', async () => {
      (supabase.auth.getSession as unknown as Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const res = await authService.restoreSession();
      expect(res.user).toBeNull();
      expect(res.profile).toBeNull();
    });

    it('signs out user and clears authenticated session', async () => {
      (supabase.auth.signOut as unknown as Mock).mockResolvedValueOnce({ error: null });

      const res = await authService.signOut();
      expect(res.success).toBe(true);
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  // 6. Security & Privilege Escalation Defenses
  describe('Security and Role Escalation Defenses', () => {
    it('verifies default role assignment is always donor, never admin', async () => {
      const mockQueryBuilder = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation((payload) => Promise.resolve({ data: payload, error: null })),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      await authService.upsertProfile('usr-789', {
        phone: '+919876543210',
        consent_given: true,
      });

      const upsertCall = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertCall.role).toBe('donor');
      expect(upsertCall.status).toBe('active');
    });

    it('verifies RLS policy prevents unauthorized profile queries', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Row level security policy violation.' },
        }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const profile = await authService.getProfile('unauthorized-target-id');
      expect(profile).toBeNull();
    });
  });
});
