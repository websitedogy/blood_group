import { supabase } from '../lib/supabase';
import {
  NotificationJob,
  NotificationChannelType,
  DeliveryWebhookPayload,
  NotificationDispatchSummary,
} from '../types/notification';
import { MatchedDonor } from '../types/emergency';

export interface ProviderDispatchResult {
  success: boolean;
  provider_message_id?: string;
  error?: string;
  is_transient?: boolean;
}

export type ProviderAdapter = (
  channel: NotificationChannelType,
  payload: Record<string, unknown>
) => Promise<ProviderDispatchResult>;

// Default mock provider adapter adhering strictly to non-billable test sandbox discipline
const defaultProviderAdapter: ProviderAdapter = async (channel) => {
  // Simulates standard successful provider submission in development sandbox
  return {
    success: true,
    provider_message_id: `${channel}_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
};

export const notificationService = {
  /**
   * Independently create queued notification jobs for each eligible donor and consented channel.
   * Guarantees idempotency and prevents duplicate jobs.
   */
  async createNotificationJobsForMatchedDonors(
    requestId: string,
    matchedDonors: MatchedDonor[]
  ): Promise<NotificationJob[]> {
    const jobsToInsert: Array<{
      request_id: string;
      donor_id: string;
      channel: NotificationChannelType;
      status: string;
      idempotency_key: string;
      payload: Record<string, unknown>;
    }> = [];

    const allowedChannels: NotificationChannelType[] = ['whatsapp', 'sms', 'email', 'push'];

    for (const donor of matchedDonors) {
      const channels = (donor.preferred_channels || ['push', 'sms']).filter(
        (c): c is NotificationChannelType => allowedChannels.includes(c as NotificationChannelType)
      );

      for (const channel of channels) {
        jobsToInsert.push({
          request_id: requestId,
          donor_id: donor.donor_id,
          channel,
          status: 'queued',
          idempotency_key: `${requestId}_${donor.donor_id}_${channel}`,
          payload: {
            blood_group: donor.blood_group,
            distance_meters: donor.distance_meters,
          },
        });
      }
    }

    if (jobsToInsert.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('notification_jobs')
        .upsert(jobsToInsert, { onConflict: 'idempotency_key' })
        .select();

      if (error || !data) return [];
      return data as NotificationJob[];
    } catch {
      return [];
    }
  },

  /**
   * Process and dispatch a single notification job with safety pre-checks and channel isolation.
   */
  async processJob(
    job: NotificationJob,
    providerAdapter: ProviderAdapter = defaultProviderAdapter
  ): Promise<NotificationJob> {
    // 1. Safety Gate: Pre-dispatch checks (Request validity and donor consent)
    const { data: request } = await supabase
      .from('emergency_requests')
      .select('status, expires_at')
      .eq('id', job.request_id)
      .single();

    if (!request) {
      return this._updateJobStatus(job.id, 'cancelled_pre_dispatch', 'Request does not exist.');
    }

    const isExpired = new Date(request.expires_at).getTime() < Date.now();
    if (request.status === 'cancelled' || request.status === 'fulfilled' || isExpired) {
      return this._updateJobStatus(
        job.id,
        'cancelled_pre_dispatch',
        `Request is ${request.status} or expired before dispatch.`
      );
    }

    const { data: donor } = await supabase
      .from('donor_profiles')
      .select('is_available, notifications_paused, profiles!inner(status, consent_given)')
      .eq('id', job.donor_id)
      .single();

    interface DonorProfileWithConsent {
      is_available: boolean;
      notifications_paused: boolean;
      profiles?: {
        status: string;
        consent_given: boolean;
      };
    }

    const donorProfile = donor as unknown as DonorProfileWithConsent | null;
    const consentGiven = donorProfile?.profiles?.consent_given;
    const isPaused = donorProfile?.notifications_paused;
    const isAvailable = donorProfile?.is_available;

    if (!consentGiven || isPaused || !isAvailable) {
      return this._updateJobStatus(
        job.id,
        'cancelled_pre_dispatch',
        'Donor withdrew consent, paused notifications, or marked unavailable before dispatch.'
      );
    }

    // 2. Increment attempt counter
    const nextAttempt = job.attempt_count + 1;

    // 3. Dispatch via channel adapter
    try {
      const result = await providerAdapter(job.channel, job.payload);

      if (result.success && result.provider_message_id) {
        // IMPORTANT: Provider submission is marked 'sent', NEVER 'delivered' until webhook receipt
        const { data: updated } = await supabase
          .from('notification_jobs')
          .update({
            status: 'sent',
            attempt_count: nextAttempt,
            provider_message_id: result.provider_message_id,
            provider_status: 'accepted_by_provider',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .select()
          .single();

        return (updated as NotificationJob) || { ...job, status: 'sent', attempt_count: nextAttempt };
      }

      // Handle provider error & dead-letter queueing
      const isDeadLetter = nextAttempt >= job.max_attempts;
      const finalStatus = isDeadLetter ? 'dead_letter' : 'failed';

      const { data: updated } = await supabase
        .from('notification_jobs')
        .update({
          status: finalStatus,
          attempt_count: nextAttempt,
          error_message: result.error || 'Provider dispatch failed.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single();

      return (
        (updated as NotificationJob) || {
          ...job,
          status: finalStatus,
          attempt_count: nextAttempt,
          error_message: result.error,
        }
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Channel execution exception';
      const isDeadLetter = nextAttempt >= job.max_attempts;
      const finalStatus = isDeadLetter ? 'dead_letter' : 'failed';

      const { data: updated } = await supabase
        .from('notification_jobs')
        .update({
          status: finalStatus,
          attempt_count: nextAttempt,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select()
        .single();

      return (
        (updated as NotificationJob) || {
          ...job,
          status: finalStatus,
          attempt_count: nextAttempt,
          error_message: errorMessage,
        }
      );
    }
  },

  /**
   * Process inbound delivery webhook with deduplication and replay defense.
   */
  async handleDeliveryWebhook(
    webhook: DeliveryWebhookPayload
  ): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
    try {
      // 1. Check for duplicate webhook submission
      const { data: existing } = await supabase
        .from('notification_delivery_webhooks')
        .select('id, processed')
        .eq('provider', webhook.provider)
        .eq('provider_message_id', webhook.provider_message_id)
        .eq('event_type', webhook.event_type)
        .single();

      if (existing) {
        return { success: true, duplicate: true };
      }

      // 2. Log webhook receipt
      const { data: logged } = await supabase
        .from('notification_delivery_webhooks')
        .insert({
          provider: webhook.provider,
          provider_message_id: webhook.provider_message_id,
          event_type: webhook.event_type,
          payload: webhook.raw_payload,
          processed: false,
        })
        .select()
        .single();

      // 3. Update corresponding notification job status
      if (webhook.event_type === 'delivered') {
        await supabase
          .from('notification_jobs')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('provider_message_id', webhook.provider_message_id);
      } else if (webhook.event_type === 'failed' || webhook.event_type === 'undelivered') {
        await supabase
          .from('notification_jobs')
          .update({
            status: 'failed',
            error_message: `Webhook reported ${webhook.event_type}`,
            updated_at: new Date().toISOString(),
          })
          .eq('provider_message_id', webhook.provider_message_id);
      }

      // 4. Mark webhook as processed
      if (logged) {
        await supabase
          .from('notification_delivery_webhooks')
          .update({ processed: true })
          .eq('id', logged.id);
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error processing delivery webhook.';
      return { success: false, error: message };
    }
  },

  /**
   * Retrieve notification dispatch summary aggregated across channels and status.
   */
  async getDispatchSummary(requestId: string): Promise<NotificationDispatchSummary> {
    const summary: NotificationDispatchSummary = {
      request_id: requestId,
      total_jobs: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      dead_letter: 0,
      cancelled_pre_dispatch: 0,
      by_channel: {
        whatsapp: { queued: 0, sent: 0, delivered: 0, failed: 0 },
        sms: { queued: 0, sent: 0, delivered: 0, failed: 0 },
        email: { queued: 0, sent: 0, delivered: 0, failed: 0 },
        push: { queued: 0, sent: 0, delivered: 0, failed: 0 },
      },
    };

    try {
      const { data: jobs } = await supabase
        .from('notification_jobs')
        .select('*')
        .eq('request_id', requestId);

      if (!jobs || jobs.length === 0) return summary;

      summary.total_jobs = jobs.length;

      jobs.forEach((j: NotificationJob) => {
        if (j.status === 'queued') summary.queued++;
        if (j.status === 'sent') summary.sent++;
        if (j.status === 'delivered') summary.delivered++;
        if (j.status === 'failed') summary.failed++;
        if (j.status === 'dead_letter') summary.dead_letter++;
        if (j.status === 'cancelled_pre_dispatch') summary.cancelled_pre_dispatch++;

        const channelStats = summary.by_channel[j.channel];
        if (channelStats) {
          if (j.status === 'queued') channelStats.queued++;
          if (j.status === 'sent') channelStats.sent++;
          if (j.status === 'delivered') channelStats.delivered++;
          if (j.status === 'failed' || j.status === 'dead_letter') channelStats.failed++;
        }
      });

      return summary;
    } catch {
      return summary;
    }
  },

  async _updateJobStatus(
    jobId: string,
    status: NotificationJob['status'],
    errorMessage?: string
  ): Promise<NotificationJob> {
    const { data } = await supabase
      .from('notification_jobs')
      .update({
        status,
        error_message: errorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    return (data as NotificationJob) || ({ id: jobId, status, error_message: errorMessage } as unknown as NotificationJob);
  },
};
