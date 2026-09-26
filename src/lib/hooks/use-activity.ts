"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { buildActivity } from "@/lib/utils/activity"
import type { ActivityFilters, ActivityItem, Entry } from "@/types"

const EMPTY_ACTIVITY: ActivityItem[] = []

export function useActivity({ accountId, kind, startDate, endDate, keyword }: ActivityFilters = {}) {
  const filterKey = JSON.stringify([accountId, kind, startDate, endDate, keyword])
  const snapshot = useLiveQuery(
    () => db.transaction("r", [db.accounts, db.operations, db.entries], async () => {
      // Publish the timeline together so opening rows cannot appear before
      // their saved transfers and then move underneath a user's tap.
      const [accounts, operations, entries] = await Promise.all([
        db.accounts.toArray(),
        db.operations.toArray(),
        db.entries.toArray(),
      ])
      const entriesByOperation = new Map<string, Entry[]>()
      for (const entry of entries) {
        const operationEntries = entriesByOperation.get(entry.operationId) ?? []
        operationEntries.push(entry)
        entriesByOperation.set(entry.operationId, operationEntries)
      }
      const data = operations.map((operation) => ({
        operation,
        entries: entriesByOperation.get(operation.id) ?? [],
      }))
      return {
        filterKey,
        items: buildActivity(data, accounts, { accountId, kind, startDate, endDate, keyword }),
      }
    }),
    [filterKey]
  )

  // A changed account/filter must not briefly expose the previous timeline.
  return snapshot?.filterKey === filterKey ? snapshot.items : EMPTY_ACTIVITY
}
