-- LIFELOOP AI - Gate 2: Authentication & Profiles Schema with Strict RLS

-- 1. Create Profile Status and Role types if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('donor', 'recipient', 'hospital_staff', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'deleted');
    END IF;
END $$;

-- 2. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    role public.user_role NOT NULL DEFAULT 'donor',
    status public.account_status NOT NULL DEFAULT 'active',
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Strict RLS Policies

-- Users can only read their own profile
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can insert their own initial profile row (matching auth.uid)
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update only their own profile
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 5. Role Escalation Prevention Trigger
-- Prevents clients from updating their own 'role' or 'status'
CREATE OR REPLACE FUNCTION public.enforce_profile_role_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow role or status modifications if executing via service role or admin
    IF (NEW.role <> OLD.role OR NEW.status <> OLD.status) THEN
        IF (auth.jwt() ->> 'role' <> 'service_role' AND (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: Role and account status escalation is prohibited.';
        END IF;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_enforce_profile_role_integrity ON public.profiles;
CREATE TRIGGER tr_enforce_profile_role_integrity
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_role_integrity();

-- 6. Record Gate 2 Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000001', 'Gate 2 Authentication: profiles table with strict RLS and role escalation guards')
ON CONFLICT (version) DO NOTHING;
