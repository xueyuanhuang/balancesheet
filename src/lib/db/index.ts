import Dexie, { type EntityTable } from "dexie"
import type { Category, Account, Operation, Entry, ExchangeRate } from "@/types"

const db = new Dexie("BalanceSheetDB") as Dexie & {
  categories: EntityTable<Category, "id">
  accounts: EntityTable<Account, "id">
  operations: EntityTable<Operation, "id">
  entries: EntityTable<Entry, "id">
  exchangeRates: EntityTable<ExchangeRate, "currency">
}

db.version(1).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  transactions: "id, accountId, kind, direction, occurredAt, transferGroupId, createdAt",
})

db.version(2).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  transactions: null,
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
})

db.version(3).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, parentId, isArchived, sortOrder",
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
}).upgrade(async (tx) => {
  await tx.table("accounts").toCollection().modify((account) => {
    if (account.parentId === undefined) {
      account.parentId = null
    }
  })
})

// v4: Convert parent-child account relationships to category hierarchy
// For each parent account, create a sub-category and move children there
db.version(4).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
}).upgrade(async (tx) => {
  const accounts = tx.table("accounts")
  const categories = tx.table("categories")

  const allAccounts = await accounts.toArray()

  // Find parent account IDs (accounts that have children pointing to them)
  const parentIds = new Set<string>()
  for (const a of allAccounts) {
    if (a.parentId) parentIds.add(a.parentId)
  }

  if (parentIds.size === 0) {
    // No parent-child relationships, just strip parentId
    await accounts.toCollection().modify((a) => {
      delete a.parentId
    })
    return
  }

  const now = Date.now()

  for (const parentId of parentIds) {
    const parent = allAccounts.find((a) => a.id === parentId)
    if (!parent) continue

    // Look up the parent's category to get its type
    const parentCategory = await categories.get(parent.categoryId)
    if (!parentCategory) continue

    // Get max sortOrder among sibling categories
    const siblings = await categories.where("parentId").equals(parent.categoryId).toArray()
    const maxSort = siblings.length > 0 ? Math.max(...siblings.map((s: { sortOrder: number }) => s.sortOrder)) : -1

    // Create a new sub-category named after the parent account
    const newCategoryId = parent.id + "_cat"
    await categories.add({
      id: newCategoryId,
      name: parent.name,
      type: parentCategory.type,
      parentId: parent.categoryId,
      sortOrder: maxSort + 1,
      isArchived: parent.isArchived,
      createdAt: now,
      updatedAt: now,
    })

    // Move child accounts to the new category
    const children = allAccounts.filter((a) => a.parentId === parentId)
    for (const child of children) {
      await accounts.update(child.id, { categoryId: newCategoryId, parentId: undefined })
    }

    // Delete the parent account (it's now a category)
    await accounts.delete(parentId)
  }

  // Strip parentId from remaining accounts
  await accounts.toCollection().modify((a) => {
    delete a.parentId
  })
})

// v11: Force schema repair for databases stuck at IDB version 10
// Dexie v1-v4 may correspond to IDB versions 1-4 or 10-40 depending on Dexie's
// internal multiplier. Adding v11 ensures we exceed IDB version 10 and trigger
// the upgrade that creates missing objectStores.
db.version(11).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
})

export { db }
