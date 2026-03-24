"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
import { MonthlySummary } from "@/components/transactions/monthly-summary"
import { useOperations } from "@/lib/hooks/use-operations"
import type { OperationKind } from "@/types"

export default function TransactionsPage() {
  const [keyword, setKeyword] = useState("")
  const [kindFilter, setKindFilter] = useState<OperationKind | undefined>(undefined)

  const operations = useOperations({
    keyword: keyword || undefined,
    kind: kindFilter,
  })

  return (
    <div>
      <PageHeader title="流水" />
      <div className="py-4 space-y-4">
        <MonthlySummary />
        <TransactionFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
        />
        <TransactionList operations={operations} />
      </div>
    </div>
  )
}
