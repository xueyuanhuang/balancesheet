import { db } from "@/lib/db"
import { generateId } from "@/lib/utils/id"
import type { Account } from "@/types"

export const accountService = {
  async getAll(): Promise<Account[]> {
    return db.accounts.orderBy("sortOrder").toArray()
  },

  async getById(id: string): Promise<Account | undefined> {
    return db.accounts.get(id)
  },

  async getByCategoryId(categoryId: string): Promise<Account[]> {
    return db.accounts.where("categoryId").equals(categoryId).sortBy("sortOrder")
  },

  async create(data: {
    name: string
    categoryId: string
    openingBalance: number
    currency?: string
    note?: string
  }): Promise<string> {
    const now = Date.now()
    const id = generateId()
    const siblings = await db.accounts.where("categoryId").equals(data.categoryId).toArray()
    const maxSort = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) : -1

    await db.accounts.add({
      id,
      name: data.name,
      categoryId: data.categoryId,
      openingBalance: data.openingBalance,
      balance: data.openingBalance,
      currency: data.currency ?? "CNY",
      note: data.note ?? "",
      isArchived: false,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    })

    return id
  },

  async update(id: string, data: Partial<Pick<Account, "name" | "categoryId" | "openingBalance" | "currency" | "note" | "sortOrder">>): Promise<void> {
    // Prevent currency change if account has entries
    if (data.currency !== undefined) {
      const entryCount = await db.entries.where("accountId").equals(id).count()
      if (entryCount > 0) {
        throw new Error("该账户已有流水记录，无法修改币种。")
      }
    }

    const updates: Record<string, unknown> = { ...data, updatedAt: Date.now() }

    // If opening balance changed, recalculate balance
    if (data.openingBalance !== undefined) {
      const account = await db.accounts.get(id)
      if (!account) throw new Error("账户不存在")

      const entries = await db.entries.where("accountId").equals(id).toArray()
      const incSum = entries
        .filter((e) => e.effect === "increase")
        .reduce((sum, e) => sum + e.amount, 0)
      const decSum = entries
        .filter((e) => e.effect === "decrease")
        .reduce((sum, e) => sum + e.amount, 0)

      updates.balance = data.openingBalance + incSum - decSum
    }

    await db.accounts.update(id, updates)
  },

  async recalculateBalance(accountId: string): Promise<void> {
    const account = await db.accounts.get(accountId)
    if (!account) return

    const entries = await db.entries.where("accountId").equals(accountId).toArray()
    const incSum = entries
      .filter((e) => e.effect === "increase")
      .reduce((sum, e) => sum + e.amount, 0)
    const decSum = entries
      .filter((e) => e.effect === "decrease")
      .reduce((sum, e) => sum + e.amount, 0)

    const newBalance = account.openingBalance + incSum - decSum
    await db.accounts.update(accountId, { balance: newBalance, updatedAt: Date.now() })
  },

  async archive(id: string): Promise<void> {
    await db.accounts.update(id, { isArchived: true, updatedAt: Date.now() })
  },

  async restore(id: string): Promise<void> {
    await db.accounts.update(id, { isArchived: false, updatedAt: Date.now() })
  },

  async getDeleteInfo(id: string): Promise<{ entryCount: number; balance: number }> {
    const entryCount = await db.entries.where("accountId").equals(id).count()
    const account = await db.accounts.get(id)
    return { entryCount, balance: account?.balance ?? 0 }
  },

  /** Delete account — only allowed if no entries */
  async delete(id: string): Promise<void> {
    const entryCount = await db.entries.where("accountId").equals(id).count()
    if (entryCount > 0) {
      throw new Error("该账户已有流水记录，无法删除。请先归档账户。")
    }
    await db.accounts.delete(id)
  },
}
