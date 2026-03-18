"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { Account } from "@/types"

export function useAccounts() {
  return useLiveQuery(
    () => db.accounts.orderBy("sortOrder").toArray(),
    [],
    [] as Account[]
  )
}

export function useAccount(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.accounts.get(id) : undefined),
    [id],
    undefined as Account | undefined
  )
}

export function useAccountsByCategory(categoryId: string | undefined) {
  return useLiveQuery(
    () =>
      categoryId
        ? db.accounts.where("categoryId").equals(categoryId).sortBy("sortOrder")
        : ([] as Account[]),
    [categoryId],
    [] as Account[]
  )
}
