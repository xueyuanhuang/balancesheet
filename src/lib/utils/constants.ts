export const DEFAULT_CURRENCY = "CNY"

export const APP_NAME = "Net Worth"
export const APP_SHORT_NAME = "Balance Sheet"
export const APP_DESCRIPTION = "Track your assets, liabilities, and net worth"

export const CURRENCIES = [
  { code: "CNY", symbol: "¥", label: "Chinese yuan" },
  { code: "USD", symbol: "$", label: "US dollar" },
  { code: "HKD", symbol: "HK$", label: "Hong Kong dollar" },
  { code: "SGD", symbol: "S$", label: "Singapore dollar" },
] as const

export function getCurrencySymbol(code: string): string {
  const found = CURRENCIES.find((c) => c.code === code)
  return found?.symbol ?? code
}
