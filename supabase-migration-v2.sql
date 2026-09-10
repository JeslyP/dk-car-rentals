-- ============================================
-- D&K Car Rentals - Migration from v1 schema to v2
-- Run this ONCE in the Supabase SQL Editor on an EXISTING project.
-- Safe to re-run: every statement is idempotent.
-- ============================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Drop the old trigger. It marked a vehicle unavailable the moment any
--    rental was inserted (even a future one) and available again when any
--    rental was deleted (even if another was still active). Availability is
--    now computed from rental dates in the app.
DROP TRIGGER IF EXISTS rental_vehicle_availability ON rentals;
DROP FUNCTION IF EXISTS update_vehicle_availability();

-- Vehicles that were auto-flagged by the old trigger get re-listed. If you
-- deliberately hid a vehicle, untick "Listed for rent" in the admin afterwards.
UPDATE vehicles SET is_available = true WHERE is_available = false;

-- 2. Constraints and indexes
ALTER TABLE vehicles ALTER COLUMN is_available SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN is_available SET DEFAULT true;

ALTER TABLE rentals ALTER COLUMN amount_paid SET DEFAULT 0;
UPDATE rentals SET amount_paid = 0 WHERE amount_paid IS NULL;
ALTER TABLE rentals ALTER COLUMN amount_paid SET NOT NULL;
UPDATE rentals SET payment_status = 'unpaid' WHERE payment_status IS NULL;
ALTER TABLE rentals ALTER COLUMN payment_status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE rentals ADD CONSTRAINT rentals_dates_check CHECK (end_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE rental_requests ADD CONSTRAINT rental_requests_dates_check CHECK (end_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Overlap protection. If this fails with "could not create exclusion
-- constraint", you have existing rentals for the same vehicle with
-- overlapping dates: fix those rows in the admin, then re-run this file.
DO $$ BEGIN
  ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (vehicle_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS rentals_vehicle_dates_idx ON rentals (vehicle_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS rentals_renter_idx ON rentals (renter_id);
CREATE INDEX IF NOT EXISTS renters_phone_idx ON renters (phone);
CREATE INDEX IF NOT EXISTS rental_requests_status_idx ON rental_requests (status, created_at DESC);

-- 3. Row Level Security: lock the anon key down to reading listed vehicles.
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE renters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Public can submit requests" ON rental_requests;
DROP POLICY IF EXISTS "Service role full access vehicles" ON vehicles;
DROP POLICY IF EXISTS "Service role full access renters" ON renters;
DROP POLICY IF EXISTS "Service role full access rentals" ON rentals;
DROP POLICY IF EXISTS "Service role full access requests" ON rental_requests;
-- If you opened things up manually while the old admin was broken, drop
-- those policies too. List them with:
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

DROP POLICY IF EXISTS "Public can view listed vehicles" ON vehicles;
CREATE POLICY "Public can view listed vehicles" ON vehicles
  FOR SELECT TO anon, authenticated USING (is_available = true);
