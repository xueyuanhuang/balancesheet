"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
import { MonthlySummary } from "@/components/transactions/monthly-summary"
import { useActivity } from "@/lib/hooks/use-activity"
import type { ActivityKind } from "@/types"

export default function TransactionsPage() {
  const [keyword, setKeyword] = useState("")
  const [kindFilter, setKindFilter] = useState<ActivityKind | undefined>(undefined)

  const items = useActivity({
    keyword: keyword || undefined,
    kind: kindFilter,
  })

  return (
    <div>
      <PageHeader title="Activity" />
      <div className="py-4 space-y-4">
        <MonthlySummary />
        <TransactionFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
        />
        <TransactionList items={items} />
      </div>
    </div>
  )
}
