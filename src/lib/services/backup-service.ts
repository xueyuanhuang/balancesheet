import { db } from "@/lib/db"
import { backupSchema } from "@/lib/validations"
import { accountService } from "./account-service"
import { formatDate, formatAmount } from "@/lib/utils/format"

export const backupService = {
  /** Export all data as JSON */
  async exportJSON(): Promise<void> {
    const [categories, accounts, operations, entries, exchangeRates, netWorthSnapshots] = await Promise.all([
      db.categories.toArray(),
      db.accounts.toArray(),
      db.operations.toArray(),
      db.entries.toArray(),
      db.exchangeRates.toArray(),
      db.netWorthSnapshots.toArray(),
    ])

    const data = {
      version: 4,
      exportedAt: Date.now(),
      categories,
      accounts,
      operations,
      entries,
      exchangeRates,
      netWorthSnapshots,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `balancesheet-backup-${formatDate(Date.now(), "yyyyMMdd-HHmmss")}.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  /** Export operations as CSV */
  async exportCSV(): Promise<void> {
    const [operations, entries, accounts] = await Promise.all([
      db.operations.orderBy("occurredAt").reverse().toArray(),
      db.entries.toArray(),
      db.accounts.toArray(),
    ])

    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    const entryMap = new Map<string, typeof entries>()
    for (const entry of entries) {
      const list = entryMap.get(entry.operationId) ?? []
      list.push(entry)
      entryMap.set(entry.operationId, list)
    }

    const kindLabels: Record<string, string> = {
      normal: "General",
      transfer: "Transfer",
      fx_transfer: "Currency exchange",
      liability_repayment: "Repayment",
      liability_drawdown: "Borrowing",
      adjustment: "Adjustment",
    }

    const header = "Date,Type,Description,Account 1,Effect 1,Amount 1,Account 2,Effect 2,Amount 2\n"
    const rows = operations.map((op) => {
      const opEntries = entryMap.get(op.id) ?? []
      const source = opEntries.find((e) => e.role === "source")
      const target = opEntries.find((e) => e.role === "target")

      const date = formatDate(op.occurredAt, "yyyy-MM-dd HH:mm")
      const kind = kindLabels[op.kind] ?? op.kind
      const desc = op.description.replace(/"/g, '""')

      const sourceAccount = source ? accountMap.get(source.accountId) : undefined
      const sourceAmount = source ? formatAmount(source.amount, sourceAccount?.currency) : ""
      const sourceEffect = source?.effect === "increase" ? "Increase" : source?.effect === "decrease" ? "Decrease" : ""

      const targetAccount = target ? accountMap.get(target.accountId) : undefined
      const targetAmount = target ? formatAmount(target.amount, targetAccount?.currency) : ""
      const targetEffect = target?.effect === "increase" ? "Increase" : target?.effect === "decrease" ? "Decrease" : ""

      return `"${date}","${kind}","${desc}","${sourceAccount?.name ?? ""}","${sourceEffect}","${sourceAmount}","${targetAccount?.name ?? ""}","${targetEffect}","${targetAmount}"`
    })

    const csv = header + rows.join("\n")
    const bom = "\uFEFF"
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `balancesheet-operations-${formatDate(Date.now(), "yyyyMMdd-HHmmss")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },

  /** Import JSON backup (full replace) */
  async importJSON(file: File): Promise<{ categories: number; accounts: number; operations: number }> {
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error("Invalid JSON file")
    }

    const result = backupSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error("Invalid backup format")
    }

    const data = result.data

    // Clear existing data and import
    await db.transaction(
      "rw",
      [db.categories, db.accounts, db.operations, db.entries, db.exchangeRates, db.netWorthSnapshots],
      async () => {
        await db.entries.clear()
        await db.operations.clear()
        await db.accounts.clear()
        await db.categories.clear()
        await db.exchangeRates.clear()
        await db.netWorthSnapshots.clear()

        await db.categories.bulkAdd(data.categories)
        await db.accounts.bulkAdd(data.accounts)
        await db.operations.bulkAdd(data.operations)
        await db.entries.bulkAdd(data.entries)
        if (data.exchangeRates.length > 0) {
          await db.exchangeRates.bulkAdd(data.exchangeRates)
        }
        if (data.netWorthSnapshots?.length) {
          await db.netWorthSnapshots.bulkAdd(data.netWorthSnapshots)
        }
      }
    )

    // Recalculate all account balances
    const accounts = await db.accounts.toArray()
    for (const account of accounts) {
      await accountService.recalculateBalance(account.id)
    }

    return {
      categories: data.categories.length,
      accounts: data.accounts.length,
      operations: data.operations.length,
    }
  },
}
