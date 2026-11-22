import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { validateEmergencyRequest } from '../utils/validation';
import { emergencyService } from '../services/emergencyService';
import { supabase } from '../lib/supabase';
import { CreateEmergencyRequestParams } from '../types/emergency';

// Mock Supabase DB client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Gate 4: Emergency SOS & PostGIS Matching Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emergencyService._resetSubmissionLocks();
  });

  const validParams: CreateEmergencyRequestParams = {
    patient_name: 'Ananya Sharma',
    blood_group: 'B+',
    units_needed: 2,
    hospital_name: 'Apollo Jubilee Hills',
    hospital_address: 'Road No 72, Jubilee Hills, Hyderabad',
    latitude: 17.432,
    longitude: 78.407,
    contact_phone: '9876543210',
    urgency_level: 'critical',
    is_ai_extracted: false,
    user_confirmed: true,
  };

  // 1. Validation & Mandatory Fields
  describe('Emergency Request Validation', () => {
    it('accepts completely valid emergency request parameters', () => {
      const res = validateEmergencyRequest(validParams);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects missing patient name', () => {
      const res = validateEmergencyRequest({ ...validParams, patient_name: '' });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Patient name is mandatory.');
    });

    it('rejects invalid blood group', () => {
      const res = validateEmergencyRequest({ ...validParams, blood_group: 'XYZ' as unknown as CreateEmergencyRequestParams['blood_group'] });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid blood group');
    });

    it('rejects zero or negative units needed', () => {
      const res1 = validateEmergencyRequest({ ...validParams, units_needed: 0 });
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain('between 1 and 20 units');

      const res2 = validateEmergencyRequest({ ...validParams, units_needed: -2 });
      expect(res2.isValid).toBe(false);
    });

    it('rejects units needed exceeding 20', () => {
      const res = validateEmergencyRequest({ ...validParams, units_needed: 25 });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('between 1 and 20 units');
    });

    it('rejects missing hospital details', () => {
      const res1 = validateEmergencyRequest({ ...validParams, hospital_name: '' });
      expect(res1.isValid).toBe(false);
      expect(res1.error).toBe('Hospital name is mandatory.');

      const res2 = validateEmergencyRequest({ ...validParams, hospital_address: '   ' });
      expect(res2.isValid).toBe(false);
      expect(res2.error).toBe('Hospital address is mandatory.');
    });

    it('rejects invalid contact phone number', () => {
      const res = validateEmergencyRequest({ ...validParams, contact_phone: '123' });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('valid 10-digit mobile number');
    });

    it('rejects out of bounds latitude and longitude coordinates', () => {
      const resLat = validateEmergencyRequest({ ...validParams, latitude: 105 });
      expect(resLat.isValid).toBe(false);
      expect(resLat.error).toContain('latitude coordinate');

      const resLng = validateEmergencyRequest({ ...validParams, longitude: 200 });
      expect(resLng.isValid).toBe(false);
      expect(resLng.error).toContain('longitude coordinate');
    });

    it('strictly enforces user confirmation for AI-extracted fields', () => {
      const res = validateEmergencyRequest({
        ...validParams,
        is_ai_extracted: true,
        user_confirmed: false,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('AI-extracted request fields require explicit user review');
    });
  });

  // 2. Request Lifecycle & Submission
  describe('Emergency Request Lifecycle', () => {
    it('creates request in pending_verification status with 24h expiry', async () => {
      const mockCreated = {
        id: 'req-uuid-1',
        ...validParams,
        requester_id: 'usr-1',
        status: 'pending_verification',
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      const mockQueryBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await emergencyService.createRequest('usr-1', validParams);
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe('req-uuid-1');
      expect(res.data?.status).toBe('pending_verification');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requester_id: 'usr-1',
          status: 'pending_verification',
          units_needed: 2,
        })
      );
    });

    it('prevents accidental duplicate request submissions', async () => {
      const mockQueryBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ data: { id: 'req-1' }, error: null }), 50)
            )
        ),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      // Trigger first submission (in-flight)
      const p1 = emergencyService.createRequest('usr-1', validParams);
      // Immediate second call should be caught by duplicate lock
      const p2 = await emergencyService.createRequest('usr-1', validParams);

      expect(p2.success).toBe(false);
      expect(p2.error).toContain('already being processed');

      await p1;
    });

    it('verifies request status transitions from pending to verified', async () => {
      const mockUpdated = { id: 'req-1', status: 'verified' };
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await emergencyService.verifyRequest('req-1');
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('verified');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'verified' })
      );
    });

    it('broadcasts request to initiate donor notifications', async () => {
      const mockUpdated = { id: 'req-1', status: 'broadcasting' };
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await emergencyService.broadcastRequest('req-1');
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('broadcasting');
    });

    it('allows requester to cancel their own active request', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      mockQueryBuilder.eq.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await emergencyService.cancelRequest('req-1', 'usr-1');
      expect(res.success).toBe(true);
      expect(res.data).toBe(true);
    });

    it('marks request as fulfilled once donation is complete', async () => {
      const mockQueryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const res = await emergencyService.fulfillRequest('req-1');
      expect(res.success).toBe(true);
      expect(res.data).toBe(true);
    });
  });

  // 3. Status History Tracking
  describe('Status Transition Audit Trail', () => {
    it('retrieves chronological status audit history', async () => {
      const mockHistory = [
        {
          id: 'hist-1',
          request_id: 'req-1',
          previous_status: null,
          new_status: 'pending_verification',
          created_at: '2026-11-22T08:00:00Z',
        },
        {
          id: 'hist-2',
          request_id: 'req-1',
          previous_status: 'pending_verification',
          new_status: 'verified',
          created_at: '2026-11-22T08:05:00Z',
        },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockHistory, error: null }),
      };
      (supabase.from as unknown as Mock).mockReturnValue(mockQueryBuilder);

      const history = await emergencyService.getRequestStatusHistory('req-1');
      expect(history.length).toBe(2);
      expect(history[0].new_status).toBe('pending_verification');
      expect(history[1].new_status).toBe('verified');
    });
  });

  // 4. PostGIS Donor Matching & Privacy Tests
  describe('PostGIS Donor Matching & Privacy', () => {
    it('calls find_matching_donors stored RPC with radius, limit, and offset', async () => {
      const mockMatched = [
        {
          donor_id: 'donor-1',
          blood_group: 'B+',
          distance_meters: 1450.5,
          preferred_channels: ['push', 'sms'],
        },
        {
          donor_id: 'donor-2',
          blood_group: 'B+',
          distance_meters: 4800.0,
          preferred_channels: ['push'],
        },
      ];

      (supabase.rpc as unknown as Mock).mockResolvedValueOnce({
        data: mockMatched,
        error: null,
      });

      const donors = await emergencyService.findMatchingDonors('req-1', 15.0, 20, 0);
      expect(donors.length).toBe(2);
      expect(donors[0].donor_id).toBe('donor-1');
      expect(donors[0].distance_meters).toBe(1450.5);
      expect(supabase.rpc).toHaveBeenCalledWith('find_matching_donors', {
        p_request_id: 'req-1',
        p_radius_km: 15.0,
        p_limit: 20,
        p_offset: 0,
      });
    });

    it('strictly verifies that exact coordinates, names, and phone numbers are excluded from matching output', async () => {
      const mockResult = [
        {
          donor_id: 'donor-3',
          blood_group: 'B+',
          distance_meters: 2300,
          preferred_channels: ['sms'],
        },
      ];

      (supabase.rpc as unknown as Mock).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const donors = await emergencyService.findMatchingDonors('req-1');
      const firstDonor = donors[0] as unknown as Record<string, unknown>;

      // Coordinate privacy verification
      expect(firstDonor.latitude).toBeUndefined();
      expect(firstDonor.longitude).toBeUndefined();
      expect(firstDonor.location).toBeUndefined();
      expect(firstDonor.phone).toBeUndefined();
      expect(firstDonor.full_name).toBeUndefined();
    });

    it('returns empty list when no matching donors are available within radius', async () => {
      (supabase.rpc as unknown as Mock).mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const donors = await emergencyService.findMatchingDonors('req-isolated', 10.0);
      expect(donors).toEqual([]);
    });
  });
});
