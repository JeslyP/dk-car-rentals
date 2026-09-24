-- ============================================
-- D&J Car Rentals - Supabase Database Schema (v3)
-- Run this in your Supabase SQL Editor on a NEW project.
-- Already have older tables? Run the supabase-migration-*.sql files in order
-- (v2 then v3) instead of this file.
-- ============================================

-- Needed for the "no overlapping rentals per vehicle" constraint below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Vehicles table
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  color TEXT,
  license_plate TEXT UNIQUE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL CHECK (daily_rate >= 0),
  -- "Listed for rent on the website". Day-to-day availability is derived
  -- from the rentals table, not from this flag.
  is_available BOOLEAN NOT NULL DEFAULT true,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Renters table
CREATE TABLE renters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  -- Optional: the paper log sheets usually record a name only.
  phone TEXT,
  email TEXT,
  id_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX renters_phone_idx ON renters (phone);
CREATE INDEX renters_name_lower_idx ON renters (lower(name));

-- Rentals table
CREATE TABLE rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  renter_id UUID REFERENCES renters(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL CHECK (daily_rate >= 0),
  total_charge DECIMAL(10,2) NOT NULL CHECK (total_charge >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'unpaid', 'partial')) DEFAULT 'unpaid',
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rentals_dates_check CHECK (end_date >= start_date),
  -- A vehicle can only be rented to one person at a time. The return date is
  -- handover day, so the next rental may start on it (see migration v9).
  CONSTRAINT rentals_no_overlap EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, greatest(end_date, start_date + 1), '[)') WITH &&
  ) WHERE (vehicle_id IS NOT NULL)
);
CREATE INDEX rentals_vehicle_dates_idx ON rentals (vehicle_id, start_date, end_date);
CREATE INDEX rentals_renter_idx ON rentals (renter_id);

-- Rental requests (from public website)
CREATE TABLE rental_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  requested_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_requests_dates_check CHECK (end_date >= start_date)
);
CREATE INDEX rental_requests_status_idx ON rental_requests (status, created_at DESC);

-- Payments against a rental. Money is taxed in the month it is received, so
-- every payment carries its own date. rentals.amount_paid is maintained
-- automatically from this table by the trigger below.
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  paid_on DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method TEXT CHECK (method IN ('cash', 'transfer', 'card', 'cheque', 'other')) DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX payments_rental_idx ON payments (rental_id);
CREATE INDEX payments_paid_on_idx ON payments (paid_on DESC);

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
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER payments_sync_rental
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION sync_rental_payment_totals();

-- Removing a rental takes its payments out of the books with it, otherwise
-- the money keeps counting as income with no vehicle to attribute it to.
CREATE OR REPLACE FUNCTION cascade_rental_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE payments SET deleted_at = NEW.deleted_at
    WHERE rental_id = NEW.id AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE payments SET deleted_at = NULL
    WHERE rental_id = NEW.id AND deleted_at = OLD.deleted_at;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER rentals_cascade_soft_delete
AFTER UPDATE OF deleted_at ON rentals
FOR EACH ROW EXECUTE FUNCTION cascade_rental_soft_delete();

-- Running costs. vehicle_id NULL means a business-wide cost not tied to one car.
CREATE TABLE expenses (
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
  -- False for a bill that has come in but not been settled yet (migration v10).
  is_paid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX expenses_spent_on_idx ON expenses (spent_on DESC);
CREATE INDEX expenses_vehicle_idx ON expenses (vehicle_id, spent_on DESC);

-- ============================================
-- Row Level Security
--
-- The browser only ever uses the anon key, and only to read vehicles.
-- Everything else goes through the app's API routes, which use the
-- service_role key. The service role bypasses RLS entirely, so no policies
-- are needed for it.
-- ============================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE renters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Public can read vehicles that are listed for rent.
CREATE POLICY "Public can view listed vehicles" ON vehicles
  FOR SELECT TO anon, authenticated USING (is_available = true);

-- No other policies: anon cannot read renters, rentals or requests, and
-- cannot write anything. Booking requests are inserted server-side after
-- validation (app/api/requests).

-- Defence in depth. Supabase grants SELECT on public tables to anon and
-- authenticated by default. Row level security already blocks the rows, but
-- the grant exposes table and column names through the generated GraphQL
-- schema, and a permissive policy added later by mistake would immediately
-- expose real data. Only the fleet listing needs to be readable.
REVOKE ALL ON TABLE renters, rentals, rental_requests, payments, expenses FROM anon, authenticated;
REVOKE ALL ON TABLE vehicles FROM anon, authenticated;
GRANT SELECT ON TABLE vehicles TO anon, authenticated;

-- Sample vehicle data (optional - remove if not needed)
INSERT INTO vehicles (vehicle_id, make, model, year, color, license_plate, daily_rate, is_available) VALUES
('BH-29743', 'Honda', 'Accord', 1998, 'Black', 'BH-29743', 70.00, true);
