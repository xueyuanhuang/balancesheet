"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { NetWorthSnapshot } from "@/types"

export function useNetWorthSnapshots(startDate?: string): NetWorthSnapshot[] {
  return useLiveQuery(
    () => {
      if (startDate) {
        return db.netWorthSnapshots
          .where("date")
          .aboveOrEqual(startDate)
          .toArray()
      }
      return db.netWorthSnapshots.orderBy("date").toArray()
    },
    [startDate],
    []
  )
}
