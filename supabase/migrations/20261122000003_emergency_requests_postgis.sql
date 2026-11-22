-- LIFELOOP AI - Gate 4: Emergency SOS Requests, Status Lifecycle & PostGIS Matching

-- 1. Create Urgency Level and Request Status Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level_type') THEN
        CREATE TYPE public.urgency_level_type AS ENUM ('critical', 'urgent', 'standard');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status_type') THEN
        CREATE TYPE public.request_status_type AS ENUM (
            'pending_verification',
            'verified',
            'broadcasting',
            'fulfilled',
            'cancelled',
            'expired'
        );
    END IF;
END $$;

-- 2. Create Emergency Requests Table
CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_name VARCHAR(100) NOT NULL,
    blood_group public.blood_group_type NOT NULL,
    units_needed INTEGER NOT NULL CHECK (units_needed >= 1 AND units_needed <= 20),
    hospital_name VARCHAR(150) NOT NULL,
    hospital_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326),
    contact_phone VARCHAR(20) NOT NULL,
    urgency_level public.urgency_level_type NOT NULL DEFAULT 'urgent',
    status public.request_status_type NOT NULL DEFAULT 'pending_verification',
    is_ai_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    user_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    idempotency_key VARCHAR(64) UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PostGIS Request Location Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_request_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_request_location ON public.emergency_requests;
CREATE TRIGGER tr_sync_request_location
    BEFORE INSERT OR UPDATE ON public.emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_request_location();

-- 4. Status History Tracking Table & Trigger
CREATE TABLE IF NOT EXISTS public.request_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    previous_status public.request_status_type,
    new_status public.request_status_type NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.log_request_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.request_status_history (request_id, previous_status, new_status, changed_by, change_reason)
        VALUES (NEW.id, NULL, NEW.status, NEW.requester_id, 'Emergency request created');
    ELSIF (OLD.status <> NEW.status) THEN
        INSERT INTO public.request_status_history (request_id, previous_status, new_status, changed_by, change_reason)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status transition');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_log_request_status ON public.emergency_requests;
CREATE TRIGGER tr_log_request_status
    AFTER INSERT OR UPDATE ON public.emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_request_status_transition();

-- 5. PostGIS Donor Matching Stored Function
-- IMPORTANT: EXACT DONOR COORDINATES, PHONE, AND NAME ARE NEVER RETURNED!
CREATE OR REPLACE FUNCTION public.find_matching_donors(
    p_request_id UUID,
    p_radius_km DOUBLE PRECISION DEFAULT 25.0,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    donor_id UUID,
    blood_group public.blood_group_type,
    distance_meters DOUBLE PRECISION,
    preferred_channels TEXT[]
) AS $$
DECLARE
    v_req_location GEOGRAPHY(Point, 4326);
    v_req_blood_group public.blood_group_type;
    v_req_status public.request_status_type;
    v_is_expired BOOLEAN;
BEGIN
    -- Fetch request details
    SELECT location, blood_group, status, (expires_at < NOW())
    INTO v_req_location, v_req_blood_group, v_req_status, v_is_expired
    FROM public.emergency_requests
    WHERE id = p_request_id;

    IF v_req_location IS NULL OR v_req_status IN ('cancelled', 'fulfilled') OR v_is_expired THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        dp.id AS donor_id,
        dp.blood_group,
        ST_Distance(dp.location, v_req_location) AS distance_meters,
        dp.preferred_channels
    FROM public.donor_profiles dp
    JOIN public.profiles p ON p.id = dp.id
    WHERE dp.blood_group = v_req_blood_group
      AND dp.is_available = TRUE
      AND dp.notifications_paused = FALSE
      AND p.status = 'active'
      AND p.consent_given = TRUE
      AND dp.location IS NOT NULL
      AND ST_DWithin(
          dp.location,
          v_req_location,
          LEAST(dp.notification_radius_km * 1000.0, p_radius_km * 1000.0)
      )
    ORDER BY distance_meters ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row-Level Security (RLS)
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Requesters can read all requests they created
CREATE POLICY "emergency_requests_select_own"
    ON public.emergency_requests
    FOR SELECT
    USING (auth.uid() = requester_id OR status IN ('verified', 'broadcasting'));

-- Authenticated users can insert requests
CREATE POLICY "emergency_requests_insert"
    ON public.emergency_requests
    FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Requesters can cancel or update their own pending requests
CREATE POLICY "emergency_requests_update_own"
    ON public.emergency_requests
    FOR UPDATE
    USING (auth.uid() = requester_id)
    WITH CHECK (auth.uid() = requester_id);

-- Request status history viewable by requester or involved parties
CREATE POLICY "status_history_select_own"
    ON public.request_status_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emergency_requests req
            WHERE req.id = request_status_history.request_id
              AND (req.requester_id = auth.uid() OR req.status IN ('verified', 'broadcasting'))
        )
    );

-- 8. Record Gate 4 Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000003', 'Gate 4 Emergency Requests: PostGIS matching, status history lifecycle, and coordinate privacy')
ON CONFLICT (version) DO NOTHING;
