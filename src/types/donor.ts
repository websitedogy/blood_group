export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email';
export type ResponseStatus = 'accepted' | 'declined' | 'cancelled';

export interface DonorProfile {
  id: string;
  blood_group: BloodGroup;
  is_available: boolean;
  notifications_paused: boolean;
  notification_radius_km: number;
  preferred_channels: NotificationChannel[];
  last_donation_date: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface DonorResponseRecord {
  id: string;
  donor_id: string;
  request_id: string;
  response_status: ResponseStatus;
  responded_at: string;
}

export interface UpdateDonorProfileParams {
  blood_group?: BloodGroup;
  is_available?: boolean;
  notifications_paused?: boolean;
  notification_radius_km?: number;
  preferred_channels?: NotificationChannel[];
  last_donation_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
