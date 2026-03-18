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
    name: "现金及存款",
    type: "asset",
    children: [
      { name: "现金" },
      { name: "活期存款" },
      { name: "定期存款" },
    ],
  },
  {
    name: "投资资产",
    type: "asset",
    children: [
      { name: "股票" },
      { name: "基金" },
      { name: "债券" },
    ],
  },
  {
    name: "固定资产",
    type: "asset",
    children: [
      { name: "房产" },
      { name: "车辆" },
    ],
  },
  {
    name: "其他资产",
    type: "asset",
    children: [
      { name: "应收款项" },
      { name: "其他" },
    ],
  },
  {
    name: "短期负债",
    type: "liability",
    children: [
      { name: "信用卡" },
      { name: "花呗/白条" },
      { name: "短期借款" },
    ],
  },
  {
    name: "长期负债",
    type: "liability",
    children: [
      { name: "房贷" },
      { name: "车贷" },
      { name: "其他贷款" },
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
