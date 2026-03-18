import { format as dateFnsFormat, formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { getCurrencySymbol } from "./constants"

/**
 * Format cents to display string like "¥1,234.56" or "$1,234.56"
 * Negative values show as "-¥1,234.56"
 */
export function formatAmount(cents: number, currency: string = "CNY"): string {
  const symbol = getCurrencySymbol(currency)
  const yuan = cents / 100
  const formatted = Math.abs(yuan).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return cents < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

/**
 * Parse yuan string to cents integer
 * "123.45" -> 12345
 */
export function parseToCents(yuan: string): number {
  const num = parseFloat(yuan)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * Format cents to yuan string for input fields
 * 12345 -> "123.45"
 */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number, pattern: string = "yyyy-MM-dd"): string {
  return dateFnsFormat(new Date(timestamp), pattern, { locale: zhCN })
}

/**
 * Format timestamp to datetime string
 */
export function formatDateTime(timestamp: number): string {
  return dateFnsFormat(new Date(timestamp), "yyyy-MM-dd HH:mm", { locale: zhCN })
}

/**
 * Format timestamp to relative time like "3天前"
 */
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhCN })
}
