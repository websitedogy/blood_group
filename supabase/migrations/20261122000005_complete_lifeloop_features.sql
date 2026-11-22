-- LIFELOOP AI - Complete Schema: Chat, Mutual Consent, Hospital Inventory, Heroes & Analytics

-- 1. Chat & Mutual Contact Consent (Gate 6)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.emergency_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (request_id, donor_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mutual Phone Number Sharing Consent Table
-- Both numbers remain HIDDEN unless both participants explicitly approve sharing their own number
CREATE TABLE IF NOT EXISTS public.contact_share_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, user_id)
);

-- Stored RPC to safely fetch shared contact info ONLY IF both participants approved
CREATE OR REPLACE FUNCTION public.get_mutual_contact_info(p_room_id UUID)
RETURNS TABLE (
    donor_phone VARCHAR(20),
    requester_phone VARCHAR(20),
    is_mutually_shared BOOLEAN
) AS $$
DECLARE
    v_donor_id UUID;
    v_requester_id UUID;
    v_donor_consent BOOLEAN;
    v_requester_consent BOOLEAN;
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();

    SELECT donor_id, requester_id INTO v_donor_id, v_requester_id
    FROM public.chat_rooms WHERE id = p_room_id;

    IF v_caller_id <> v_donor_id AND v_caller_id <> v_requester_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a participant in this chat room.';
    END IF;

    SELECT COALESCE(consent_given, FALSE) INTO v_donor_consent
    FROM public.contact_share_consents WHERE room_id = p_room_id AND user_id = v_donor_id;

    SELECT COALESCE(consent_given, FALSE) INTO v_requester_consent
    FROM public.contact_share_consents WHERE room_id = p_room_id AND user_id = v_requester_id;

    IF v_donor_consent IS TRUE AND v_requester_consent IS TRUE THEN
        RETURN QUERY
        SELECT p_donor.phone, p_req.phone, TRUE
        FROM public.profiles p_donor, public.profiles p_req
        WHERE p_donor.id = v_donor_id AND p_req.id = v_requester_id;
    ELSE
        -- Numbers remain completely hidden
        RETURN QUERY SELECT NULL::VARCHAR(20), NULL::VARCHAR(20), FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hospitals and Blood Bank Inventory (Gate 7)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    org_type VARCHAR(30) NOT NULL CHECK (org_type IN ('hospital', 'blood_bank', 'red_cross')),
    license_number VARCHAR(50) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    district VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_role VARCHAR(30) NOT NULL CHECK (staff_role IN ('admin', 'inventory_manager', 'verifier')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.blood_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    blood_group public.blood_group_type NOT NULL,
    component_type VARCHAR(30) NOT NULL CHECK (component_type IN ('whole_blood', 'prbc', 'platelets', 'ffp')),
    units_available INTEGER NOT NULL CHECK (units_available >= 0),
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, blood_group, component_type)
);

-- 3. Recognition & Impact Analytics (Gate 9)
CREATE TABLE IF NOT EXISTS public.lifeloop_heroes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    donation_count INTEGER NOT NULL DEFAULT 1,
    recognition_badge VARCHAR(50) NOT NULL DEFAULT 'Lifesaver',
    public_display_name VARCHAR(100) NOT NULL,
    district VARCHAR(50) NOT NULL,
    consent_for_recognition BOOLEAN NOT NULL DEFAULT TRUE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.impact_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    story_text TEXT NOT NULL,
    patient_initials VARCHAR(10) NOT NULL,
    hospital_name VARCHAR(150) NOT NULL,
    district VARCHAR(50) NOT NULL,
    units_donated INTEGER NOT NULL,
    is_moderated BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS across all tables
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_share_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifeloop_heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_stories ENABLE ROW LEVEL SECURITY;

-- Strict Chat RLS: only room participants can read/write messages
CREATE POLICY "chat_rooms_participants"
    ON public.chat_rooms
    FOR ALL
    USING (auth.uid() = donor_id OR auth.uid() = requester_id);

CREATE POLICY "chat_messages_participants"
    ON public.chat_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms cr
            WHERE cr.id = chat_messages.room_id
              AND (cr.donor_id = auth.uid() OR cr.requester_id = auth.uid())
        )
    );

CREATE POLICY "contact_consents_participants"
    ON public.contact_share_consents
    FOR ALL
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.chat_rooms cr
            WHERE cr.id = contact_share_consents.room_id
              AND (cr.donor_id = auth.uid() OR cr.requester_id = auth.uid())
        )
    );

-- Public can view verified organizations & blood inventory
CREATE POLICY "organizations_public_select"
    ON public.organizations
    FOR SELECT
    USING (is_verified = TRUE);

CREATE POLICY "blood_inventory_public_select"
    ON public.blood_inventory
    FOR SELECT
    USING (TRUE);

-- Public can view approved recognition & stories (Strictly anonymized)
CREATE POLICY "heroes_public_select"
    ON public.lifeloop_heroes
    FOR SELECT
    USING (is_approved = TRUE AND consent_for_recognition = TRUE);

CREATE POLICY "stories_public_select"
    ON public.impact_stories
    FOR SELECT
    USING (is_moderated = TRUE);

-- Record Complete Schema Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000005', 'Gate 6-9 Complete: Chat, Mutual Consent, Blood Inventory, Heroes, and Impact Analytics')
ON CONFLICT (version) DO NOTHING;
