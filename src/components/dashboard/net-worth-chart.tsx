"use client"

import { useState, useMemo } from "react"
import { format, subDays, subMonths, subYears } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import type { NetWorthSnapshot } from "@/types"

const RANGES = [
  { label: "1天", days: 1 },
  { label: "1周", days: 7 },
  { label: "1月", days: 30 },
  { label: "3月", days: 90 },
  { label: "1年", days: 365 },
  { label: "全部", days: 0 },
] as const

type MetricType = "netWorth" | "totalAssets" | "totalLiabilities"

const METRICS: { key: MetricType; label: string }[] = [
  { key: "netWorth", label: "净资产" },
  { key: "totalAssets", label: "总资产" },
  { key: "totalLiabilities", label: "总负债" },
]

const METRIC_COLORS: Record<MetricType, { light: string; dark: string; stroke: string }> = {
  netWorth: {
    light: "hsl(142.1 76.2% 36.3%)",
    dark: "hsl(142.1 70.6% 45.3%)",
    stroke: "hsl(142.1 76.2% 36.3%)",
  },
  totalAssets: {
    light: "hsl(221 83% 53%)",
    dark: "hsl(217 91% 60%)",
    stroke: "hsl(221 83% 53%)",
  },
  totalLiabilities: {
    light: "hsl(0 72% 51%)",
    dark: "hsl(0 72% 60%)",
    stroke: "hsl(0 72% 51%)",
  },
}

function formatYAxis(cents: number): string {
  const yuan = cents / 100
  const abs = Math.abs(yuan)
  if (abs >= 10000) {
    return `${(yuan / 10000).toFixed(1)}万`
  }
  return yuan.toLocaleString("zh-CN", { maximumFractionDigits: 0 })
}

function parseSnapshotDate(dateStr: string): Date {
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

/** Convert a snapshot to CNY values */
function snapshotToValues(
  snapshot: NetWorthSnapshot,
  rateMap: Record<string, number>
): { totalAssets: number; totalLiabilities: number; netWorth: number } {
  if (snapshot.assets) {
    let totalAssets = 0
    let totalLiabilities = 0
    for (const [currency, cents] of Object.entries(snapshot.assets)) {
      totalAssets += convertToCNY(cents, currency, rateMap)
    }
    for (const [currency, cents] of Object.entries(snapshot.liabilities ?? {})) {
      totalLiabilities += convertToCNY(cents, currency, rateMap)
    }
    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
  }
  // v1 legacy
  const nw = snapshot.netWorth ?? 0
  const ta = snapshot.totalAssets ?? 0
  const tl = snapshot.totalLiabilities ?? 0
  return { totalAssets: ta, totalLiabilities: tl, netWorth: nw }
}

interface NetWorthChartProps {
  privacyMode?: boolean
}

export function NetWorthChart({ privacyMode = false }: NetWorthChartProps) {
  const [rangeDays, setRangeDays] = useState(() => {
    if (typeof window === "undefined") return 30
    const saved = localStorage.getItem("net-worth-chart-range")
    return saved ? Number(saved) : 30
  })
  const [metric, setMetric] = useState<MetricType>("netWorth")
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

  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        date: s.date,
        ...snapshotToValues(s, rateMap),
      })),
    [snapshots, rateMap]
  )

  const yDomain = useMemo(() => {
    if (chartData.length < 2) return undefined
    const values = chartData.map((s) => s[metric])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const r = max - min
    const padding = r > 0 ? r * 0.15 : Math.abs(max) * 0.05 || 10000
    return [Math.floor(min - padding), Math.ceil(max + padding)] as [number, number]
  }, [chartData, metric])

  const colors = METRIC_COLORS[metric]
  const metricLabel = METRICS.find((m) => m.key === metric)!.label

  const chartConfig = {
    [metric]: {
      label: metricLabel,
      theme: { light: colors.light, dark: colors.dark },
    },
  } satisfies ChartConfig

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm font-medium">趋势</div>
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
          <div className="text-sm font-medium">趋势</div>
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
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          {/* Metric tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  metric === m.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {/* Range selector */}
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
              <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.light} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors.light} stopOpacity={0.05} />
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
              hide={privacyMode}
            />
            {!privacyMode && (
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
            )}
            <Area
              type="monotone"
              dataKey={metric}
              stroke={colors.stroke}
              strokeWidth={2}
              fill="url(#metricGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
