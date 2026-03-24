"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react"
import { formatAmount, formatDate } from "@/lib/utils/format"
import { useMonthlySummary } from "@/lib/hooks/use-monthly-summary"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function MonthlySummary() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const data = useMonthlySummary(year, month)

  const goToPrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const incomeItems = data.items.filter((i) => i.type === "income")
  const expenseItems = data.items.filter((i) => i.type === "expense")

  return (
    <div className="px-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={goToPrevMonth} className="p-1 hover:bg-accent rounded">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {year}年{month + 1}月
          </span>
          <button onClick={goToNextMonth} className="p-1 hover:bg-accent rounded">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">收入</div>
            <div className="text-sm font-medium text-emerald-600 tabular-nums">
              {formatAmount(data.totalIncome)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">支出</div>
            <div className="text-sm font-medium text-red-500 tabular-nums">
              {formatAmount(data.totalExpense)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">结余</div>
            <div
              className={cn(
                "text-sm font-medium tabular-nums",
                data.net >= 0 ? "text-emerald-600" : "text-red-500"
              )}
            >
              {formatAmount(data.net)}
            </div>
          </div>
        </div>

        {/* Expense detail */}
        {expenseItems.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> 支出明细
            </div>
            <div className="space-y-0.5">
              {expenseItems.map((item) => (
                <Link
                  key={`${item.operationId}-${item.accountName}`}
                  href={`/transactions/${item.operationId}/edit`}
                >
                  <div className="flex items-center justify-between py-1.5 hover:bg-accent/50 rounded px-1.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm truncate block">{item.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.accountName} · {formatDate(item.occurredAt, "MM-dd")}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums text-red-500 shrink-0 ml-2">
                      {formatAmount(-item.amountCNY)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Income detail */}
        {incomeItems.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> 收入明细
            </div>
            <div className="space-y-0.5">
              {incomeItems.map((item) => (
                <Link
                  key={`${item.operationId}-${item.accountName}`}
                  href={`/transactions/${item.operationId}/edit`}
                >
                  <div className="flex items-center justify-between py-1.5 hover:bg-accent/50 rounded px-1.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm truncate block">{item.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.accountName} · {formatDate(item.occurredAt, "MM-dd")}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums text-emerald-600 shrink-0 ml-2">
                      {formatAmount(item.amountCNY)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {data.items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            本月暂无收支记录
          </div>
        )}
      </div>
    </div>
  )
}
