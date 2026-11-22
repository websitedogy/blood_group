import { supabase } from '../lib/supabase';
import { ChatRoom, ChatMessage, MutualContactInfo } from '../types/chat';

export const chatService = {
  /**
   * Activate or get chat room between donor and requester for an emergency request.
   */
  async getOrCreateChatRoom(
    requestId: string,
    donorId: string,
    requesterId: string
  ): Promise<ChatRoom | null> {
    try {
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('request_id', requestId)
        .eq('donor_id', donorId)
        .single();

      if (existing) return existing as ChatRoom;

      const { data, error } = await supabase
        .from('chat_rooms')
        .insert({
          request_id: requestId,
          donor_id: donorId,
          requester_id: requesterId,
          is_active: true,
        })
        .select()
        .single();

      if (error || !data) return null;
      return data as ChatRoom;
    } catch {
      return null;
    }
  },

  /**
   * Fetch chat messages for an authorized room.
   */
  async getMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as ChatMessage[];
    } catch {
      return [];
    }
  },

  /**
   * Send encrypted/authorized message within room.
   */
  async sendMessage(roomId: string, senderId: string, text: string): Promise<ChatMessage | null> {
    if (!text || text.trim().length === 0) return null;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: senderId,
          message_text: text.trim(),
        })
        .select()
        .single();

      if (error || !data) return null;
      return data as ChatMessage;
    } catch {
      return null;
    }
  },

  /**
   * Submit or revoke phone-number sharing consent.
   * Numbers remain hidden until BOTH parties explicitly consent.
   */
  async setPhoneShareConsent(
    roomId: string,
    userId: string,
    consentGiven: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contact_share_consents')
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            consent_given: consentGiven,
            consent_timestamp: new Date().toISOString(),
          },
          { onConflict: 'room_id,user_id' }
        );

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Query mutual contact numbers via stored RPC.
   * Guaranteed: Returns nulls unless BOTH participants approved sharing their own number.
   */
  async getMutualContactInfo(roomId: string): Promise<MutualContactInfo> {
    try {
      const { data, error } = await supabase.rpc('get_mutual_contact_info', {
        p_room_id: roomId,
      });

      if (error || !data || data.length === 0) {
        return { donor_phone: null, requester_phone: null, is_mutually_shared: false };
      }

      return data[0] as MutualContactInfo;
    } catch {
      return { donor_phone: null, requester_phone: null, is_mutually_shared: false };
    }
  },
};
