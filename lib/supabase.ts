import { createClient } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client using the public anon key. With row level
 * security enabled it can only read the vehicles table. Everything else goes
 * through the API routes in app/api.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://not-configured.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-configured'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Vehicle = {
  id: string
  make: string
  model: string
  year: number
  license_plate: string
  daily_rate: number
  is_available: boolean
  photo_url: string | null
  vehicle_id: string
  color: string | null
  notes: string | null
  created_at: string
}

export type Renter = {
  id: string
  name: string
  phone: string | null
  email: string | null
  id_number: string | null
  created_at: string
  rentals?: { count: number }[]
}

export type Rental = {
  id: string
  vehicle_id: string | null
  renter_id: string | null
  start_date: string
  end_date: string
  daily_rate: number
  total_charge: number
  payment_status: 'paid' | 'unpaid' | 'partial'
  amount_paid: number
  notes: string | null
  created_at: string
  vehicle?: Vehicle | null
  renter?: Renter | null
}

export type Payment = {
  id: string
  rental_id: string
  paid_on: string
  amount: number
  method: 'cash' | 'transfer' | 'card' | 'cheque' | 'other' | null
  notes: string | null
  created_at: string
  rental?: { id: string; vehicle_id: string | null; renter_id: string | null } | null
}

export type Expense = {
  id: string
  vehicle_id: string | null
  spent_on: string
  category: string
  amount: number
  vendor: string | null
  description: string | null
  odometer: number | null
  /** False for a bill that has come in but not been settled yet. */
  is_paid: boolean
  created_at: string
  vehicle?: Vehicle | null
}

export type RentalRequest = {
  id: string
  name: string
  phone: string
  email: string | null
  requested_vehicle_id: string | null
  start_date: string
  end_date: string
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  vehicle?: Vehicle | null
}
