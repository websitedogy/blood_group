export type NotificationChannelType = 'whatsapp' | 'sms' | 'email' | 'push';

export type NotificationJobStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'dead_letter'
  | 'cancelled_pre_dispatch';

export interface NotificationJob {
  id: string;
  request_id: string;
  donor_id: string;
  channel: NotificationChannelType;
  status: NotificationJobStatus;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  provider_message_id: string | null;
  provider_status: string | null;
  error_message: string | null;
  payload: Record<string, unknown>;
  scheduled_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryWebhookPayload {
  provider: 'whatsapp' | 'twilio' | 'resend' | 'expo_push';
  provider_message_id: string;
  event_type: 'delivered' | 'undelivered' | 'failed' | 'read';
  raw_payload: Record<string, unknown>;
}

export interface NotificationDispatchSummary {
  request_id: string;
  total_jobs: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  dead_letter: number;
  cancelled_pre_dispatch: number;
  by_channel: Record<
    NotificationChannelType,
    { queued: number; sent: number; delivered: number; failed: number }
  >;
}
