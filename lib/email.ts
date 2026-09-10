import type { BookingRequestInput } from './validation'
import { formatDate } from './rentals'

/**
 * Sends an email through Resend's HTTP API (https://resend.com) when the
 * following environment variables are set:
 *   RESEND_API_KEY   - API key from Resend
 *   NOTIFY_EMAIL     - where booking notifications should go (the owner)
 *   EMAIL_FROM       - sender, e.g. "D&K Car Rentals <bookings@yourdomain.com>"
 * When they are missing the function is a no-op, so local development and
 * fresh deployments keep working without an email provider.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL && process.env.EMAIL_FROM)
}

type SendArgs = { to: string; subject: string; html: string; text: string; replyTo?: string }

export async function sendEmail(args: SendArgs, fetchImpl: typeof fetch = fetch): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) return { sent: false, error: 'Email not configured' }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    })
    if (!res.ok) return { sent: false, error: `Resend responded ${res.status}` }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export function buildBookingNotification(req: BookingRequestInput, vehicleLabel: string | null, adminUrl: string) {
  const rows: [string, string][] = [
    ['Name', req.name],
    ['Phone', req.phone],
    ['Email', req.email || '—'],
    ['Vehicle', vehicleLabel || 'Any available vehicle'],
    ['Dates', `${formatDate(req.start_date)} → ${formatDate(req.end_date)}`],
    ['Message', req.message || '—'],
  ]
  const text = [`New booking request from ${req.name}`, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Review it: ${adminUrl}`].join('\n')
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="color:#ea580c;margin-bottom:4px">New booking request</h2>
      <p style="color:#555;margin-top:0">Submitted from the D&amp;K Car Rentals website.</p>
      <table style="border-collapse:collapse;width:100%">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px 8px;color:#777;border-bottom:1px solid #eee">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`).join('')}
      </table>
      <p style="margin-top:20px"><a href="${escapeHtml(adminUrl)}" style="background:#ea580c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review in admin</a></p>
    </div>`
  return { subject: `New booking request: ${req.name} (${formatDate(req.start_date)})`, html, text }
}

export function buildBookingConfirmation(req: BookingRequestInput, vehicleLabel: string | null) {
  const text = [
    `Hi ${req.name},`,
    '',
    'Thanks for your booking request with D&K Car Rentals. We have received it and will get back to you shortly.',
    '',
    `Vehicle: ${vehicleLabel || 'Any available vehicle'}`,
    `Dates: ${formatDate(req.start_date)} → ${formatDate(req.end_date)}`,
    '',
    'This is not a confirmed booking yet. We will contact you by phone or email to confirm.',
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">${text.split('\n').map(l => `<p style="margin:4px 0">${escapeHtml(l) || '&nbsp;'}</p>`).join('')}</div>`
  return { subject: 'We received your booking request — D&K Car Rentals', html, text }
}
