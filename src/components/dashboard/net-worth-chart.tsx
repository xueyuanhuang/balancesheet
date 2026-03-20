"use client"

import { useState, useMemo } from "react"
import { format, subDays, subMonths, subYears } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useNetWorthSnapshots } from "@/lib/hooks/use-net-worth-snapshots"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { convertToCNY } from "@/lib/utils/currency"
import { formatAmount } from "@/lib/utils/format"
import type { NetWorthSnapshot } from "@/types"

const RANGES = [
  { label: "1天", days: 1 },
  { label: "1周", days: 7 },
  { label: "1月", days: 30 },
  { label: "3月", days: 90 },
  { label: "1年", days: 365 },
  { label: "全部", days: 0 },
] as const

const chartConfig = {
  netWorth: {
    label: "净资产",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)",
      dark: "hsl(142.1 70.6% 45.3%)",
    },
  },
} satisfies ChartConfig

function formatYAxis(cents: number): string {
  const yuan = cents / 100
  const abs = Math.abs(yuan)
  if (abs >= 10000) {
    return `${(yuan / 10000).toFixed(1)}万`
  }
  return yuan.toLocaleString("zh-CN", { maximumFractionDigits: 0 })
}

function parseSnapshotDate(dateStr: string): Date {
  // Handle both "YYYY-MM-DD" (legacy) and "YYYY-MM-DD HH:00" formats
  if (dateStr.length === 10) return new Date(dateStr + "T00:00:00")
  const [datePart, timePart] = dateStr.split(" ")
  return new Date(`${datePart}T${timePart}:00`)
}

function getXAxisFormat(days: number): (date: string) => string {
  if (days > 0 && days <= 1) {
    return (date: string) => format(parseSnapshotDate(date), "HH:mm")
  }
  if (days > 0 && days <= 7) {
    return (date: string) => format(parseSnapshotDate(date), "M/d HH:mm")
  }
  if (days > 0 && days <= 90) {
    return (date: string) => format(parseSnapshotDate(date), "M/d")
  }
  return (date: string) => format(parseSnapshotDate(date), "M月", { locale: zhCN })
}

/** Convert a snapshot to CNY net worth using given rates */
function snapshotToNetWorth(
  snapshot: NetWorthSnapshot,
  rateMap: Record<string, number>
): number {
  // v2 format: per-currency data
  if (snapshot.assets) {
    let totalAssets = 0
    let totalLiabilities = 0
    for (const [currency, cents] of Object.entries(snapshot.assets)) {
      totalAssets += convertToCNY(cents, currency, rateMap)
    }
    for (const [currency, cents] of Object.entries(snapshot.liabilities ?? {})) {
      totalLiabilities += convertToCNY(cents, currency, rateMap)
    }
    return totalAssets - totalLiabilities
  }
  // v1 legacy: pre-computed CNY
  return snapshot.netWorth ?? 0
}

export function NetWorthChart() {
  const [rangeDays, setRangeDays] = useState(() => {
    if (typeof window === "undefined") return 30
    const saved = localStorage.getItem("net-worth-chart-range")
    return saved ? Number(saved) : 30
  })
  const range = RANGES.find((r) => r.days === rangeDays) ?? RANGES[2]
  const rateMap = useRateMap()

  const startDate = useMemo(() => {
    if (range.days === 0) return undefined
    const now = new Date()
    let from: Date
    if (range.days <= 1) from = subDays(now, 1)
    else if (range.days <= 7) from = subDays(now, range.days)
    else if (range.days <= 30) from = subMonths(now, 1)
    else if (range.days <= 90) from = subMonths(now, 3)
    else from = subYears(now, 1)
    return format(from, "yyyy-MM-dd")
  }, [range.days])

  const snapshots = useNetWorthSnapshots(startDate)
  const xAxisFormatter = useMemo(() => getXAxisFormat(range.days), [range.days])

  // Convert all snapshots to CNY using current exchange rates
  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        date: s.date,
        netWorth: snapshotToNetWorth(s, rateMap),
      })),
    [snapshots, rateMap]
  )

  const yDomain = useMemo(() => {
    if (chartData.length < 2) return undefined
    const values = chartData.map((s) => s.netWorth)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const r = max - min
    const padding = r > 0 ? r * 0.15 : Math.abs(max) * 0.05 || 10000
    return [Math.floor(min - padding), Math.ceil(max + padding)] as [number, number]
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">净资产趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            暂无历史数据，每次打开总览页会自动记录
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 1) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">净资产趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            数据不足，多打开几次总览页即可看到趋势
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">净资产趋势</CardTitle>
          <Select
            value={rangeDays}
            onValueChange={(v) => { if (v !== null) { setRangeDays(v as number); localStorage.setItem("net-worth-chart-range", String(v)) } }}
          >
            <SelectTrigger size="sm" className="text-xs">
              {range.label}
            </SelectTrigger>
            <SelectContent align="end">
              {RANGES.map((r) => (
                <SelectItem key={r.days} value={r.days}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <ChartContainer config={chartConfig} className="h-48 w-full aspect-auto">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-netWorth)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-netWorth)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={xAxisFormatter}
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={formatYAxis}
              width={48}
              domain={yDomain}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (!payload?.[0]?.payload?.date) return ""
                    return format(parseSnapshotDate(payload[0].payload.date), "yyyy年M月d日 HH:mm", { locale: zhCN })
                  }}
                  formatter={(value) => formatAmount(value as number)}
                  hideIndicator
                />
              }
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="var(--color-netWorth)"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
