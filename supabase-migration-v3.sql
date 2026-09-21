-- ============================================
-- D&K Car Rentals - Migration v3: bookkeeping
-- Adds dated payments and per-vehicle expenses so monthly profit can be
-- calculated for tax filing.
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- ---------- Payments ----------
-- Money is taxed in the month it is received, so each payment needs its own
-- date. rentals.amount_paid is kept up to date automatically from this table.
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  paid_on DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method TEXT CHECK (method IN ('cash', 'transfer', 'card', 'cheque', 'other')) DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_rental_idx ON payments (rental_id);
CREATE INDEX IF NOT EXISTS payments_paid_on_idx ON payments (paid_on DESC);

-- Keep rentals.amount_paid and payment_status in step with the payments table.
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
  SELECT COALESCE(SUM(amount), 0) INTO total FROM payments WHERE rental_id = target;
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_sync_rental ON payments;
CREATE TRIGGER payments_sync_rental
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION sync_rental_payment_totals();

-- Backfill: turn each existing amount_paid into one payment row so no money
-- is lost. Dated on the rental start date, which is the best guess available.
INSERT INTO payments (rental_id, paid_on, amount, method, notes)
SELECT r.id, r.start_date, r.amount_paid, 'other', 'Imported from earlier records'
FROM rentals r
WHERE r.amount_paid > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = r.id);

-- ---------- Expenses ----------
-- vehicle_id NULL means a business-wide cost that is not tied to one car.
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  spent_on DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'fuel', 'maintenance', 'repair', 'tires', 'parts', 'insurance',
    'registration', 'cleaning', 'towing', 'loan', 'fees', 'other'
  )),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  vendor TEXT,
  description TEXT,
  odometer INTEGER CHECK (odometer IS NULL OR odometer >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON expenses (spent_on DESC);
CREATE INDEX IF NOT EXISTS expenses_vehicle_idx ON expenses (vehicle_id, spent_on DESC);

-- ---------- Row Level Security ----------
-- Both tables are admin-only. No policies means the public anon key can read
-- and write nothing; the app's API routes use the service role key.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
