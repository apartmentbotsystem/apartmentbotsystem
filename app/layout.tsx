import './globals.css'
import { ReactNode } from 'react'
import ToastProvider from '@/components/ui/ToastProvider'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
