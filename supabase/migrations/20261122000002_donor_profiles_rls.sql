-- LIFELOOP AI - Gate 3: Donor Profiles, Preferences & Response History Schema

-- 1. Create Blood Group Enum if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_group_type') THEN
        CREATE TYPE public.blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donor_response_type') THEN
        CREATE TYPE public.donor_response_type AS ENUM ('accepted', 'declined', 'cancelled');
    END IF;
END $$;

-- 2. Create Donor Profiles Table
CREATE TABLE IF NOT EXISTS public.donor_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    blood_group public.blood_group_type NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_paused BOOLEAN NOT NULL DEFAULT FALSE,
    notification_radius_km INTEGER NOT NULL DEFAULT 10 CHECK (notification_radius_km BETWEEN 1 AND 50),
    preferred_channels TEXT[] NOT NULL DEFAULT ARRAY['push', 'sms'],
    last_donation_date DATE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PostGIS Location Synchronization Trigger
CREATE OR REPLACE FUNCTION public.sync_donor_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location = NULL;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_donor_location ON public.donor_profiles;
CREATE TRIGGER tr_sync_donor_location
    BEFORE INSERT OR UPDATE ON public.donor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_donor_location();

-- 4. Create Donor Responses Table
CREATE TABLE IF NOT EXISTS public.donor_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    response_status public.donor_response_type NOT NULL DEFAULT 'accepted',
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_responses ENABLE ROW LEVEL SECURITY;

-- 6. Strict RLS Policies for Donor Profiles
-- Donors can only read their own profile
CREATE POLICY "donor_profiles_select_own"
    ON public.donor_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Donors can only insert their own profile
CREATE POLICY "donor_profiles_insert_own"
    ON public.donor_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Donors can only update their own profile
CREATE POLICY "donor_profiles_update_own"
    ON public.donor_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 7. Strict RLS Policies for Donor Responses
-- Donors can only view their own response history
CREATE POLICY "donor_responses_select_own"
    ON public.donor_responses
    FOR SELECT
    USING (auth.uid() = donor_id);

-- Donors can only insert their own responses
CREATE POLICY "donor_responses_insert_own"
    ON public.donor_responses
    FOR INSERT
    WITH CHECK (auth.uid() = donor_id);

-- 8. Record Gate 3 Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000002', 'Gate 3 Donor Profiles: donor_profiles with PostGIS sync, response history, and strict RLS')
ON CONFLICT (version) DO NOTHING;
