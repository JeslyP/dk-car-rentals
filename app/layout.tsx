import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'D&K Car Rentals',
  description: 'Reliable car rentals for every journey. Browse our fleet and book online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
