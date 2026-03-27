import Dexie, { type EntityTable } from "dexie"
import type { Category, Account, Operation, Entry, ExchangeRate, NetWorthSnapshot } from "@/types"

const db = new Dexie("BalanceSheetDB") as Dexie & {
  categories: EntityTable<Category, "id">
  accounts: EntityTable<Account, "id">
  operations: EntityTable<Operation, "id">
  entries: EntityTable<Entry, "id">
  exchangeRates: EntityTable<ExchangeRate, "currency">
  netWorthSnapshots: EntityTable<NetWorthSnapshot, "date">
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

// v12: Add net worth snapshots table
db.version(12).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
  netWorthSnapshots: "date",
})

// v13: Fix liability account entries — flip effects for normal/adjustment operations
// on liability accounts so that "支出" correctly increases the debt balance.
db.version(13).stores({
  categories: "id, type, parentId, sortOrder, isArchived",
  accounts: "id, categoryId, isArchived, sortOrder",
  operations: "id, kind, occurredAt, createdAt",
  entries: "id, operationId, accountId",
  exchangeRates: "currency",
  netWorthSnapshots: "date",
}).upgrade(async (tx) => {
  const categories = tx.table("categories")
  const accounts = tx.table("accounts")
  const operations = tx.table("operations")
  const entries = tx.table("entries")

  // Find all liability category IDs
  const allCategories = await categories.toArray()
  const liabilityCategoryIds = new Set(
    allCategories.filter((c: { type: string }) => c.type === "liability").map((c: { id: string }) => c.id)
  )

  // Find all liability account IDs
  const allAccounts = await accounts.toArray()
  const liabilityAccounts = allAccounts.filter(
    (a: { categoryId: string }) => liabilityCategoryIds.has(a.categoryId)
  )
  const liabilityAccountIds = new Set(liabilityAccounts.map((a: { id: string }) => a.id))

  if (liabilityAccountIds.size === 0) return

  // Find all normal/adjustment operation IDs
  const allOps = await operations.toArray()
  const normalAdjOpIds = new Set(
    allOps
      .filter((op: { kind: string }) => op.kind === "normal" || op.kind === "adjustment")
      .map((op: { id: string }) => op.id)
  )

  // Flip effects for entries on liability accounts from normal/adjustment operations
  await entries.toCollection().modify((entry: { accountId: string; operationId: string; effect: string }) => {
    if (liabilityAccountIds.has(entry.accountId) && normalAdjOpIds.has(entry.operationId)) {
      entry.effect = entry.effect === "increase" ? "decrease" : "increase"
    }
  })

  // Recalculate balances for liability accounts
  for (const account of liabilityAccounts) {
    const acct = account as { id: string; openingBalance: number }
    const accountEntries = await entries.where("accountId").equals(acct.id).toArray()
    const incSum = accountEntries
      .filter((e: { effect: string }) => e.effect === "increase")
      .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
    const decSum = accountEntries
      .filter((e: { effect: string }) => e.effect === "decrease")
      .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

    await accounts.update(acct.id, {
      balance: acct.openingBalance + incSum - decSum,
      updatedAt: Date.now(),
    })
  }
})

export { db }
