import { supabase } from '../lib/supabase';
import {
  DonorProfile,
  DonorResponseRecord,
  UpdateDonorProfileParams,
  BloodGroup,
  NotificationChannel,
  ResponseStatus,
} from '../types/donor';
import { validateBloodGroup, validateRadius, VALID_NOTIFICATION_CHANNELS } from '../utils/validation';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// In-memory donor profile storage for offline / demo mode
const inMemoryDonorProfiles = new Map<string, DonorProfile>();

export const donorService = {
  /**
   * Fetch donor profile for the authenticated user under strict RLS.
   */
  async getDonorProfile(donorId: string): Promise<DonorProfile | null> {
    try {
      const { data, error } = await supabase
        .from('donor_profiles')
        .select('*')
        .eq('id', donorId)
        .single();

      if (!error && data) {
        const profile = data as DonorProfile;
        inMemoryDonorProfiles.set(donorId, profile);
        return profile;
      }

      return inMemoryDonorProfiles.get(donorId) || null;
    } catch {
      return inMemoryDonorProfiles.get(donorId) || null;
    }
  },

  /**
   * Register or update donor details (blood group, radius, channels, location).
   */
  async saveDonorProfile(
    donorId: string,
    params: UpdateDonorProfileParams & { blood_group: BloodGroup }
  ): Promise<ServiceResult<DonorProfile>> {
    const bloodGroupVal = validateBloodGroup(params.blood_group);
    if (!bloodGroupVal.isValid || !bloodGroupVal.value) {
      return { success: false, error: bloodGroupVal.error };
    }

    if (params.notification_radius_km !== undefined) {
      const radiusVal = validateRadius(params.notification_radius_km);
      if (!radiusVal.isValid) {
        return { success: false, error: radiusVal.error };
      }
    }

    const payload = {
      id: donorId,
      user_id: donorId,
      blood_group: bloodGroupVal.value,
      is_available: params.is_available !== undefined ? params.is_available : true,
      notifications_paused: params.notifications_paused !== undefined ? params.notifications_paused : false,
      notification_radius_km: params.notification_radius_km || 10,
      preferred_channels: params.preferred_channels || ['push', 'sms'],
      last_donation_date: params.last_donation_date || null,
      latitude: params.latitude !== undefined ? params.latitude : 17.385,
      longitude: params.longitude !== undefined ? params.longitude : 78.4867,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('donor_profiles')
        .upsert(payload)
        .select()
        .single();

      if (!error && data) {
        const saved = data as DonorProfile;
        inMemoryDonorProfiles.set(donorId, saved);
        return { success: true, data: saved };
      }

      // Offline / demo fallback
      const localProfile: DonorProfile = {
        id: donorId,
        user_id: donorId,
        blood_group: bloodGroupVal.value,
        is_available: payload.is_available,
        notifications_paused: payload.notifications_paused,
        notification_radius_km: payload.notification_radius_km,
        preferred_channels: payload.preferred_channels,
        last_donation_date: payload.last_donation_date,
        latitude: payload.latitude,
        longitude: payload.longitude,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryDonorProfiles.set(donorId, localProfile);
      return { success: true, data: localProfile };
    } catch {
      const localProfile: DonorProfile = {
        id: donorId,
        user_id: donorId,
        blood_group: bloodGroupVal.value,
        is_available: payload.is_available,
        notifications_paused: payload.notifications_paused,
        notification_radius_km: payload.notification_radius_km,
        preferred_channels: payload.preferred_channels,
        last_donation_date: payload.last_donation_date,
        latitude: payload.latitude,
        longitude: payload.longitude,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryDonorProfiles.set(donorId, localProfile);
      return { success: true, data: localProfile };
    }
  },

  /**
   * Toggle donor real-time availability for emergencies.
   */
  async setAvailability(donorId: string, isAvailable: boolean): Promise<ServiceResult<boolean>> {
    // Update local cache
    const existing = inMemoryDonorProfiles.get(donorId);
    if (existing) {
      existing.is_available = isAvailable;
      existing.updated_at = new Date().toISOString();
    }

    try {
      const { error } = await supabase
        .from('donor_profiles')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (error && !existing) {
        return { success: false, error: error.message };
      }
      return { success: true, data: isAvailable };
    } catch {
      return { success: true, data: isAvailable };
    }
  },

  /**
   * Pause or resume emergency broadcast notifications.
   */
  async setNotificationsPaused(donorId: string, isPaused: boolean): Promise<ServiceResult<boolean>> {
    const existing = inMemoryDonorProfiles.get(donorId);
    if (existing) {
      existing.notifications_paused = isPaused;
      existing.updated_at = new Date().toISOString();
    }

    try {
      const { error } = await supabase
        .from('donor_profiles')
        .update({ notifications_paused: isPaused, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (error && !existing) {
        return { success: false, error: error.message };
      }
      return { success: true, data: isPaused };
    } catch {
      return { success: true, data: isPaused };
    }
  },

  /**
   * Adjust notification alert radius (1 km to 50 km).
   */
  async setNotificationRadius(donorId: string, radiusKm: number): Promise<ServiceResult<number>> {
    const val = validateRadius(radiusKm);
    if (!val.isValid || val.value === undefined) {
      return { success: false, error: val.error };
    }

    const existing = inMemoryDonorProfiles.get(donorId);
    if (existing) {
      existing.notification_radius_km = val.value;
      existing.updated_at = new Date().toISOString();
    }

    try {
      const { error } = await supabase
        .from('donor_profiles')
        .update({ notification_radius_km: val.value, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (error && !existing) return { success: false, error: error.message };
      return { success: true, data: val.value };
    } catch {
      return { success: true, data: val.value };
    }
  },

  /**
   * Update preferred communication channels (must include at least 1 channel).
   */
  async setPreferredChannels(donorId: string, channels: NotificationChannel[]): Promise<ServiceResult<NotificationChannel[]>> {
    if (!channels || channels.length === 0) {
      return { success: false, error: 'At least one notification channel must be selected.' };
    }

    const filtered = channels.filter((c) => VALID_NOTIFICATION_CHANNELS.includes(c));
    if (filtered.length === 0) {
      return { success: false, error: 'Invalid notification channels selected.' };
    }

    try {
      const { error } = await supabase
        .from('donor_profiles')
        .update({ preferred_channels: filtered, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (error) return { success: false, error: error.message };
      return { success: true, data: filtered };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update channels.';
      return { success: false, error: message };
    }
  },

  /**
   * Withdraw explicit consent. Deactivates donor availability and notification dispatch.
   */
  async withdrawConsent(donorId: string): Promise<ServiceResult<boolean>> {
    try {
      // 1. Update user profile consent status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ consent_given: false, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (profileError) return { success: false, error: profileError.message };

      // 2. Set donor as unavailable and paused
      const { error: donorError } = await supabase
        .from('donor_profiles')
        .update({
          is_available: false,
          notifications_paused: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', donorId);

      if (donorError) return { success: false, error: donorError.message };

      return { success: true, data: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error withdrawing consent.';
      return { success: false, error: message };
    }
  },

  /**
   * Retrieve donor emergency response history.
   */
  async getResponseHistory(donorId: string, limit = 20): Promise<DonorResponseRecord[]> {
    try {
      const { data, error } = await supabase
        .from('donor_responses')
        .select('*')
        .eq('donor_id', donorId)
        .order('responded_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data as DonorResponseRecord[];
    } catch {
      return [];
    }
  },

  /**
   * Record a response to an emergency SOS request ('accepted' | 'declined' | 'cancelled').
   */
  async recordResponse(
    donorId: string,
    requestId: string,
    status: ResponseStatus
  ): Promise<ServiceResult<DonorResponseRecord>> {
    try {
      const { data, error } = await supabase
        .from('donor_responses')
        .insert({
          donor_id: donorId,
          request_id: requestId,
          response_status: status,
          responded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to record response.' };
      }

      return { success: true, data: data as DonorResponseRecord };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording response.';
      return { success: false, error: message };
    }
  },
};
