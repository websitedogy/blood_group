-- LIFELOOP AI - Gate 5: Four-Channel Notifications Queue, Isolation & Webhooks

-- 1. Create Channel and Job Status Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel_type') THEN
        CREATE TYPE public.notification_channel_type AS ENUM ('whatsapp', 'sms', 'email', 'push');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_job_status') THEN
        CREATE TYPE public.notification_job_status AS ENUM (
            'queued',
            'sending',
            'sent',
            'delivered',
            'failed',
            'dead_letter',
            'cancelled_pre_dispatch'
        );
    END IF;
END $$;

-- 2. Create Notification Jobs Table
CREATE TABLE IF NOT EXISTS public.notification_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel public.notification_channel_type NOT NULL,
    status public.notification_job_status NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    provider_message_id VARCHAR(100),
    provider_status VARCHAR(50),
    error_message TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Webhook Audit & Deduplication Table
CREATE TABLE IF NOT EXISTS public.notification_delivery_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(30) NOT NULL,
    provider_message_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notif_jobs_request ON public.notification_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_donor ON public.notification_jobs(donor_id);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_status ON public.notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_msg ON public.notification_delivery_webhooks(provider, provider_message_id);

-- 4. Enable Row-Level Security
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_webhooks ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies
-- Donors can only view notification jobs dispatched to them
CREATE POLICY "notification_jobs_select_donor"
    ON public.notification_jobs
    FOR SELECT
    USING (auth.uid() = donor_id);

-- Requesters can view delivery status summary for their request
CREATE POLICY "notification_jobs_select_requester"
    ON public.notification_jobs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_requests req
            WHERE req.id = notification_jobs.request_id
              AND req.requester_id = auth.uid()
        )
    );

-- Record Gate 5 Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000004', 'Gate 5 Notifications: 4-channel queue, idempotency, retry, dead-letter, and webhook audit')
ON CONFLICT (version) DO NOTHING;
