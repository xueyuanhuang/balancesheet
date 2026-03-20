import { db } from "@/lib/db"
import { format } from "date-fns"

export const snapshotService = {
  /** Record current hour's snapshot with per-currency breakdowns (upsert) */
  async recordToday(): Promise<void> {
    const date = format(new Date(), "yyyy-MM-dd HH:00")
    const [accounts, categories] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
    ])

    const categoryTypeMap = new Map(categories.map((c) => [c.id, c.type]))
    const assets: Record<string, number> = {}
    const liabilities: Record<string, number> = {}

    for (const account of accounts) {
      if (account.isArchived) continue
      const type = categoryTypeMap.get(account.categoryId)
      if (!type) continue
      const bucket = type === "asset" ? assets : liabilities
      bucket[account.currency] = (bucket[account.currency] || 0) + account.balance
    }

    await db.netWorthSnapshots.put({
      date,
      assets,
      liabilities,
      createdAt: Date.now(),
    })
  },

  /** Get all snapshots */
  async getAll() {
    return db.netWorthSnapshots.orderBy("date").toArray()
  },

  /** Get snapshots from a start date */
  async getFrom(startDate: string) {
    return db.netWorthSnapshots
      .where("date")
      .aboveOrEqual(startDate)
      .toArray()
  },

  /** Clear all snapshots (for backup restore) */
  async clear() {
    await db.netWorthSnapshots.clear()
  },
}
