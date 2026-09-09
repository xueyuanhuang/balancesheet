import type { Account, ActivityFilters, ActivityItem, OperationWithEntries } from "@/types"

/** Build a read-only timeline without adding opening balances to the ledger again. */
export function buildActivity(
  operations: OperationWithEntries[],
  accounts: Account[],
  filters: ActivityFilters = {}
): ActivityItem[] {
  const keyword = filters.keyword?.trim().toLowerCase()
  const items: ActivityItem[] = [
    ...operations.map((data): ActivityItem => ({
      type: "operation",
      id: `operation:${data.operation.id}`,
      occurredAt: data.operation.occurredAt,
      data,
    })),
    ...accounts
      .filter((account) => account.openingBalance !== 0)
      .map((account): ActivityItem => ({
        type: "opening_balance",
        id: `opening_balance:${account.id}`,
        occurredAt: account.createdAt,
        account,
      })),
  ]

  return items.filter((item) => {
    if (filters.startDate !== undefined && item.occurredAt < filters.startDate) return false
    if (filters.endDate !== undefined && item.occurredAt > filters.endDate) return false

    if (item.type === "opening_balance") {
      if (filters.kind && filters.kind !== "opening_balance") return false
      if (filters.accountId && item.account.id !== filters.accountId) return false
      return !keyword || `Account opened Opening balance ${item.account.name}`.toLowerCase().includes(keyword)
    }

    if (filters.kind && item.data.operation.kind !== filters.kind) return false
    if (filters.accountId && !item.data.entries.some((entry) => entry.accountId === filters.accountId)) return false
    return !keyword || item.data.operation.description.toLowerCase().includes(keyword)
  }).sort((a, b) => {
    const timeDifference = b.occurredAt - a.occurredAt
    if (timeDifference !== 0) return timeDifference
    // An account's opening record comes before transactions at the same instant.
    if (a.type !== b.type) return a.type === "opening_balance" ? 1 : -1
    const createdA = a.type === "operation" ? a.data.operation.createdAt : a.account.createdAt
    const createdB = b.type === "operation" ? b.data.operation.createdAt : b.account.createdAt
    return createdB - createdA || a.id.localeCompare(b.id)
  })
}
