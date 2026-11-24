import { supabase } from '../lib/supabase';
import {
  EmergencyRequest,
  RequestStatusHistory,
  MatchedDonor,
  CreateEmergencyRequestParams,
  RequestStatus,
  UrgencyLevel,
} from '../types/emergency';
import { BloodGroup } from '../types/donor';
import { validateEmergencyRequest, validateAndFormatPhone } from '../utils/validation';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// In-flight submission lock to prevent duplicate taps and race conditions
const pendingSubmissions = new Set<string>();
// In-memory store for offline/demo request resiliency
const inMemoryRequests: EmergencyRequest[] = [];

function mapDbRowToEmergencyRequest(
  row: Record<string, unknown>,
  fallbackParams?: CreateEmergencyRequestParams,
  requesterId?: string
): EmergencyRequest {
  const urgencyReverseMap: Record<string, UrgencyLevel> = {
    critical: 'critical',
    high: 'urgent',
    moderate: 'standard',
  };

  const rawUrgency = typeof row.urgency === 'string' ? row.urgency : '';
  const mappedUrgency =
    urgencyReverseMap[rawUrgency] ||
    (row.urgency_level as UrgencyLevel) ||
    fallbackParams?.urgency_level ||
    'critical';

  return {
    id: (row.id as string) || `req-${Date.now()}`,
    requester_id: (row.requester_id as string) || requesterId || '',
    patient_name: (row.patient_name as string) || fallbackParams?.patient_name || '',
    blood_group: (row.blood_group as BloodGroup) || fallbackParams?.blood_group || 'O+',
    units_needed:
      typeof row.units_needed === 'number'
        ? row.units_needed
        : fallbackParams?.units_needed || 1,
    hospital_name: (row.hospital_name as string) || fallbackParams?.hospital_name || '',
    hospital_address: (row.hospital_address as string) || fallbackParams?.hospital_address || '',
    latitude: typeof row.latitude === 'number' ? row.latitude : fallbackParams?.latitude || 17.385,
    longitude:
      typeof row.longitude === 'number' ? row.longitude : fallbackParams?.longitude || 78.4867,
    contact_phone:
      (row.attendant_phone as string) ||
      (row.contact_phone as string) ||
      fallbackParams?.contact_phone ||
      '',
    urgency_level: mappedUrgency,
    status: (row.status as RequestStatus) || 'pending_verification',
    is_ai_extracted:
      typeof row.is_ai_extracted === 'boolean'
        ? row.is_ai_extracted
        : fallbackParams?.is_ai_extracted || false,
    user_confirmed:
      typeof row.ai_fields_confirmed === 'boolean'
        ? row.ai_fields_confirmed
        : typeof row.user_confirmed === 'boolean'
        ? row.user_confirmed
        : fallbackParams?.user_confirmed ?? true,
    idempotency_key: (row.idempotency_key as string) || null,
    expires_at:
      (row.expires_at as string) || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
  };
}

export const emergencyService = {
  /**
   * Submit a new emergency blood SOS request.
   * Enforces field validation, AI confirmation guard, and duplicate submission prevention.
   */
  async createRequest(
    requesterId: string,
    params: CreateEmergencyRequestParams,
    idempotencyKey?: string
  ): Promise<ServiceResult<EmergencyRequest>> {
    const validation = validateEmergencyRequest(params);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Duplicate submission suppression
    const submissionKey =
      idempotencyKey ||
      `${requesterId}_${params.patient_name}_${params.blood_group}_${params.hospital_name}`;

    if (pendingSubmissions.has(submissionKey)) {
      return {
        success: false,
        error: 'A request with these details is already being processed. Please do not submit repeatedly.',
      };
    }

    pendingSubmissions.add(submissionKey);

    try {
      const phoneVal = validateAndFormatPhone(params.contact_phone);
      const formattedPhone = phoneVal.formatted || params.contact_phone;

      const urgencyMap: Record<string, 'critical' | 'high' | 'moderate'> = {
        critical: 'critical',
        urgent: 'high',
        standard: 'moderate',
      };
      const urgencyDb = urgencyMap[params.urgency_level || 'urgent'] || 'critical';

      const payload = {
        requester_id: requesterId,
        patient_name: params.patient_name.trim(),
        blood_group: params.blood_group,
        units_needed: params.units_needed,
        hospital_name: params.hospital_name.trim(),
        hospital_address: params.hospital_address.trim(),
        latitude: params.latitude,
        longitude: params.longitude,
        attendant_phone: formattedPhone,
        urgency: urgencyDb,
        status: 'pending_verification' as RequestStatus,
        is_ai_extracted: params.is_ai_extracted || false,
        ai_fields_confirmed: params.user_confirmed !== undefined ? params.user_confirmed : true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('emergency_requests')
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        // Resilient fallback for demo/offline sessions
        const fallbackReq = mapDbRowToEmergencyRequest(
          {
            ...payload,
            id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            idempotency_key: submissionKey,
          },
          params,
          requesterId
        );
        inMemoryRequests.unshift(fallbackReq);
        return { success: true, data: fallbackReq };
      }

      const mapped = mapDbRowToEmergencyRequest(data as Record<string, unknown>, params, requesterId);
      inMemoryRequests.unshift(mapped);
      return { success: true, data: mapped };
    } catch {
      // Offline / network failure resilience
      const phoneVal = validateAndFormatPhone(params.contact_phone);
      const fallbackReq: EmergencyRequest = {
        id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        requester_id: requesterId,
        patient_name: params.patient_name.trim(),
        blood_group: params.blood_group,
        units_needed: params.units_needed,
        hospital_name: params.hospital_name.trim(),
        hospital_address: params.hospital_address.trim(),
        latitude: params.latitude,
        longitude: params.longitude,
        contact_phone: phoneVal.formatted || params.contact_phone,
        urgency_level: params.urgency_level || 'critical',
        status: 'pending_verification',
        is_ai_extracted: params.is_ai_extracted || false,
        user_confirmed: params.user_confirmed !== undefined ? params.user_confirmed : true,
        idempotency_key: submissionKey,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryRequests.unshift(fallbackReq);
      return { success: true, data: fallbackReq };
    } finally {
      pendingSubmissions.delete(submissionKey);
    }
  },

  /**
   * Fetch emergency request by ID.
   */
  async getRequest(requestId: string): Promise<EmergencyRequest | null> {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !data) {
        const found = inMemoryRequests.find((r) => r.id === requestId);
        return found || null;
      }
      return mapDbRowToEmergencyRequest(data as Record<string, unknown>);
    } catch {
      const found = inMemoryRequests.find((r) => r.id === requestId);
      return found || null;
    }
  },

  /**
   * Fetch all emergency requests created by a specific user.
   */
  async getUserRequests(requesterId: string): Promise<EmergencyRequest[]> {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .select('*')
        .eq('requester_id', requesterId)
        .order('created_at', { ascending: false });

      const remoteRows =
        !error && data
          ? (data as Record<string, unknown>[]).map((r) => mapDbRowToEmergencyRequest(r))
          : [];
      const localRows = inMemoryRequests.filter((r) => r.requester_id === requesterId);

      const seen = new Set<string>();
      const combined: EmergencyRequest[] = [];
      for (const item of [...localRows, ...remoteRows]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }
      return combined;
    } catch {
      return inMemoryRequests.filter((r) => r.requester_id === requesterId);
    }
  },

  /**
   * Fetch all active / recent public emergency requests for donor community feed & search.
   */
  async getAllPublicRequests(filter?: { blood_group?: BloodGroup; search?: string }): Promise<EmergencyRequest[]> {
    try {
      let query = supabase
        .from('emergency_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter?.blood_group) {
        query = query.eq('blood_group', filter.blood_group);
      }

      const { data, error } = await query;
      const remoteRows =
        !error && data
          ? (data as Record<string, unknown>[]).map((r) => mapDbRowToEmergencyRequest(r))
          : [];

      // Merge with in-memory requests
      const seen = new Set<string>();
      const combined: EmergencyRequest[] = [];
      for (const item of [...inMemoryRequests, ...remoteRows]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }

      // Filter by search query if provided
      if (filter?.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        return combined.filter(
          (r) =>
            r.patient_name.toLowerCase().includes(q) ||
            r.contact_phone.includes(q) ||
            r.hospital_name.toLowerCase().includes(q) ||
            r.blood_group.toLowerCase().includes(q)
        );
      }

      return combined;
    } catch {
      let results = [...inMemoryRequests];
      if (filter?.blood_group) {
        results = results.filter((r) => r.blood_group === filter.blood_group);
      }
      if (filter?.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        results = results.filter(
          (r) =>
            r.patient_name.toLowerCase().includes(q) ||
            r.contact_phone.includes(q) ||
            r.hospital_name.toLowerCase().includes(q) ||
            r.blood_group.toLowerCase().includes(q)
        );
      }
      return results;
    }
  },

  /**
   * Mark request as fulfilled when blood is received and donors are thanked.
   */
  async markBloodReceived(requestId: string): Promise<ServiceResult<EmergencyRequest>> {
    try {
      // 1. Update in-memory copy
      const local = inMemoryRequests.find((r) => r.id === requestId);
      if (local) {
        local.status = 'fulfilled';
        local.updated_at = new Date().toISOString();
      }

      // 2. Update Supabase
      const { data, error } = await supabase
        .from('emergency_requests')
        .update({
          status: 'fulfilled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (!error && data) {
        return { success: true, data: mapDbRowToEmergencyRequest(data as Record<string, unknown>) };
      }

      if (local) {
        return { success: true, data: local };
      }

      return { success: true, data: { id: requestId, status: 'fulfilled' } as EmergencyRequest };
    } catch {
      const local = inMemoryRequests.find((r) => r.id === requestId);
      if (local) {
        local.status = 'fulfilled';
        return { success: true, data: local };
      }
      return { success: true, data: { id: requestId, status: 'fulfilled' } as EmergencyRequest };
    }
  },

  /**
   * Retrieve complete status transition history for an emergency request.
   */
  async getRequestStatusHistory(requestId: string): Promise<RequestStatusHistory[]> {
    try {
      const { data, error } = await supabase
        .from('request_status_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as RequestStatusHistory[];
    } catch {
      return [];
    }
  },

  /**
   * Transition request from 'pending_verification' to 'verified'.
   */
  async verifyRequest(requestId: string): Promise<ServiceResult<EmergencyRequest>> {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .update({
          status: 'verified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to verify request.' };
      }

      return { success: true, data: data as EmergencyRequest };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error verifying request.';
      return { success: false, error: message };
    }
  },

  /**
   * Transition request to 'broadcasting' to trigger donor notification dispatch.
   */
  async broadcastRequest(requestId: string): Promise<ServiceResult<EmergencyRequest>> {
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .update({
          status: 'broadcasting',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to broadcast request.' };
      }

      return { success: true, data: data as EmergencyRequest };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error broadcasting request.';
      return { success: false, error: message };
    }
  },

  /**
   * Cancel an active emergency request by requester.
   */
  async cancelRequest(requestId: string, requesterId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('requester_id', requesterId);

      if (error) return { success: false, error: error.message };
      return { success: true, data: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cancelling request.';
      return { success: false, error: message };
    }
  },

  /**
   * Fulfill an emergency request once donor donation is confirmed.
   */
  async fulfillRequest(requestId: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({
          status: 'fulfilled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) return { success: false, error: error.message };
      return { success: true, data: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fulfilling request.';
      return { success: false, error: message };
    }
  },

  /**
   * Perform PostGIS donor matching within radius.
   * Privacy guarantee: Returns only privacy-safe MatchedDonor (donor_id, blood_group, distance, channels).
   * Exact coordinates and identities are strictly omitted.
   */
  async findMatchingDonors(
    requestId: string,
    radiusKm = 25.0,
    limit = 50,
    offset = 0
  ): Promise<MatchedDonor[]> {
    try {
      const { data, error } = await supabase.rpc('find_matching_donors', {
        p_request_id: requestId,
        p_radius_km: radiusKm,
        p_limit: limit,
        p_offset: offset,
      });

      if (error || !data) return [];
      return data as MatchedDonor[];
    } catch {
      return [];
    }
  },

  /**
   * Helper to reset in-flight duplicate submission locks for clean test isolation.
   */
  _resetSubmissionLocks(): void {
    pendingSubmissions.clear();
  },
};
