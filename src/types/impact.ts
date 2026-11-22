export interface LifeloopHero {
  id: string;
  donor_id: string;
  donation_count: number;
  recognition_badge: string;
  public_display_name: string;
  district: string;
  consent_for_recognition: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface ImpactStory {
  id: string;
  title: string;
  story_text: string;
  patient_initials: string;
  hospital_name: string;
  district: string;
  units_donated: number;
  is_moderated: boolean;
  published_at: string;
}

export interface DistrictImpactStats {
  district: string;
  state: string;
  verified_donations: number;
  fulfilled_requests: number;
  active_donors: number;
  last_updated: string;
}
