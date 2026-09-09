"use client"

import { OperationItem } from "./operation-item"
import { OpeningBalanceItem } from "./opening-balance-item"
import { EmptyState } from "@/components/shared/empty-state"
import { ArrowLeftRight } from "lucide-react"
import { useRunningBalances } from "@/lib/hooks/use-running-balances"
import type { ActivityItem } from "@/types"

interface TransactionListProps {
  items: ActivityItem[]
  filterAccountId?: string
}

export function TransactionList({ items, filterAccountId }: TransactionListProps) {
  const operations = items.flatMap((item) => item.type === "operation" ? [item.data] : [])
  const runningBalances = useRunningBalances(operations)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No activity yet"
        description="Record your first transaction to get started."
        actionLabel="Add transaction"
        actionHref="/transactions/new"
      />
    )
  }

  // Group by date
  const grouped = new Map<string, ActivityItem[]>()
  for (const item of items) {
    const dateKey = new Date(item.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(item)
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([date, items]) => (
        <div key={date}>
          <div className="text-xs text-muted-foreground px-4 mb-1 sticky top-14 bg-background py-1 z-10">
            {date}
          </div>
          <div>
            {items.map((item) => item.type === "opening_balance" ? (
              <OpeningBalanceItem key={item.id} account={item.account} />
            ) : (
              <OperationItem
                key={item.id}
                data={item.data}
                runningBalances={runningBalances}
                filterAccountId={filterAccountId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
