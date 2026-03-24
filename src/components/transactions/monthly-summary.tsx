"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatAmount } from "@/lib/utils/format"
import { useMonthlySummary } from "@/lib/hooks/use-monthly-summary"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
]

export function MonthlySummary() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)

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

  const handlePickMonth = (m: number) => {
    setYear(pickerYear)
    setMonth(m)
    setPickerOpen(false)
  }

  const handlePickerOpen = (open: boolean) => {
    if (open) setPickerYear(year)
    setPickerOpen(open)
  }

  return (
    <div className="px-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={goToPrevMonth} className="p-1 hover:bg-accent rounded">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Dialog open={pickerOpen} onOpenChange={handlePickerOpen}>
            <DialogTrigger
              render={
                <button className="text-sm font-medium hover:bg-accent rounded px-2 py-1" />
              }
            >
              {year}年{month + 1}月
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setPickerYear((y) => y - 1)}
                      className="p-1 hover:bg-accent rounded"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span>{pickerYear}年</span>
                    <button
                      onClick={() => setPickerYear((y) => y + 1)}
                      className="p-1 hover:bg-accent rounded"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((label, i) => (
                  <Button
                    key={i}
                    variant={pickerYear === year && i === month ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePickMonth(i)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <button onClick={goToNextMonth} className="p-1 hover:bg-accent rounded">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Summary stats — clickable income / expense */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Link href={`/transactions/monthly-detail?year=${year}&month=${month}&type=income`}>
            <div className="rounded-md py-1 hover:bg-accent/50 active:bg-accent">
              <div className="text-xs text-muted-foreground">收入</div>
              <div className="text-sm font-medium text-emerald-600 tabular-nums">
                {formatAmount(data.totalIncome)}
              </div>
            </div>
          </Link>
          <Link href={`/transactions/monthly-detail?year=${year}&month=${month}&type=expense`}>
            <div className="rounded-md py-1 hover:bg-accent/50 active:bg-accent">
              <div className="text-xs text-muted-foreground">支出</div>
              <div className="text-sm font-medium text-red-500 tabular-nums">
                {formatAmount(data.totalExpense)}
              </div>
            </div>
          </Link>
          <div className="py-1">
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

        {data.items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            本月暂无收支记录
          </div>
        )}
      </div>
    </div>
  )
}
