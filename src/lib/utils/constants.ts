export const DEFAULT_CURRENCY = "CNY"

export const APP_NAME = "个人资产负债表"
export const APP_SHORT_NAME = "资产负债表"
export const APP_DESCRIPTION = "清晰管理你的资产、负债和净资产"

export const CURRENCIES = [
  { code: "CNY", symbol: "¥", label: "人民币" },
  { code: "USD", symbol: "$", label: "美元" },
  { code: "HKD", symbol: "HK$", label: "港币" },
  { code: "SGD", symbol: "S$", label: "新加坡元" },
] as const

export function getCurrencySymbol(code: string): string {
  const found = CURRENCIES.find((c) => c.code === code)
  return found?.symbol ?? code
}
