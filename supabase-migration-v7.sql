-- ============================================
-- D&J Car Rentals - Migration v7: deleting keeps the record
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- Deleting must never destroy a financial record. Rows are now marked with
-- deleted_at instead of being removed: they vanish from every list in the
-- admin but stay in the database and in the backup file, so a mis-tap cannot
-- erase history the business may need years later.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE renters  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rentals  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- A deleted vehicle should not hold its Vehicle ID or plate hostage, so the
-- uniqueness applies only to vehicles that are still live.
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_id_key;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_license_plate_key;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vehicle_id_live_idx
  ON vehicles (vehicle_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_license_plate_live_idx
  ON vehicles (license_plate) WHERE deleted_at IS NULL;

-- A deleted rental must not keep blocking its dates for that vehicle.
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_no_overlap;
ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap EXCLUDE USING gist (
  vehicle_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
) WHERE (vehicle_id IS NOT NULL AND deleted_at IS NULL);

-- A deleted payment must not count towards what a rental has been paid.
CREATE OR REPLACE FUNCTION sync_rental_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  target UUID;
  total DECIMAL(10,2);
  charge DECIMAL(10,2);
BEGIN
  target := COALESCE(NEW.rental_id, OLD.rental_id);
  IF target IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO total
    FROM payments WHERE rental_id = target AND deleted_at IS NULL;
  SELECT total_charge INTO charge FROM rentals WHERE id = target;
  IF charge IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE rentals SET
    amount_paid = total,
    payment_status = CASE
      WHEN total <= 0 THEN 'unpaid'
      WHEN total >= charge THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Listing live rows is the common query on every page.
CREATE INDEX IF NOT EXISTS vehicles_live_idx ON vehicles (created_at)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS renters_live_idx  ON renters (name)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS rentals_live_idx  ON rentals (start_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_live_idx ON payments (paid_on DESC)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_live_idx ON expenses (spent_on DESC)  WHERE deleted_at IS NULL;

-- To see what has been removed:
--   SELECT 'rental' AS kind, id, deleted_at FROM rentals  WHERE deleted_at IS NOT NULL
--   UNION ALL SELECT 'cost', id, deleted_at FROM expenses WHERE deleted_at IS NOT NULL
--   ORDER BY deleted_at DESC;
