export interface ChatRoom {
  id: string;
  request_id: string;
  donor_id: string;
  requester_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
}

export interface MutualContactInfo {
  donor_phone: string | null;
  requester_phone: string | null;
  is_mutually_shared: boolean;
}
