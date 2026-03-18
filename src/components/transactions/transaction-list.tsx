"use client"

import { OperationItem } from "./operation-item"
import { EmptyState } from "@/components/shared/empty-state"
import { ArrowLeftRight } from "lucide-react"
import type { OperationWithEntries } from "@/types"

interface TransactionListProps {
  operations: OperationWithEntries[]
}

export function TransactionList({ operations }: TransactionListProps) {
  if (operations.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="暂无流水记录"
        description="开始记录你的第一笔交易"
        actionLabel="记一笔"
        actionHref="/transactions/new"
      />
    )
  }

  // Group by date
  const grouped = new Map<string, OperationWithEntries[]>()
  for (const item of operations) {
    const dateKey = new Date(item.operation.occurredAt).toLocaleDateString("zh-CN")
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
            {items.map((item) => (
              <OperationItem key={item.operation.id} data={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
