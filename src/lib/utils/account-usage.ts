const STORAGE_KEY = "account-usage-counts"

function getUsageMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

export function getAccountUsageCount(accountId: string): number {
  return getUsageMap()[accountId] ?? 0
}

export function recordAccountUsage(accountId: string): void {
  const map = getUsageMap()
  map[accountId] = (map[accountId] ?? 0) + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}
