import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { chatService } from '../services/chatService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Gate 6: Chat & Mutual Contact Consent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates chat room for donor and requester', async () => {
    const mockRoom = {
      id: 'room-1',
      request_id: 'req-1',
      donor_id: 'donor-1',
      requester_id: 'req-user-1',
      is_active: true,
    };

    (supabase.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }),
    });

    const room = await chatService.getOrCreateChatRoom('req-1', 'donor-1', 'req-user-1');
    expect(room?.id).toBe('room-1');
    expect(room?.is_active).toBe(true);
  });

  it('sends message within room', async () => {
    const mockMsg = {
      id: 'msg-1',
      room_id: 'room-1',
      sender_id: 'donor-1',
      message_text: 'I can reach hospital in 20 minutes',
    };

    (supabase.from as unknown as Mock).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockMsg, error: null }),
        }),
      }),
    });

    const msg = await chatService.sendMessage('room-1', 'donor-1', 'I can reach hospital in 20 minutes');
    expect(msg?.message_text).toBe('I can reach hospital in 20 minutes');
  });

  it('strictly hides phone numbers when only one party consents', async () => {
    (supabase.rpc as unknown as Mock).mockResolvedValueOnce({
      data: [{ donor_phone: null, requester_phone: null, is_mutually_shared: false }],
      error: null,
    });

    const contact = await chatService.getMutualContactInfo('room-1');
    expect(contact.is_mutually_shared).toBe(false);
    expect(contact.donor_phone).toBeNull();
    expect(contact.requester_phone).toBeNull();
  });

  it('reveals phone numbers ONLY when both parties explicitly consent', async () => {
    (supabase.rpc as unknown as Mock).mockResolvedValueOnce({
      data: [{ donor_phone: '+919876543210', requester_phone: '+919123456789', is_mutually_shared: true }],
      error: null,
    });

    const contact = await chatService.getMutualContactInfo('room-1');
    expect(contact.is_mutually_shared).toBe(true);
    expect(contact.donor_phone).toBe('+919876543210');
    expect(contact.requester_phone).toBe('+919123456789');
  });
});
