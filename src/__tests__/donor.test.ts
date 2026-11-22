import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { validateBloodGroup, validateRadius } from '../utils/validation';
import { donorService } from '../services/donorService';
import { supabase } from '../lib/supabase';
import { BloodGroup } from '../types/donor';

// Mock Supabase DB client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Gate 3: Donor Profiles & Preferences Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Blood Group Validation
  describe('Blood Group Validation', () => {
    const validGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    validGroups.forEach((bg) => {
      it(`accepts valid clinical blood group '${bg}'`, () => {
        const res = validateBloodGroup(bg);
        expect(res.isValid).toBe(true);
        expect(res.value).toBe(bg);
      });
    });

    it('normalizes lowercase blood group (e.g. o+ -> O+)', () => {
      const res = validateBloodGroup('o+');
      expect(res.isValid).toBe(true);
      expect(res.value).toBe('O+');
    });

    it('rejects invalid blood groups (e.g. C+, X-, Rh+)', () => {
      const res1 = validateBloodGroup('C+');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain('Invalid blood group');

      const res2 = validateBloodGroup('Rh+');
      expect(res2.isValid).toBe(false);
    });

    it('rejects empty or null blood group', () => {
      const res = validateBloodGroup('');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Blood group is required.');
    });
  });

  // 2. Notification Radius Validation
  describe('Alert Radius Validation', () => {
    it('accepts valid radius values between 1 and 50 km', () => {
      expect(validateRadius(1).isValid).toBe(true);
      expect(validateRadius(10).isValid).toBe(true);
      expect(validateRadius(50).isValid).toBe(true);
    });

    it('rounds floating point radius to nearest integer', () => {
      const res = validateRadius(12.4);
      expect(res.isValid).toBe(true);
      expect(res.value).toBe(12);
    });

    it('rejects radius less than 1 km', () => {
      const res = validateRadius(0);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('between 1 km and 50 km');
    });

    it('rejects radius greater than 50 km', () => {
      const res = validateRadius(51);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('between 1 km and 50 km');
    });

    it('rejects non-numeric radius', () => {
      const res = validateRadius(NaN);
      expect(res.isValid).toBe(false);
    });
  });

  // 3. Donor Registration and Profile Save
  describe('Donor Profile Registration & Updates', () => {
    it('saves donor profile with valid blood group and default settings', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'donor-1',
          blood_group: 'O+',
          is_available: true,
          notifications_paused: false,
          notification_radius_km: 10,
          preferred_channels: ['push', 'sms'],
        },
        error: null,
      });

      const mockQueryBuilder = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: mockSingle,
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await donorService.saveDonorProfile('donor-1', {
        blood_group: 'O+',
      });

      expect(res.success).toBe(true);
      expect(res.data?.blood_group).toBe('O+');
      expect(res.data?.is_available).toBe(true);
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'donor-1',
          blood_group: 'O+',
          notification_radius_km: 10,
        })
      );
    });

    it('rejects donor profile update if blood group is invalid', async () => {
      const res = await donorService.saveDonorProfile('donor-1', {
        blood_group: 'INVALID' as BloodGroup,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid blood group');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('rejects profile update if radius is out of bounds', async () => {
      const res = await donorService.saveDonorProfile('donor-1', {
        blood_group: 'B+',
        notification_radius_km: 75,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('between 1 km and 50 km');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  // 4. Availability & Notification Pause Controls
  describe('Availability & Pause Toggles', () => {
    it('successfully switches donor availability status', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await donorService.setAvailability('donor-1', false);
      expect(res.success).toBe(true);
      expect(res.data).toBe(false);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_available: false })
      );
    });

    it('successfully pauses and resumes notifications', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const pauseRes = await donorService.setNotificationsPaused('donor-1', true);
      expect(pauseRes.success).toBe(true);
      expect(pauseRes.data).toBe(true);

      const resumeRes = await donorService.setNotificationsPaused('donor-1', false);
      expect(resumeRes.success).toBe(true);
      expect(resumeRes.data).toBe(false);
    });
  });

  // 5. Communication Channels Preferences
  describe('Communication Channels Preferences', () => {
    it('updates preferred notification channels', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await donorService.setPreferredChannels('donor-1', ['push', 'whatsapp']);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(['push', 'whatsapp']);
    });

    it('rejects channel update if channel list is empty', async () => {
      const res = await donorService.setPreferredChannels('donor-1', []);
      expect(res.success).toBe(false);
      expect(res.error).toContain('At least one notification channel');
    });
  });

  // 6. Consent Withdrawal
  describe('Consent Withdrawal Lifecycle', () => {
    it('withdrawing consent revokes user consent and sets donor to unavailable and paused', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await donorService.withdrawConsent('donor-1');
      expect(res.success).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ consent_given: false })
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_available: false, notifications_paused: true })
      );
    });
  });

  // 7. Response History Tracking
  describe('Donor Response History', () => {
    it('returns empty array when donor has no past emergency responses', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const history = await donorService.getResponseHistory('donor-1');
      expect(history).toEqual([]);
    });

    it('returns sorted response history records', async () => {
      const mockRecords = [
        {
          id: 'res-1',
          donor_id: 'donor-1',
          request_id: 'req-abc',
          response_status: 'accepted',
          responded_at: '2026-11-22T08:00:00Z',
        },
      ];
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockRecords, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const history = await donorService.getResponseHistory('donor-1');
      expect(history.length).toBe(1);
      expect(history[0].response_status).toBe('accepted');
    });

    it('records new donor response successfully', async () => {
      const mockRecord = {
        id: 'res-2',
        donor_id: 'donor-1',
        request_id: 'req-xyz',
        response_status: 'accepted',
        responded_at: '2026-11-22T09:00:00Z',
      };
      const mockQueryBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRecord, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await donorService.recordResponse('donor-1', 'req-xyz', 'accepted');
      expect(res.success).toBe(true);
      expect(res.data?.response_status).toBe('accepted');
    });
  });

  // 8. Security & RLS Isolation
  describe('Security & Privacy Enforcement', () => {
    it('returns null and does not leak donor data when RLS policy denies access', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Row level security policy violation.' },
        }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const donor = await donorService.getDonorProfile('unauthorized-user');
      expect(donor).toBeNull();
    });
  });
});
