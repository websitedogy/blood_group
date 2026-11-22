-- LIFELOOP AI - Gate 1: Foundation Migration
-- Enables foundational extensions for PostGIS geospatial matching and UUID generation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Schema migration tracking & audit table
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

-- Record Gate 1 Foundation Migration
INSERT INTO public.schema_migrations (version, description)
VALUES ('20261122000000', 'Gate 1 Foundation: PostGIS and UUID extensions initialized')
ON CONFLICT (version) DO NOTHING;
