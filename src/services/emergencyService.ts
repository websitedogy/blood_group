import { supabase } from '../lib/supabase';
import {
  EmergencyRequest,
  RequestStatusHistory,
  MatchedDonor,
  CreateEmergencyRequestParams,
  RequestStatus,
} from '../types/emergency';
import { validateEmergencyRequest, validateAndFormatPhone } from '../utils/validation';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// In-flight submission lock to prevent duplicate taps and race conditions
const pendingSubmissions = new Set<string>();

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
      const payload = {
        requester_id: requesterId,
        patient_name: params.patient_name.trim(),
        blood_group: params.blood_group,
        units_needed: params.units_needed,
        hospital_name: params.hospital_name.trim(),
        hospital_address: params.hospital_address.trim(),
        latitude: params.latitude,
        longitude: params.longitude,
        contact_phone: phoneVal.formatted || params.contact_phone,
        urgency_level: params.urgency_level || 'urgent',
        status: 'pending_verification' as RequestStatus,
        is_ai_extracted: params.is_ai_extracted || false,
        user_confirmed: params.user_confirmed !== undefined ? params.user_confirmed : true,
        idempotency_key: submissionKey,
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
        return {
          success: false,
          error: error?.message || 'Failed to submit emergency request.',
        };
      }

      return { success: true, data: data as EmergencyRequest };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error during request submission.';
      return { success: false, error: message };
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

      if (error || !data) return null;
      return data as EmergencyRequest;
    } catch {
      return null;
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

      if (error || !data) return [];
      return data as EmergencyRequest[];
    } catch {
      return [];
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
