import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { hospitalService } from '../services/hospitalService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Gate 7: Hospitals & Component Inventory Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches verified organizations', async () => {
    const mockOrgs = [
      { id: 'h1', name: 'Apollo Hospitals', is_verified: true, district: 'Hyderabad' },
    ];

    (supabase.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: mockOrgs, error: null }),
    });

    const orgs = await hospitalService.getVerifiedOrganizations();
    expect(orgs.length).toBe(1);
    expect(orgs[0].name).toBe('Apollo Hospitals');
  });

  it('updates component blood inventory', async () => {
    (supabase.from as unknown as Mock).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const ok = await hospitalService.updateInventory('h1', 'B+', 'platelets', 10);
    expect(ok).toBe(true);
  });

  it('rejects negative inventory units', async () => {
    const ok = await hospitalService.updateInventory('h1', 'B+', 'platelets', -5);
    expect(ok).toBe(false);
  });
});
