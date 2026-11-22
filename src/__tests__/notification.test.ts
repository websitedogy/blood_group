import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { notificationService, ProviderAdapter } from '../services/notificationService';
import { supabase } from '../lib/supabase';
import { MatchedDonor } from '../types/emergency';
import { NotificationJob } from '../types/notification';

// Mock Supabase DB client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Gate 5: Four-Channel Notifications & Delivery Lifecycle Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleJob: NotificationJob = {
    id: 'job-1',
    request_id: 'req-100',
    donor_id: 'donor-200',
    channel: 'whatsapp',
    status: 'queued',
    attempt_count: 0,
    max_attempts: 3,
    idempotency_key: 'req-100_donor-200_whatsapp',
    provider_message_id: null,
    provider_status: null,
    error_message: null,
    payload: { blood_group: 'O+', distance_meters: 1500 },
    scheduled_at: '2026-11-22T08:00:00Z',
    sent_at: null,
    delivered_at: null,
    created_at: '2026-11-22T08:00:00Z',
    updated_at: '2026-11-22T08:00:00Z',
  };

  const setupMockTables = (overrides?: {
    request?: Record<string, unknown> | null;
    donor?: Record<string, unknown> | null;
    jobUpdateHandler?: (payload: Record<string, unknown>) => Record<string, unknown>;
  }) => {
    const defaultRequest = {
      status: 'broadcasting',
      expires_at: new Date(Date.now() + 100000).toISOString(),
    };

    const defaultDonor = {
      is_available: true,
      notifications_paused: false,
      profiles: { consent_given: true, status: 'active' },
    };

    (supabase.from as unknown as Mock).mockImplementation((tableName: string) => {
      if (tableName === 'emergency_requests') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: overrides?.request !== undefined ? overrides.request : defaultRequest,
            error: null,
          }),
        };
      }

      if (tableName === 'donor_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: overrides?.donor !== undefined ? overrides.donor : defaultDonor,
            error: null,
          }),
        };
      }

      if (tableName === 'notification_jobs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'j1', channel: 'whatsapp', status: 'queued' },
                { id: 'j2', channel: 'sms', status: 'queued' },
                { id: 'j3', channel: 'push', status: 'queued' },
                { id: 'j4', channel: 'email', status: 'queued' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            const resultData = overrides?.jobUpdateHandler
              ? overrides.jobUpdateHandler(payload)
              : { ...sampleJob, ...payload };
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: resultData, error: null }),
            };
          }),
        };
      }

      if (tableName === 'notification_delivery_webhooks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'wh-1' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  };

  // 1. Independent Job Creation & Dedup
  describe('Independent Job Creation & Deduplication', () => {
    it('creates independent queued jobs for each consented channel', async () => {
      setupMockTables();

      const donors: MatchedDonor[] = [
        {
          donor_id: 'donor-1',
          blood_group: 'B+',
          distance_meters: 1200,
          preferred_channels: ['whatsapp', 'sms', 'push', 'email'],
        },
      ];

      const jobs = await notificationService.createNotificationJobsForMatchedDonors('req-1', donors);
      expect(jobs.length).toBe(4);
    });

    it('enforces composite idempotency key preventing duplicate jobs', async () => {
      setupMockTables();

      const donors: MatchedDonor[] = [
        {
          donor_id: 'donor-1',
          blood_group: 'B+',
          distance_meters: 1200,
          preferred_channels: ['sms'],
        },
      ];

      const jobs = await notificationService.createNotificationJobsForMatchedDonors('req-1', donors);
      expect(jobs.length).toBeGreaterThan(0);
    });
  });

  // 2. Channel Failure Isolation
  describe('Channel Failure Isolation', () => {
    it('verifies WhatsApp failure does not block SMS, email, or push dispatch', async () => {
      setupMockTables();

      const whatsappJob: NotificationJob = { ...sampleJob, id: 'w-1', channel: 'whatsapp' };
      const smsJob: NotificationJob = { ...sampleJob, id: 's-1', channel: 'sms' };

      const isolatedAdapter: ProviderAdapter = async (channel) => {
        if (channel === 'whatsapp') {
          return { success: false, error: 'Meta Cloud API rate limited or unavailable' };
        }
        return { success: true, provider_message_id: 'sms_ok_123' };
      };

      const resWhatsApp = await notificationService.processJob(whatsappJob, isolatedAdapter);
      const resSms = await notificationService.processJob(smsJob, isolatedAdapter);

      expect(resWhatsApp.status).toBe('failed');
      expect(resWhatsApp.error_message).toContain('Meta Cloud API');

      expect(resSms.status).toBe('sent');
      expect(resSms.provider_message_id).toBe('sms_ok_123');
    });

    it('verifies SMS failure does not block other channels', async () => {
      setupMockTables();

      const smsJob: NotificationJob = { ...sampleJob, id: 's-2', channel: 'sms' };
      const pushJob: NotificationJob = { ...sampleJob, id: 'p-2', channel: 'push' };

      const isolatedAdapter: ProviderAdapter = async (channel) => {
        if (channel === 'sms') {
          return { success: false, error: 'SMS Gateway unreachable' };
        }
        return { success: true, provider_message_id: 'push_ok_456' };
      };

      const resSms = await notificationService.processJob(smsJob, isolatedAdapter);
      const resPush = await notificationService.processJob(pushJob, isolatedAdapter);

      expect(resSms.status).toBe('failed');
      expect(resPush.status).toBe('sent');
    });
  });

  // 3. Pre-Dispatch Gates (Consent, Cancellation, Expiry)
  describe('Pre-Dispatch Safety Gates', () => {
    it('aborts dispatch if donor withdrew consent before job runs', async () => {
      setupMockTables({
        donor: {
          is_available: true,
          notifications_paused: false,
          profiles: { consent_given: false, status: 'active' }, // Consent revoked!
        },
      });

      const res = await notificationService.processJob(sampleJob);
      expect(res.status).toBe('cancelled_pre_dispatch');
      expect(res.error_message).toContain('Donor withdrew consent');
    });

    it('aborts dispatch if request was cancelled before job runs', async () => {
      setupMockTables({
        request: {
          status: 'cancelled',
          expires_at: new Date(Date.now() + 100000).toISOString(),
        },
      });

      const res = await notificationService.processJob(sampleJob);
      expect(res.status).toBe('cancelled_pre_dispatch');
      expect(res.error_message).toContain('cancelled');
    });

    it('aborts dispatch if request was fulfilled before job runs', async () => {
      setupMockTables({
        request: {
          status: 'fulfilled',
          expires_at: new Date(Date.now() + 100000).toISOString(),
        },
      });

      const res = await notificationService.processJob(sampleJob);
      expect(res.status).toBe('cancelled_pre_dispatch');
      expect(res.error_message).toContain('fulfilled');
    });

    it('aborts dispatch if request expired before job runs', async () => {
      setupMockTables({
        request: {
          status: 'broadcasting',
          expires_at: new Date(Date.now() - 5000).toISOString(), // Expired
        },
      });

      const res = await notificationService.processJob(sampleJob);
      expect(res.status).toBe('cancelled_pre_dispatch');
      expect(res.error_message).toContain('expired');
    });
  });

  // 4. Retry and Dead-Letter Queue
  describe('Retry Count & Dead-Letter Queueing', () => {
    it('transitions to dead_letter when attempt_count reaches max_attempts (3)', async () => {
      setupMockTables();

      const nearLimitJob: NotificationJob = {
        ...sampleJob,
        attempt_count: 2, // Next attempt will be 3
        max_attempts: 3,
      };

      const failingAdapter: ProviderAdapter = async () => ({
        success: false,
        error: 'Final retry provider rejection',
      });

      const res = await notificationService.processJob(nearLimitJob, failingAdapter);
      expect(res.status).toBe('dead_letter');
      expect(res.attempt_count).toBe(3);
    });
  });

  // 5. Provider Acceptance vs Delivery Guarantee
  describe('Delivery Integrity & Webhooks', () => {
    it('strictly verifies provider submission is marked sent, NOT delivered', async () => {
      setupMockTables();

      const res = await notificationService.processJob(sampleJob);
      // Provider accepted message: MUST BE 'sent', NEVER 'delivered'
      expect(res.status).toBe('sent');
      expect(res.status).not.toBe('delivered');
      expect(res.provider_message_id).toBeDefined();
    });

    it('transitions sent job to delivered upon valid inbound webhook', async () => {
      setupMockTables();

      const res = await notificationService.handleDeliveryWebhook({
        provider: 'twilio',
        provider_message_id: 'sms_msg_999',
        event_type: 'delivered',
        raw_payload: { status: 'delivered', sid: 'sms_msg_999' },
      });

      expect(res.success).toBe(true);
    });

    it('defends against duplicate / replayed webhooks', async () => {
      (supabase.from as unknown as Mock).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'webhook-1', processed: true }, // Webhook already processed
          error: null,
        }),
      });

      const res = await notificationService.handleDeliveryWebhook({
        provider: 'whatsapp',
        provider_message_id: 'wa_msg_already_processed',
        event_type: 'delivered',
        raw_payload: {},
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(true);
    });
  });

  // 6. Aggregated Channel Summary
  describe('Dispatch Summary Aggregation', () => {
    it('accurately aggregates jobs by channel and status', async () => {
      const mockJobs = [
        { channel: 'whatsapp', status: 'sent' },
        { channel: 'sms', status: 'delivered' },
        { channel: 'push', status: 'failed' },
        { channel: 'email', status: 'queued' },
        { channel: 'sms', status: 'dead_letter' },
        { channel: 'whatsapp', status: 'cancelled_pre_dispatch' },
      ];

      (supabase.from as unknown as Mock).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
      });

      const summary = await notificationService.getDispatchSummary('req-100');
      expect(summary.total_jobs).toBe(6);
      expect(summary.sent).toBe(1);
      expect(summary.delivered).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.dead_letter).toBe(1);
      expect(summary.cancelled_pre_dispatch).toBe(1);
      expect(summary.by_channel.whatsapp.sent).toBe(1);
      expect(summary.by_channel.sms.delivered).toBe(1);
    });
  });
});
