"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { OperationWithEntries, OperationKind } from "@/types"

interface OperationFilters {
  accountId?: string
  kind?: OperationKind
  startDate?: number
  endDate?: number
  keyword?: string
}

export function useOperations(filters?: OperationFilters) {
  return useLiveQuery(
    async (): Promise<OperationWithEntries[]> => {
      let operationIds: Set<string> | null = null

      // If filtering by accountId, first find the relevant operation IDs
      if (filters?.accountId) {
        const accountEntries = await db.entries
          .where("accountId")
          .equals(filters.accountId)
          .toArray()
        operationIds = new Set(accountEntries.map((e) => e.operationId))
        if (operationIds.size === 0) return []
      }

      // Load operations
      let operations = await db.operations.orderBy("occurredAt").reverse().toArray()

      // Filter by operationIds from accountId filter
      if (operationIds) {
        operations = operations.filter((op) => operationIds!.has(op.id))
      }

      // Filter by kind
      if (filters?.kind) {
        operations = operations.filter((op) => op.kind === filters.kind)
      }

      // Filter by date range
      if (filters?.startDate) {
        operations = operations.filter((op) => op.occurredAt >= filters.startDate!)
      }
      if (filters?.endDate) {
        operations = operations.filter((op) => op.occurredAt <= filters.endDate!)
      }

      // Filter by keyword
      if (filters?.keyword) {
        const kw = filters.keyword.toLowerCase()
        operations = operations.filter((op) => op.description.toLowerCase().includes(kw))
      }

      // Load all entries for matched operations
      const opIds = operations.map((op) => op.id)
      const entries = opIds.length > 0
        ? await db.entries.where("operationId").anyOf(opIds).toArray()
        : []

      const entryMap = new Map<string, typeof entries>()
      for (const entry of entries) {
        const list = entryMap.get(entry.operationId) ?? []
        list.push(entry)
        entryMap.set(entry.operationId, list)
      }

      return operations.map((op) => ({
        operation: op,
        entries: entryMap.get(op.id) ?? [],
      }))
    },
    [filters?.accountId, filters?.kind, filters?.startDate, filters?.endDate, filters?.keyword],
    [] as OperationWithEntries[]
  )
}

export function useOperation(id: string | undefined) {
  return useLiveQuery(
    async (): Promise<OperationWithEntries | undefined> => {
      if (!id) return undefined
      const operation = await db.operations.get(id)
      if (!operation) return undefined
      const entries = await db.entries.where("operationId").equals(id).toArray()
      return { operation, entries }
    },
    [id],
    undefined as OperationWithEntries | undefined
  )
}
