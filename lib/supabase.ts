import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
  phone: string
  email: string | null
  id_number: string | null
  created_at: string
}

export type Rental = {
  id: string
  vehicle_id: string
  renter_id: string
  start_date: string
  end_date: string
  daily_rate: number
  total_charge: number
  payment_status: 'paid' | 'unpaid' | 'partial'
  amount_paid: number
  notes: string | null
  created_at: string
  vehicle?: Vehicle
  renter?: Renter
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
  vehicle?: Vehicle
}
