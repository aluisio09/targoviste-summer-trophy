import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Targoviste Summer Trophy',
  description: 'Turneu de fotbal pentru juniori – Târgoviște',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className="h-full">
      <body className="min-h-full flex flex-col bg-[#f0f4f0]">{children}</body>
    </html>
  )
}
