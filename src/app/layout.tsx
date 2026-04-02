import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AppShell } from "@/components/layout/app-shell"

export const metadata: Metadata = {
  title: "净值",
  description: "清晰管理你的资产、负债和净资产",
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/apple-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "净值",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
