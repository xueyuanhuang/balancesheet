import { db } from "@/lib/db"
import type { ExchangeRate } from "@/types"

const FX_CURRENCIES = ["USD", "HKD", "SGD"]
const STALE_MS = 24 * 60 * 60 * 1000 // 24 hours

export const exchangeRateService = {
  async getAll(): Promise<ExchangeRate[]> {
    return db.exchangeRates.toArray()
  },

  async setRate(currency: string, rateToCNY: number): Promise<void> {
    await db.exchangeRates.put({
      currency,
      rateToCNY,
      updatedAt: Date.now(),
    })
  },

  /** Returns a map like { CNY: 1, USD: 7.25, HKD: 0.93 } where value = rateToCNY */
  async getRateMap(): Promise<Record<string, number>> {
    const rates = await db.exchangeRates.toArray()
    const map: Record<string, number> = { CNY: 1 }
    for (const r of rates) {
      map[r.currency] = r.rateToCNY
    }
    return map
  },

  /** Check if any rate is missing or stale (older than 24h) */
  async isStale(): Promise<boolean> {
    const rates = await db.exchangeRates.toArray()
    if (rates.length < FX_CURRENCIES.length) return true
    const now = Date.now()
    return rates.some((r) => now - r.updatedAt > STALE_MS)
  },

  /** Fetch latest rates from public API and store them */
  async fetchRates(): Promise<void> {
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/CNY"
    )
    if (!res.ok) throw new Error("Failed to fetch exchange rates")
    const data = await res.json()
    const rates: Record<string, number> = data.rates
    const now = Date.now()

    for (const currency of FX_CURRENCIES) {
      const rateFromCNY = rates[currency]
      if (rateFromCNY && rateFromCNY > 0) {
        // API gives CNY->X rate, we need X->CNY (i.e. 1 USD = ? CNY)
        const rateToCNY = 1 / rateFromCNY
        await db.exchangeRates.put({
          currency,
          rateToCNY: Math.round(rateToCNY * 10000) / 10000,
          updatedAt: now,
        })
      }
    }
  },

  /** Fetch rates if stale, silently ignore errors (use cached) */
  async refreshIfNeeded(): Promise<void> {
    try {
      const stale = await this.isStale()
      if (!stale) return
      await this.fetchRates()
    } catch {
      // silently fail — use cached rates
    }
  },
}
