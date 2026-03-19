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
    const updates: Record<string, unknown> = { ...data, updatedAt: Date.now() }

    const account = await db.accounts.get(id)
    if (!account) throw new Error("账户不存在")

    // Prevent currency change if account has entries
    if (data.currency !== undefined && data.currency !== account.currency) {
      const entryCount = await db.entries.where("accountId").equals(id).count()
      if (entryCount > 0) {
        throw new Error("该账户已有流水记录，无法修改币种。")
      }
    }

    // If opening balance changed, recalculate balance
    if (data.openingBalance !== undefined) {
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

  /** Move account to a new category and/or sort position */
  async moveAccount(
    accountId: string,
    targetCategoryId: string,
    sortIndex: number | null
  ): Promise<void> {
    await db.transaction("rw", [db.accounts, db.categories], async () => {
      const account = await db.accounts.get(accountId)
      if (!account) throw new Error("账户不存在")

      const sourceCategory = await db.categories.get(account.categoryId)
      const targetCategory = await db.categories.get(targetCategoryId)
      if (!targetCategory) throw new Error("目标分类不存在")
      if (sourceCategory && sourceCategory.type !== targetCategory.type) {
        throw new Error("不能将账户移动到不同类型的分类")
      }

      // Get new siblings (excluding the account itself)
      const newSiblings = await db.accounts
        .where("categoryId").equals(targetCategoryId)
        .sortBy("sortOrder")
      const filtered = newSiblings.filter((a) => a.id !== accountId)

      const effectiveIndex = sortIndex !== null
        ? Math.min(sortIndex, filtered.length)
        : filtered.length

      // No-op detection
      if (account.categoryId === targetCategoryId) {
        const currentSiblings = await db.accounts
          .where("categoryId").equals(targetCategoryId)
          .sortBy("sortOrder")
        const currentIndex = currentSiblings.findIndex((a) => a.id === accountId)
        if (currentIndex === effectiveIndex || (effectiveIndex > currentIndex && effectiveIndex === currentIndex + 1)) {
          return
        }
      }

      // Re-sort old siblings if changing category
      if (account.categoryId !== targetCategoryId) {
        const oldSiblings = await db.accounts
          .where("categoryId").equals(account.categoryId)
          .sortBy("sortOrder")
        const oldFiltered = oldSiblings.filter((a) => a.id !== accountId)
        for (let i = 0; i < oldFiltered.length; i++) {
          if (oldFiltered[i].sortOrder !== i) {
            await db.accounts.update(oldFiltered[i].id, { sortOrder: i, updatedAt: Date.now() })
          }
        }
      }

      // Shift siblings at new position
      for (let i = filtered.length - 1; i >= effectiveIndex; i--) {
        await db.accounts.update(filtered[i].id, {
          sortOrder: i + 1,
          updatedAt: Date.now(),
        })
      }

      // Update the moved account
      await db.accounts.update(accountId, {
        categoryId: targetCategoryId,
        sortOrder: effectiveIndex,
        updatedAt: Date.now(),
      })
    })
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
