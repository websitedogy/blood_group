import { BloodGroup } from './donor';

export type UrgencyLevel = 'critical' | 'urgent' | 'standard';

export type RequestStatus =
  | 'pending_verification'
  | 'verified'
  | 'broadcasting'
  | 'fulfilled'
  | 'cancelled'
  | 'expired';

export interface EmergencyRequest {
  id: string;
  requester_id: string;
  patient_name: string;
  blood_group: BloodGroup;
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  urgency_level: UrgencyLevel;
  status: RequestStatus;
  is_ai_extracted: boolean;
  user_confirmed: boolean;
  idempotency_key: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RequestStatusHistory {
  id: string;
  request_id: string;
  previous_status: RequestStatus | null;
  new_status: RequestStatus;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

/**
 * Privacy-safe matched donor structure.
 * Exact coordinates, personal phone, and identity are strictly excluded.
 */
export interface MatchedDonor {
  donor_id: string;
  blood_group: BloodGroup;
  distance_meters: number;
  preferred_channels: string[];
}

export interface CreateEmergencyRequestParams {
  patient_name: string;
  blood_group: BloodGroup;
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  urgency_level?: UrgencyLevel;
  is_ai_extracted?: boolean;
  user_confirmed?: boolean;
}
