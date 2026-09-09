"use client"

import { useMemo } from "react"
import { useAccounts } from "./use-accounts"
import { useOperations } from "./use-operations"
import { buildActivity } from "@/lib/utils/activity"
import type { ActivityFilters } from "@/types"

export function useActivity({ accountId, kind, startDate, endDate, keyword }: ActivityFilters = {}) {
  const operations = useOperations({ accountId })
  const accounts = useAccounts()

  return useMemo(
    () => buildActivity(operations, accounts, { accountId, kind, startDate, endDate, keyword }),
    [operations, accounts, accountId, kind, startDate, endDate, keyword]
  )
}
