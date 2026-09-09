import { db } from "./index"
import { generateId } from "@/lib/utils/id"
import type { Category } from "@/types"

const SEED_KEY = "balancesheet_seeded"

interface SeedCategory {
  name: string
  type: "asset" | "liability"
  children?: { name: string }[]
}

const defaultCategories: SeedCategory[] = [
  {
    name: "Cash and deposits",
    type: "asset",
    children: [
      { name: "Cash" },
      { name: "Checking accounts" },
      { name: "Term deposits" },
    ],
  },
  {
    name: "Investments",
    type: "asset",
    children: [
      { name: "Stocks" },
      { name: "Funds" },
      { name: "Bonds" },
    ],
  },
  {
    name: "Fixed assets",
    type: "asset",
    children: [
      { name: "Property" },
      { name: "Vehicles" },
    ],
  },
  {
    name: "Other assets",
    type: "asset",
    children: [
      { name: "Receivables" },
      { name: "Other" },
    ],
  },
  {
    name: "Short-term liabilities",
    type: "liability",
    children: [
      { name: "Credit cards" },
      { name: "Buy now, pay later" },
      { name: "Short-term loans" },
    ],
  },
  {
    name: "Long-term liabilities",
    type: "liability",
    children: [
      { name: "Mortgages" },
      { name: "Auto loans" },
      { name: "Other loans" },
    ],
  },
]

/** Check if the app has been initialized (user made a choice) */
export function isAppInitialized(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SEED_KEY) === "true"
}

/** Mark app as initialized without seeding (user chose blank start) */
export function markInitialized(): void {
  localStorage.setItem(SEED_KEY, "true")
}

/** Seed default categories */
export async function seedDefaultCategories(): Promise<void> {
  const now = Date.now()
  const categories: Category[] = []
  let sortOrder = 0

  for (const group of defaultCategories) {
    const parentId = generateId()
    categories.push({
      id: parentId,
      name: group.name,
      type: group.type,
      parentId: null,
      sortOrder: sortOrder++,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })

    if (group.children) {
      let childOrder = 0
      for (const child of group.children) {
        categories.push({
          id: generateId(),
          name: child.name,
          type: group.type,
          parentId,
          sortOrder: childOrder++,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  }

  await db.categories.bulkAdd(categories)
  localStorage.setItem(SEED_KEY, "true")
}

/** Reset: clear all data and remove initialized flag */
export async function resetAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.categories, db.accounts, db.operations, db.entries, db.exchangeRates],
    async () => {
      await db.entries.clear()
      await db.operations.clear()
      await db.exchangeRates.clear()
      await db.accounts.clear()
      await db.categories.clear()
    }
  )
  localStorage.removeItem(SEED_KEY)
}
