-- ============================================================
-- D&J Car Rentals: migration v9
-- A car can go back out on the day it is returned.
--
-- The overlap rule treated both the start and the return date as taken, so
-- a car back on the 21st could not be rented again on the 21st. Billing
-- already counts nights (the 20th to the 21st is one day), so the return
-- date is handover day and should be free for the next rental.
--
-- Each rental now holds [start_date, end_date), or just its own day when it
-- starts and ends on the same day. Every range this produces is contained in
-- the old one, so no existing rental can clash under the new rule, and the
-- constraint cannot fail to build on the data already there.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_no_overlap;
ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap EXCLUDE USING gist (
  vehicle_id WITH =,
  daterange(start_date, greatest(end_date, start_date + 1), '[)') WITH &&
) WHERE (vehicle_id IS NOT NULL AND deleted_at IS NULL);
