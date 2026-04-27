"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { OperationWithEntries } from "@/types"

/**
 * Map of entry.id → account balance immediately after that entry was applied.
 *
 * Computed by walking ALL entries for each visible account in time order, so
 * the running balance stays correct even when the operations list is filtered
 * by kind / keyword / date range.
 */
export function useRunningBalances(
  visibleOperations: OperationWithEntries[]
): Map<string, number> {
  const accountIds = Array.from(
    new Set(
      visibleOperations.flatMap((op) => op.entries.map((e) => e.accountId))
    )
  ).sort()
  const key = accountIds.join(",")

  return useLiveQuery(
    async () => {
      const result = new Map<string, number>()
      if (accountIds.length === 0) return result

      for (const accountId of accountIds) {
        const account = await db.accounts.get(accountId)
        if (!account) continue

        const allEntries = await db.entries
          .where("accountId")
          .equals(accountId)
          .toArray()
        if (allEntries.length === 0) continue

        const opIds = Array.from(new Set(allEntries.map((e) => e.operationId)))
        const allOps = await db.operations.where("id").anyOf(opIds).toArray()
        const opMap = new Map(allOps.map((op) => [op.id, op]))

        // Sort DESC by occurredAt then createdAt so the first entry matches
        // the cached account.balance, then walk backwards.
        allEntries.sort((a, b) => {
          const opA = opMap.get(a.operationId)
          const opB = opMap.get(b.operationId)
          if (!opA || !opB) return 0
          if (opA.occurredAt !== opB.occurredAt) return opB.occurredAt - opA.occurredAt
          return b.createdAt - a.createdAt
        })

        let balanceAfter = account.balance
        for (const entry of allEntries) {
          result.set(entry.id, balanceAfter)
          const signed = entry.effect === "increase" ? entry.amount : -entry.amount
          balanceAfter -= signed
        }
      }

      return result
    },
    [key],
    new Map<string, number>()
  )
}
