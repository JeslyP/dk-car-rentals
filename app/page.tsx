'use client'
import { useEffect, useState } from 'react'
import { supabase, Vehicle } from '@/lib/supabase'

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', start_date: '', end_date: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    supabase.from('vehicles').select('*').order('created_at').then(({ data }) => {
      setVehicles(data || [])
      setLoading(false)
    })
  }, [])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('rental_requests').insert([{
      ...formData,
      requested_vehicle_id: selectedVehicle || null,
      status: 'pending'
    }])
    setSubmitting(false)
    setSubmitted(true)
    setShowForm(false)
  }

  return (
    <div className="min-h-screen" style={{ background: '#fdf8f3' }}>
      {/* Nav */}
      <nav style={{ background: '#1c1917' }} className="px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: '#ea580c' }}>
            DK
          </div>
          <span className="text-white font-bold text-xl font-display tracking-wide">D&K Car Rentals</span>
        </div>
        <div className="flex gap-6 items-center">
          <a href="#fleet" className="text-gray-300 hover:text-white text-sm transition">Our Fleet</a>
          <a href="#about" className="text-gray-300 hover:text-white text-sm transition">About</a>
          <a href="#contact" className="text-gray-300 hover:text-white text-sm transition">Contact</a>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2 rounded-full text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: '#ea580c' }}
          >
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-gradient text-white py-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px'
        }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-orange-400 font-semibold tracking-widest text-sm uppercase mb-4">Trusted Since Day One</p>
          <h1 className="font-display text-5xl md:text-7xl font-black mb-6 leading-tight">
            Your Journey,<br />
            <span style={{ color: '#ea580c' }}>Our Wheels.</span>
          </h1>
          <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto">
            Reliable, affordable car rentals. Browse our available fleet and request a booking online — we'll confirm within hours.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-4 rounded-full font-bold text-white text-lg transition hover:opacity-90"
              style={{ background: '#ea580c' }}
            >
              Request a Car
            </button>
            <a href="#fleet" className="px-8 py-4 rounded-full font-bold text-white text-lg border border-white/30 hover:border-white/60 transition">
              View Fleet
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6" style={{ background: '#ea580c' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center text-white">
          <div>
            <p className="text-4xl font-black font-display">10+</p>
            <p className="text-sm opacity-80 mt-1">Vehicles Available</p>
          </div>
          <div>
            <p className="text-4xl font-black font-display">24h</p>
            <p className="text-sm opacity-80 mt-1">Booking Response</p>
          </div>
          <div>
            <p className="text-4xl font-black font-display">100%</p>
            <p className="text-sm opacity-80 mt-1">Trusted Service</p>
          </div>
        </div>
      </section>

      {/* Fleet */}
      <section id="fleet" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-orange-600 font-semibold tracking-widest text-sm uppercase mb-2">Browse & Choose</p>
          <h2 className="font-display text-4xl font-bold" style={{ color: '#1c1917' }}>Our Fleet</h2>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Fleet details coming soon. Contact us directly to check availability!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((v) => (
              <div key={v.id} className="card-hover bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt={`${v.make} ${v.model}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-6xl">🚗</div>
                  )}
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white ${v.is_available ? 'bg-green-500' : 'bg-red-500'}`}>
                    {v.is_available ? '✓ Available' : '✗ Rented'}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-xl font-display" style={{ color: '#1c1917' }}>
                    {v.year} {v.make} {v.model}
                  </h3>
                  {v.color && <p className="text-gray-500 text-sm mt-1">{v.color}</p>}
                  <div className="flex justify-between items-center mt-4">
                    <div>
                      <span className="text-2xl font-black" style={{ color: '#ea580c' }}>${v.daily_rate}</span>
                      <span className="text-gray-400 text-sm">/day</span>
                    </div>
                    {v.is_available && (
                      <button
                        onClick={() => { setSelectedVehicle(v.id); setShowForm(true); }}
                        className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
                        style={{ background: '#ea580c' }}
                      >
                        Request
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      <section id="about" className="py-20 px-6" style={{ background: '#1c1917' }}>
        <div className="max-w-4xl mx-auto text-center text-white">
          <p className="text-orange-400 font-semibold tracking-widest text-sm uppercase mb-4">Who We Are</p>
          <h2 className="font-display text-4xl font-bold mb-6">A Family Business<br />Built on Trust</h2>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
            D&K Car Rentals is a family-owned business committed to providing reliable, affordable transportation. 
            Every vehicle in our fleet is well-maintained and ready for the road. We treat every customer like family.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-6 max-w-2xl mx-auto text-center">
        <p className="text-orange-600 font-semibold tracking-widest text-sm uppercase mb-2">Get In Touch</p>
        <h2 className="font-display text-4xl font-bold mb-4" style={{ color: '#1c1917' }}>Contact Us</h2>
        <p className="text-gray-500 mb-8">Have questions? Call us directly or submit a booking request online.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => setShowForm(true)}
            className="px-8 py-4 rounded-full font-bold text-white transition hover:opacity-90"
            style={{ background: '#ea580c' }}
          >
            📋 Submit Booking Request
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#1c1917' }} className="py-8 px-6 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} D&K Car Rentals. All rights reserved.</p>
      </footer>

      {/* Booking Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold" style={{ color: '#1c1917' }}>Request a Rental</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone *</label>
                <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Your phone number" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="optional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">From *</label>
                  <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">To *</label>
                  <input required type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              {vehicles.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Preferred Vehicle</label>
                  <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400">
                    <option value="">Any available vehicle</option>
                    {vehicles.filter(v => v.is_available).map(v => (
                      <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} — ${v.daily_rate}/day</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
                <textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 resize-none" rows={3} placeholder="Any special requests..." />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#ea580c' }}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success toast */}
      {submitted && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-full shadow-xl z-50 font-semibold">
          ✓ Request submitted! We'll contact you soon.
          <button onClick={() => setSubmitted(false)} className="ml-4 opacity-70 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  )
}
