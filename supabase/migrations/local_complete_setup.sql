-- ====================================================================
-- LIFELOOP AI - Complete Local PostgreSQL 18 Database Setup
-- Platform: Windows PostgreSQL 18 + PostGIS
-- Database: blood_group (or blood_donation)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. AUTH COMPATIBILITY LAYER (for local Postgres without GoTrue)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    phone VARCHAR(50)
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID,
        'd0000000-0000-4000-8000-000000000001'::UUID
    );
$$ LANGUAGE SQL STABLE;

-- 3. CUSTOM ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('donor', 'recipient', 'hospital_staff', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'deleted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_group') THEN
        CREATE TYPE public.blood_group AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_urgency') THEN
        CREATE TYPE public.emergency_urgency AS ENUM ('critical', 'high', 'moderate');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
        CREATE TYPE public.request_status AS ENUM (
            'pending_verification', 'verified', 'broadcasting', 'fulfilled', 'cancelled', 'expired'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE public.notification_channel AS ENUM ('whatsapp', 'sms', 'email', 'push');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE public.job_status AS ENUM ('pending', 'dispatching', 'sent', 'delivered', 'failed', 'dead_letter', 'cancelled_pre_dispatch');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type') THEN
        CREATE TYPE public.organization_type AS ENUM ('hospital', 'blood_bank');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE public.staff_role AS ENUM ('owner', 'admin', 'coordinator');
    END IF;
END $$;

-- 4. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    role public.user_role NOT NULL DEFAULT 'donor',
    status public.account_status NOT NULL DEFAULT 'active',
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DONOR PROFILES TABLE (PostGIS)
CREATE TABLE IF NOT EXISTS public.donor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    blood_group public.blood_group NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_paused BOOLEAN NOT NULL DEFAULT FALSE,
    notification_radius_km NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (notification_radius_km >= 1.00 AND notification_radius_km <= 50.00),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location geography(POINT, 4326),
    city VARCHAR(100),
    state VARCHAR(100),
    preferred_channels public.notification_channel[] NOT NULL DEFAULT ARRAY['whatsapp', 'push']::public.notification_channel[],
    last_donation_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donor_profiles_location ON public.donor_profiles USING GIST(location);

-- Function & Trigger: Sync donor coordinates to PostGIS geography point
CREATE OR REPLACE FUNCTION public.fn_sync_donor_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location := NULL;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_donor_location ON public.donor_profiles;
CREATE TRIGGER tr_sync_donor_location
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON public.donor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_donor_location();

-- 6. DONOR RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.donor_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.donor_profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('accepted', 'declined', 'cannot_help')),
    response_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EMERGENCY REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_name VARCHAR(100) NOT NULL,
    blood_group public.blood_group NOT NULL,
    units_needed INTEGER NOT NULL CHECK (units_needed >= 1 AND units_needed <= 20),
    hospital_name VARCHAR(150) NOT NULL,
    hospital_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    location geography(POINT, 4326),
    urgency public.emergency_urgency NOT NULL DEFAULT 'critical',
    attendant_phone VARCHAR(20) NOT NULL,
    notes TEXT,
    is_ai_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    ai_fields_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    status public.request_status NOT NULL DEFAULT 'pending_verification',
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_location ON public.emergency_requests USING GIST(location);

CREATE OR REPLACE FUNCTION public.fn_sync_emergency_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_emergency_location ON public.emergency_requests;
CREATE TRIGGER tr_sync_emergency_location
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON public.emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_emergency_location();

-- 8. STATUS AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    previous_status public.request_status,
    new_status public.request_status NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.fn_audit_emergency_status()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.request_status_history (
            request_id, previous_status, new_status, changed_by, reason
        ) VALUES (
            NEW.id, OLD.status, NEW.status, auth.uid(), 'Status updated via platform'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_audit_emergency_status ON public.emergency_requests;
CREATE TRIGGER tr_audit_emergency_status
    AFTER UPDATE OF status
    ON public.emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_emergency_status();

-- 9. POSTGIS MATCHING STORED RPC (Never exposes private donor coords or phone numbers)
CREATE OR REPLACE FUNCTION public.find_matching_donors(
    p_request_id UUID,
    p_radius_km NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    donor_id UUID,
    blood_group public.blood_group,
    distance_meters DOUBLE PRECISION,
    preferred_channels public.notification_channel[]
) AS $$
DECLARE
    v_req_location geography(POINT, 4326);
    v_req_blood_group public.blood_group;
    v_req_status public.request_status;
BEGIN
    SELECT location, blood_group, status
    INTO v_req_location, v_req_blood_group, v_req_status
    FROM public.emergency_requests
    WHERE id = p_request_id;

    IF v_req_location IS NULL THEN
        RAISE EXCEPTION 'Request % not found or location coordinates missing', p_request_id;
    END IF;

    IF v_req_status NOT IN ('verified', 'broadcasting') THEN
        RAISE EXCEPTION 'Request % is in status %, not eligible for matching', p_request_id, v_req_status;
    END IF;

    RETURN QUERY
    SELECT
        d.id AS donor_id,
        d.blood_group,
        ST_Distance(d.location, v_req_location) AS distance_meters,
        d.preferred_channels
    FROM public.donor_profiles d
    JOIN public.profiles p ON d.user_id = p.id
    WHERE d.blood_group = v_req_blood_group
      AND d.is_available = TRUE
      AND d.notifications_paused = FALSE
      AND p.consent_given = TRUE
      AND p.status = 'active'
      AND d.location IS NOT NULL
      AND ST_DWithin(
          d.location,
          v_req_location,
          COALESCE(p_radius_km * 1000.0, d.notification_radius_km * 1000.0)
      )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. NOTIFICATION JOBS QUEUE
CREATE TABLE IF NOT EXISTS public.notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.donor_profiles(id) ON DELETE CASCADE,
    channel public.notification_channel NOT NULL,
    recipient_destination VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    status public.job_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    provider_reference VARCHAR(100),
    error_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. CHAT ROOMS & MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_room UNIQUE (request_id, donor_id, requester_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. DUAL-PARTY MUTUAL PHONE SHARING CONSENT
CREATE TABLE IF NOT EXISTS public.contact_share_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consented BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_user_consent UNIQUE (room_id, user_id)
);

-- RPC: Returns contact numbers ONLY when BOTH parties agree
CREATE OR REPLACE FUNCTION public.get_mutual_contact_info(p_room_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_room RECORD;
    v_donor_consent BOOLEAN := FALSE;
    v_requester_consent BOOLEAN := FALSE;
    v_donor_phone VARCHAR(20);
    v_requester_phone VARCHAR(20);
BEGIN
    SELECT * INTO v_room FROM public.chat_rooms WHERE id = p_room_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chat room not found';
    END IF;

    SELECT consented INTO v_donor_consent FROM public.contact_share_consents
    WHERE room_id = p_room_id AND user_id = v_room.donor_id;

    SELECT consented INTO v_requester_consent FROM public.contact_share_consents
    WHERE room_id = p_room_id AND user_id = v_room.requester_id;

    IF COALESCE(v_donor_consent, FALSE) AND COALESCE(v_requester_consent, FALSE) THEN
        SELECT phone INTO v_donor_phone FROM public.profiles WHERE id = v_room.donor_id;
        SELECT phone INTO v_requester_phone FROM public.profiles WHERE id = v_room.requester_id;
        RETURN jsonb_build_object(
            'mutual_consent_established', TRUE,
            'donor_phone', v_donor_phone,
            'requester_phone', v_requester_phone
        );
    ELSE
        RETURN jsonb_build_object(
            'mutual_consent_established', FALSE,
            'donor_consented', COALESCE(v_donor_consent, FALSE),
            'requester_consented', COALESCE(v_requester_consent, FALSE)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. ORGANIZATIONS, STAFF & BLOOD INVENTORY
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type public.organization_type NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.staff_role NOT NULL DEFAULT 'coordinator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.blood_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    blood_group public.blood_group NOT NULL,
    units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_blood_group UNIQUE (organization_id, blood_group)
);

-- 14. RECOGNITION & LIFELOOP HEROES
CREATE TABLE IF NOT EXISTS public.lifeloop_heroes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.donor_profiles(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.emergency_requests(id) ON DELETE SET NULL,
    badge_title VARCHAR(100) NOT NULL,
    donation_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_to_feature BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.impact_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_id UUID REFERENCES public.lifeloop_heroes(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    story_summary TEXT NOT NULL,
    lives_saved INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. OPTIONAL: SET USER PASSWORD FOR CLI TOOLS
ALTER USER postgres WITH PASSWORD 'Zealstar_02';

-- ====================================================================
-- SUCCESS: All LIFELOOP AI Tables, Functions & PostGIS triggers created!
-- ====================================================================
