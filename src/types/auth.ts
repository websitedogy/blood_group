export type UserRole = 'donor' | 'recipient' | 'hospital_staff' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deleted';

export interface UserProfile {
  id: string;
  phone: string;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  consent_given: boolean;
  consent_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendOtpParams {
  phone: string;
  consentGiven: boolean;
}

export interface VerifyOtpParams {
  phone: string;
  token: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; phone?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  cooldownSeconds: number;
}
