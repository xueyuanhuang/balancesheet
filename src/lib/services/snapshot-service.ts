import { db } from "@/lib/db"
import { format } from "date-fns"

export const snapshotService = {
  /** Record today's net worth snapshot (upsert) */
  async recordToday({
    netWorth,
    totalAssets,
    totalLiabilities,
  }: {
    netWorth: number
    totalAssets: number
    totalLiabilities: number
  }): Promise<void> {
    const date = format(new Date(), "yyyy-MM-dd HH:00")
    await db.netWorthSnapshots.put({
      date,
      netWorth,
      totalAssets,
      totalLiabilities,
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
