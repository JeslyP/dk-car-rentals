import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBookingNotification, emailConfigured, sendEmail } from '@/lib/email'

const req = { name: 'Jane <b>Doe</b>', phone: '555', email: 'jane@example.com', requested_vehicle_id: null, start_date: '2026-06-01', end_date: '2026-06-03', message: null }

afterEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.NOTIFY_EMAIL
  delete process.env.EMAIL_FROM
})

describe('email', () => {
  it('is disabled until all variables are set', async () => {
    expect(emailConfigured()).toBe(false)
    const res = await sendEmail({ to: 'a@b.c', subject: 's', html: '', text: '' })
    expect(res.sent).toBe(false)
  })

  it('escapes html in the notification and links to the admin', () => {
    const { subject, html, text } = buildBookingNotification(req, '2020 Honda Fit', 'https://site/admin/requests')
    expect(subject).toContain('Jane')
    expect(html).toContain('&lt;b&gt;Doe&lt;/b&gt;')
    expect(html).not.toContain('<b>Doe</b>')
    expect(text).toContain('2020 Honda Fit')
    expect(html).toContain('https://site/admin/requests')
  })

  it('posts to Resend when configured', async () => {
    process.env.RESEND_API_KEY = 'k'
    process.env.NOTIFY_EMAIL = 'owner@x.y'
    process.env.EMAIL_FROM = 'DK <no-reply@x.y>'
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    const res = await sendEmail({ to: 'owner@x.y', subject: 's', html: '<p>h</p>', text: 't', replyTo: 'jane@example.com' }, fetchMock as unknown as typeof fetch)
    expect(res.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['owner@x.y'], reply_to: 'jane@example.com' })
  })

  it('reports provider errors without throwing', async () => {
    process.env.RESEND_API_KEY = 'k'
    process.env.NOTIFY_EMAIL = 'owner@x.y'
    process.env.EMAIL_FROM = 'DK <no-reply@x.y>'
    const fetchMock = vi.fn(async () => new Response('nope', { status: 422 }))
    const res = await sendEmail({ to: 'a', subject: 's', html: '', text: '' }, fetchMock as unknown as typeof fetch)
    expect(res).toEqual({ sent: false, error: 'Resend responded 422' })
  })
})
