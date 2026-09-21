-- ============================================
-- D&J Car Rentals - Migration v5: lock down database access
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- ---------- Remove wide-open policies ----------
-- Policies of the shape FOR ALL TO public USING (true) WITH CHECK (true) let
-- any holder of the public anon key read, insert, update and delete every
-- row. That key ships inside the website's JavaScript, so it is effectively
-- public. They tend to get added while debugging and then forgotten.
--
-- The app does not need them: admin traffic goes through the API routes using
-- the service role key, which bypasses row level security. The browser only
-- needs to read listed vehicles.
DROP POLICY IF EXISTS "Allow all on vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow all on renters" ON renters;
DROP POLICY IF EXISTS "Allow all on rentals" ON rentals;
DROP POLICY IF EXISTS "Allow all on rental_requests" ON rental_requests;

-- List anything else that is still open with:
--   SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public';

-- ---------- Take away the default table grants ----------
-- Supabase grants SELECT on public tables to anon and authenticated by
-- default. Row level security already blocks the rows, but the grant exposes
-- table and column names through the auto-generated GraphQL schema, and it
-- means a permissive policy added by mistake later would immediately expose
-- real data. Defence in depth: the admin tables need no browser access.
REVOKE ALL ON TABLE renters, rentals, rental_requests FROM anon, authenticated;

-- Only if migration v3 has been run (these tables may not exist yet).
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON TABLE payments, expenses FROM anon, authenticated';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'payments/expenses not present yet; run migration v3 then this file again.';
END $$;

-- The website lists the fleet with the public key, so vehicles keeps SELECT
-- and loses everything else.
REVOKE ALL ON TABLE vehicles FROM anon, authenticated;
GRANT SELECT ON TABLE vehicles TO anon, authenticated;

-- ---------- Pin the trigger function's search_path ----------
-- Stops the function resolving names against a caller-controlled search_path.
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.sync_rental_payment_totals() SET search_path = public, pg_temp';
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'sync_rental_payment_totals() not present yet; run migration v3 then this file again.';
END $$;
