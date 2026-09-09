"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useMonthlySummary } from "@/lib/hooks/use-monthly-summary"
import { formatAmount, formatDate } from "@/lib/utils/format"

const chartConfig = {
  netIncome: {
    label: "Net income",
    theme: { light: "#2563eb", dark: "#60a5fa" },
  },
  income: {
    label: "Income",
    theme: { light: "#059669", dark: "#34d399" },
  },
  expense: {
    label: "Expenses",
    theme: { light: "#ef4444", dark: "#f87171" },
  },
} satisfies ChartConfig

const compactAmount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const tooltipOrder: Record<string, number> = { netIncome: 0, income: 1, expense: 2 }

function formatNetIncome(cents: number): string {
  return `${cents > 0 ? "+" : ""}${formatAmount(cents)}`
}

export function MonthlyCashFlowChart({ privacyMode = false }: { privacyMode?: boolean }) {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
  )

  // Keep hook order fixed, and share the Activity page's reporting rules.
  const first = useMonthlySummary(months[0].getFullYear(), months[0].getMonth())
  const second = useMonthlySummary(months[1].getFullYear(), months[1].getMonth())
  const third = useMonthlySummary(months[2].getFullYear(), months[2].getMonth())
  const fourth = useMonthlySummary(months[3].getFullYear(), months[3].getMonth())
  const fifth = useMonthlySummary(months[4].getFullYear(), months[4].getMonth())
  const sixth = useMonthlySummary(months[5].getFullYear(), months[5].getMonth())

  const data = [first, second, third, fourth, fifth, sixth].map((summary, index) => ({
    month: formatDate(months[index].getTime(), "MMM"),
    fullMonth: formatDate(months[index].getTime(), "MMMM yyyy"),
    income: summary.totalIncome,
    expense: summary.totalExpense,
    netIncome: summary.net,
  }))
  const currentMonth = data[5]
  const hasActivity = data.some((month) => month.income > 0 || month.expense > 0)
  const minimumNet = Math.min(0, ...data.map((month) => month.netIncome))
  const maximumStack = Math.max(...data.map((month) => month.income + month.expense))
  const axisPadding = (maximumStack - minimumNet) * 0.08
  const yDomain: [number, number] = [
    minimumNet < 0 ? minimumNet - axisPadding : 0,
    maximumStack + axisPadding,
  ]

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div>
          <h2 className="text-sm font-medium">Monthly net income</h2>
          <p className="text-xs text-muted-foreground mt-1">{currentMonth.fullMonth}</p>
          <div className={`mt-1 break-all text-2xl font-semibold tabular-nums ${
            privacyMode || currentMonth.netIncome === 0 ? "" : currentMonth.netIncome > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
          }`}>
            {privacyMode ? "••••" : formatNetIncome(currentMonth.netIncome)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b pb-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Income</div>
            <div className="mt-0.5 break-all text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {privacyMode ? "••••" : formatAmount(currentMonth.income)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Expenses</div>
            <div className="mt-0.5 break-all text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
              {privacyMode ? "••••" : formatAmount(currentMonth.expense)}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Last 6 months · CNY</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Chart legend">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-3.5 items-center justify-center" aria-hidden="true">
              <span className="absolute h-0.5 w-full bg-blue-600 dark:bg-blue-400" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            </span>
            Net income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500 dark:bg-red-400" aria-hidden="true" />
            Expenses
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {hasActivity ? (
          <>
            <ChartContainer config={chartConfig} className="h-52 w-full aspect-auto" aria-hidden="true">
              <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={40}
                  tickCount={4}
                  tickFormatter={(cents: number) => compactAmount.format(cents / 100)}
                  domain={yDomain}
                  hide={privacyMode}
                />
                <ReferenceLine y={0} stroke="var(--border)" />
                {!privacyMode && (
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={({ active, payload, label }) => (
                      <ChartTooltipContent
                        active={active}
                        label={label}
                        payload={[...(payload ?? [])].sort((a, b) =>
                          (tooltipOrder[String(a.dataKey)] ?? 3) - (tooltipOrder[String(b.dataKey)] ?? 3)
                        )}
                        hideIndicator
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullMonth ?? ""}
                        formatter={(value, name) => (
                          <>
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: `var(--color-${name})` }}
                            />
                            <span className="text-muted-foreground">
                              {name === "netIncome" ? "Net income" : name === "income" ? "Income" : "Expenses"}
                            </span>
                            <span className="ml-auto font-medium tabular-nums">
                              {name === "netIncome" ? formatNetIncome(Number(value)) : formatAmount(Number(value))}
                            </span>
                          </>
                        )}
                      />
                    )}
                  />
                )}
                <Bar dataKey="income" stackId="cash-flow" fill="var(--color-income)" maxBarSize={40} isAnimationActive={false} />
                <Bar dataKey="expense" stackId="cash-flow" fill="var(--color-expense)" maxBarSize={40} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line
                  dataKey="netIncome"
                  type="linear"
                  stroke="var(--color-netIncome)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-netIncome)", stroke: "var(--background)", strokeWidth: 1.5 }}
                  activeDot={privacyMode ? false : { r: 4, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
            {privacyMode ? (
              <p className="sr-only">Monthly net income, income, and expenses chart. Amounts are hidden.</p>
            ) : (
              <div className="sr-only">
                <table>
                  <caption>Monthly net income, income, and expenses for the last six months, in CNY</caption>
                  <thead>
                    <tr><th scope="col">Month</th><th scope="col">Net income</th><th scope="col">Income</th><th scope="col">Expenses</th></tr>
                  </thead>
                  <tbody>
                    {data.map((month) => (
                      <tr key={month.fullMonth}>
                        <th scope="row">{month.fullMonth}</th>
                        <td>{formatNetIncome(month.netIncome)}</td>
                        <td>{formatAmount(month.income)}</td>
                        <td>{formatAmount(month.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
            No income or expenses in the last 6 months.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
