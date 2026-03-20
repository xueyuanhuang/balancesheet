"use client"

import { useEffect, useRef } from "react"
import { format } from "date-fns"
import { snapshotService } from "@/lib/services/snapshot-service"

/**
 * Trigger snapshot recording when balances change.
 * netWorth/totalAssets/totalLiabilities are used as change signals only —
 * the service independently queries per-currency data from DB.
 */
export function useRecordSnapshot({
  netWorth,
  totalAssets,
  totalLiabilities,
  hasAccounts,
}: {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  hasAccounts: boolean
}) {
  const lastRecordRef = useRef<string>("")

  useEffect(() => {
    if (!hasAccounts) return

    const hourKey = format(new Date(), "yyyy-MM-dd HH:00")
    const recordKey = `${hourKey}:${netWorth}:${totalAssets}:${totalLiabilities}`

    // Skip if same values already recorded
    if (lastRecordRef.current === recordKey) return
    lastRecordRef.current = recordKey

    snapshotService.recordToday()
  }, [netWorth, totalAssets, totalLiabilities, hasAccounts])
}
