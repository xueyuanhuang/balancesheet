"use client"

import { useEffect, useRef } from "react"
import { format } from "date-fns"
import { snapshotService } from "@/lib/services/snapshot-service"

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

    const todayKey = format(new Date(), "yyyy-MM-dd")
    const recordKey = `${todayKey}:${netWorth}:${totalAssets}:${totalLiabilities}`

    // Skip if same values already recorded
    if (lastRecordRef.current === recordKey) return
    lastRecordRef.current = recordKey

    snapshotService.recordToday({ netWorth, totalAssets, totalLiabilities })
  }, [netWorth, totalAssets, totalLiabilities, hasAccounts])
}
