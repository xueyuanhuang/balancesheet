"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { ExchangeRate } from "@/types"

export function useExchangeRates() {
  return useLiveQuery(
    () => db.exchangeRates.toArray(),
    [],
    [] as ExchangeRate[]
  )
}

export function useRateMap(): Record<string, number> {
  const rates = useExchangeRates()
  const map: Record<string, number> = { CNY: 1 }
  for (const r of rates) {
    map[r.currency] = r.rateToCNY
  }
  return map
}
