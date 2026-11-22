import { BloodGroup } from './donor';

export type OrganizationType = 'hospital' | 'blood_bank' | 'red_cross';
export type ComponentType = 'whole_blood' | 'prbc' | 'platelets' | 'ffp';

export interface Organization {
  id: string;
  name: string;
  org_type: OrganizationType;
  license_number: string;
  address: string;
  district: string;
  state: string;
  contact_phone: string;
  is_verified: boolean;
  created_at: string;
}

export interface BloodInventoryItem {
  id: string;
  organization_id: string;
  blood_group: BloodGroup;
  component_type: ComponentType;
  units_available: number;
  last_verified_at: string;
  updated_at: string;
}
