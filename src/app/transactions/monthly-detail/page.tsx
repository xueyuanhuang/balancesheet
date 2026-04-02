"use client"

import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { useMonthlySummary } from "@/lib/hooks/use-monthly-summary"
import { formatAmount, formatDate } from "@/lib/utils/format"
import Link from "next/link"

export default function MonthlyDetailPage() {
  const searchParams = useSearchParams()
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const month = Number(searchParams.get("month")) || 0
  const type = searchParams.get("type") === "income" ? "income" : "expense"

  const data = useMonthlySummary(year, month)
  const items = data.items.filter((i) => i.type === type)
  const total = type === "income" ? data.totalIncome : data.totalExpense

  const title = `${year}年${month + 1}月${type === "income" ? "收入" : "支出"}`
  const isIncome = type === "income"

  return (
    <div>
      <PageHeader title={title} showBack />
      <div className="py-4">
        {/* Total */}
        <div className="px-4 mb-4 text-center">
          <div className="text-xs text-muted-foreground">
            {isIncome ? "总收入" : "总支出"}
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              isIncome ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {formatAmount(isIncome ? total : -total)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            共 {items.length} 笔
          </div>
        </div>

        {/* Item list */}
        {items.length > 0 ? (
          <div className="space-y-0.5">
            {items.map((item) => (
              <Link
                key={`${item.operationId}-${item.accountName}`}
                href={`/transactions/edit?id=${item.operationId}`}
              >
                <div className="flex items-center justify-between py-3 px-4 hover:bg-accent/50 active:bg-accent rounded-lg">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">
                      {item.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.accountName} · {formatDate(item.occurredAt, "MM-dd")}
                    </span>
                  </div>
                  <span
                    className={`text-sm tabular-nums shrink-0 ml-2 ${
                      isIncome ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {formatAmount(isIncome ? item.amountCNY : -item.amountCNY)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            本月暂无{isIncome ? "收入" : "支出"}记录
          </div>
        )}
      </div>
    </div>
  )
}
