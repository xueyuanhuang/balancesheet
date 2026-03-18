/**
 * Convert an amount in cents from a given currency to CNY cents.
 * rateMap: { CNY: 1, USD: 7.25, HKD: 0.93 } where value = how many CNY per 1 unit of that currency.
 */
export function convertToCNY(
  cents: number,
  currency: string,
  rateMap: Record<string, number>
): number {
  if (currency === "CNY") return cents
  const rate = rateMap[currency]
  if (rate === undefined) return cents // fallback: no conversion
  return Math.round(cents * rate)
}

/**
 * Convert CNY cents to target currency cents.
 * Returns null if rate is missing or zero (caller should fallback to CNY display).
 */
export function convertFromCNY(
  cnyCents: number,
  targetCurrency: string,
  rateMap: Record<string, number>
): number | null {
  if (targetCurrency === "CNY") return cnyCents
  const rate = rateMap[targetCurrency]
  if (!rate) return null
  return Math.round(cnyCents / rate)
}
