import { supabase } from '../lib/supabase';
import { Organization, BloodInventoryItem, ComponentType } from '../types/hospital';
import { BloodGroup } from '../types/donor';

export const hospitalService = {
  /**
   * Get verified hospitals and blood banks.
   */
  async getVerifiedOrganizations(district?: string): Promise<Organization[]> {
    try {
      let query = supabase
        .from('organizations')
        .select('*')
        .eq('is_verified', true);

      if (district) {
        query = query.eq('district', district);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data as Organization[];
    } catch {
      return [];
    }
  },

  /**
   * Get component blood inventory for an organization.
   */
  async getInventory(organizationId: string): Promise<BloodInventoryItem[]> {
    try {
      const { data, error } = await supabase
        .from('blood_inventory')
        .select('*')
        .eq('organization_id', organizationId);

      if (error || !data) return [];
      return data as BloodInventoryItem[];
    } catch {
      return [];
    }
  },

  /**
   * Update component blood inventory levels (authorized hospital staff only).
   */
  async updateInventory(
    organizationId: string,
    bloodGroup: BloodGroup,
    componentType: ComponentType,
    unitsAvailable: number
  ): Promise<boolean> {
    if (unitsAvailable < 0) return false;

    try {
      const { error } = await supabase
        .from('blood_inventory')
        .upsert(
          {
            organization_id: organizationId,
            blood_group: bloodGroup,
            component_type: componentType,
            units_available: unitsAvailable,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,blood_group,component_type' }
        );

      return !error;
    } catch {
      return false;
    }
  },
};
