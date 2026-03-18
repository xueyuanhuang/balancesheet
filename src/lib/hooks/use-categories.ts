"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { Category } from "@/types"

export function useCategories(type?: "asset" | "liability") {
  const categories = useLiveQuery(
    () => {
      if (type) {
        return db.categories.where("type").equals(type).sortBy("sortOrder")
      }
      return db.categories.orderBy("sortOrder").toArray()
    },
    [type],
    [] as Category[]
  )

  return categories
}

export function useCategory(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.categories.get(id) : undefined),
    [id],
    undefined as Category | undefined
  )
}
