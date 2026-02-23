-- ============================================
-- D&K Car Rentals - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Vehicles table
CREATE TABLE vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT,
  license_plate TEXT UNIQUE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renters table
CREATE TABLE renters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rentals table
CREATE TABLE rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  renter_id UUID REFERENCES renters(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  total_charge DECIMAL(10,2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('paid', 'unpaid', 'partial')) DEFAULT 'unpaid',
  amount_paid DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update vehicle availability when rental is created
CREATE OR REPLACE FUNCTION update_vehicle_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE vehicles SET is_available = false WHERE id = NEW.vehicle_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE vehicles SET is_available = true WHERE id = OLD.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rental_vehicle_availability
AFTER INSERT OR DELETE ON rentals
FOR EACH ROW EXECUTE FUNCTION update_vehicle_availability();

-- Enable Row Level Security (public read for vehicles)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE renters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;

-- Public can read vehicles
CREATE POLICY "Public can view vehicles" ON vehicles FOR SELECT USING (true);

-- Public can insert rental requests
CREATE POLICY "Public can submit requests" ON rental_requests FOR INSERT WITH CHECK (true);

-- Service role has full access (used by admin API routes)
CREATE POLICY "Service role full access vehicles" ON vehicles USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access renters" ON renters USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access rentals" ON rentals USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access requests" ON rental_requests USING (auth.role() = 'service_role');

-- Sample vehicle data (optional - remove if not needed)
INSERT INTO vehicles (vehicle_id, make, model, year, color, license_plate, daily_rate, is_available) VALUES
('BH-29743', 'Honda', 'Accord', 1998, 'Black', 'BH-29743', 70.00, true);
