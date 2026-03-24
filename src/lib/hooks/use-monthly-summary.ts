"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { convertToCNY } from "@/lib/utils/currency"

export interface MonthlySummaryItem {
  operationId: string
  description: string
  occurredAt: number
  accountName: string
  currency: string
  amount: number // original cents
  amountCNY: number // converted to CNY cents
  type: "income" | "expense"
}

export interface MonthlySummaryData {
  totalIncome: number // CNY cents
  totalExpense: number // CNY cents
  net: number // CNY cents
  items: MonthlySummaryItem[]
}

export function useMonthlySummary(year: number, month: number) {
  return useLiveQuery(
    async (): Promise<MonthlySummaryData> => {
      const startDate = new Date(year, month, 1).getTime()
      const endDate = new Date(year, month + 1, 1).getTime()

      // Get operations in this month (only normal/adjustment)
      const operations = await db.operations
        .where("occurredAt")
        .between(startDate, endDate, true, false)
        .toArray()

      const relevantOps = operations.filter(
        (op) => op.kind === "normal" || op.kind === "adjustment"
      )

      if (relevantOps.length === 0) {
        return { totalIncome: 0, totalExpense: 0, net: 0, items: [] }
      }

      const opIds = relevantOps.map((op) => op.id)
      const entries = await db.entries.where("operationId").anyOf(opIds).toArray()

      const accounts = await db.accounts.toArray()
      const categories = await db.categories.toArray()
      const exchangeRates = await db.exchangeRates.toArray()

      const accountMap = new Map(accounts.map((a) => [a.id, a]))
      const categoryMap = new Map(categories.map((c) => [c.id, c]))
      const rateMap: Record<string, number> = { CNY: 1 }
      for (const r of exchangeRates) {
        rateMap[r.currency] = r.rateToCNY
      }
      const opMap = new Map(relevantOps.map((op) => [op.id, op]))

      const items: MonthlySummaryItem[] = []

      for (const entry of entries) {
        const account = accountMap.get(entry.accountId)
        if (!account) continue
        const category = categoryMap.get(account.categoryId)
        if (!category) continue
        const operation = opMap.get(entry.operationId)
        if (!operation) continue

        // Asset increase = income, asset decrease = expense
        // Liability increase = expense (credit card), liability decrease = income
        let type: "income" | "expense"
        if (category.type === "asset") {
          type = entry.effect === "increase" ? "income" : "expense"
        } else {
          type = entry.effect === "increase" ? "expense" : "income"
        }

        const amountCNY = convertToCNY(entry.amount, account.currency, rateMap)

        items.push({
          operationId: operation.id,
          description: operation.description || (type === "income" ? "收入" : "支出"),
          occurredAt: operation.occurredAt,
          accountName: account.name,
          currency: account.currency,
          amount: entry.amount,
          amountCNY,
          type,
        })
      }

      // Sort by CNY amount descending
      items.sort((a, b) => b.amountCNY - a.amountCNY)

      const totalIncome = items
        .filter((i) => i.type === "income")
        .reduce((sum, i) => sum + i.amountCNY, 0)
      const totalExpense = items
        .filter((i) => i.type === "expense")
        .reduce((sum, i) => sum + i.amountCNY, 0)

      return {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        items,
      }
    },
    [year, month],
    { totalIncome: 0, totalExpense: 0, net: 0, items: [] } as MonthlySummaryData
  )
}
