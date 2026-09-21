import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'D&K Car Rentals',
  description: 'Reliable car rentals for every journey. Browse our fleet and book online.',
}

/**
 * Applies the saved theme before the first paint. Without this the page
 * renders light and then flips, which is worse than no dark mode at all.
 * Kept tiny and dependency-free because it blocks rendering.
 */
const themeScript = `(function(){try{
  var t=localStorage.getItem('dk_theme');
  if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
