"use client"

import { useEffect, useState } from "react"
import { BottomNav } from "./bottom-nav"
import { SwRegister } from "@/components/shared/sw-register"
import { Onboarding } from "@/components/shared/onboarding"
import { db } from "@/lib/db"
import { isAppInitialized } from "@/lib/db/seed"
import { exchangeRateService } from "@/lib/services/exchange-rate-service"
import { Toaster } from "@/components/ui/sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "onboarding" | "ready">("loading")

  useEffect(() => {
    // Explicitly open DB (and run upgrades) before rendering any child components
    db.open().then(() => {
      if (isAppInitialized()) {
        setStatus("ready")
        exchangeRateService.refreshIfNeeded()
      } else {
        setStatus("onboarding")
      }
    }).catch((err) => {
      console.error("[DB] Failed to open:", err)
      // Still allow app to render so user can reset if needed
      if (isAppInitialized()) {
        setStatus("ready")
      } else {
        setStatus("onboarding")
      }
    })
  }, [])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    )
  }

  if (status === "onboarding") {
    return (
      <>
        <Onboarding onComplete={() => setStatus("ready")} />
        <Toaster position="top-center" />
      </>
    )
  }

  return (
    <>
      <SwRegister />
      <main className="pb-20 min-h-screen">{children}</main>
      <BottomNav />
      <Toaster position="top-center" />
    </>
  )
}
