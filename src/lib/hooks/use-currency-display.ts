"use client"

import { useState, useCallback } from "react"

export type CurrencyDisplayMode = "auto" | "CNY" | "USD" | "HKD"

const STORAGE_KEY = "accountListCurrencyDisplay"
const VALID_MODES: CurrencyDisplayMode[] = ["auto", "CNY", "USD", "HKD"]

export function useCurrencyDisplayMode() {
  const [mode, setModeState] = useState<CurrencyDisplayMode>(() => {
    if (typeof window === "undefined") return "auto"
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID_MODES.includes(stored as CurrencyDisplayMode)) {
      return stored as CurrencyDisplayMode
    }
    return "auto"
  })

  const setMode = useCallback((m: CurrencyDisplayMode) => {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
  }, [])

  return [mode, setMode] as const
}
