import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { impactService } from '../services/impactService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Gate 9: LIFELOOP Heroes, Stories & District Analytics Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches approved and consented heroes', async () => {
    const mockHeroes = [
      { id: '1', public_display_name: 'Vikas R.', donation_count: 14, is_approved: true },
    ];

    (supabase.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockHeroes, error: null }),
    });

    const heroes = await impactService.getHeroes();
    expect(heroes.length).toBe(1);
    expect(heroes[0].public_display_name).toBe('Vikas R.');
  });

  it('fetches district-wise verified analytics stats', async () => {
    const stats = await impactService.getDistrictStats('Hyderabad');
    expect(stats.length).toBe(1);
    expect(stats[0].district).toBe('Hyderabad');
    expect(stats[0].verified_donations).toBeGreaterThan(0);
  });
});
