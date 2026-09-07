"use client"

import { Fragment } from "react"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RefreshCw, Landmark, Settings2 } from "lucide-react"
import { AmountDisplay } from "@/components/shared/amount-display"
import { formatDateTime, formatAmount } from "@/lib/utils/format"
import { useAccount } from "@/lib/hooks/use-accounts"
import { useCategory } from "@/lib/hooks/use-categories"
import type { OperationWithEntries } from "@/types"
import { cn } from "@/lib/utils"

const KIND_LABELS: Record<string, string> = {
  normal: "普通",
  transfer: "转账",
  fx_transfer: "外汇转账",
  liability_repayment: "还款",
  liability_drawdown: "借款",
  adjustment: "调整",
}

interface OperationItemProps {
  data: OperationWithEntries
  runningBalances?: Map<string, number>
  filterAccountId?: string
}

export function OperationItem({ data, runningBalances, filterAccountId }: OperationItemProps) {
  const { operation, entries } = data
  const sourceEntry = entries.find((e) => e.role === "source")
  const targetEntry = entries.find((e) => e.role === "target")
  const isSingleEntry = entries.length === 1
  const isMultiEntry = entries.length === 2

  const sourceAccount = useAccount(sourceEntry?.accountId)
  const targetAccount = useAccount(targetEntry?.accountId)
  const sourceCategory = useCategory(sourceAccount?.categoryId)

  // For liability accounts, "increase" means debt went up = expense for user
  const isSourceLiability = sourceCategory?.type === "liability"

  // Icon and color
  let Icon = ArrowLeftRight
  let iconColor = "text-blue-500"

  if (isSingleEntry && sourceEntry) {
    // Determine if this is an expense from the user's perspective
    const isExpense = isSourceLiability
      ? sourceEntry.effect === "increase"  // liability increase = user spent on credit
      : sourceEntry.effect === "decrease"  // asset decrease = user spent cash
    if (isExpense) {
      Icon = ArrowUpRight
      iconColor = "text-red-500"
    } else {
      Icon = ArrowDownLeft
      iconColor = "text-emerald-500"
    }
  } else if (operation.kind === "fx_transfer") {
    Icon = RefreshCw
    iconColor = "text-purple-500"
  } else if (operation.kind === "liability_repayment" || operation.kind === "liability_drawdown") {
    Icon = Landmark
    iconColor = "text-amber-500"
  } else if (operation.kind === "adjustment") {
    Icon = Settings2
    iconColor = "text-gray-500"
  }

  // Description
  const kindLabel = KIND_LABELS[operation.kind] ?? "未知"
  const primaryText = operation.description || kindLabel

  const relatedAccounts = isMultiEntry ? [sourceAccount, targetAccount] : [sourceAccount]
  const editLabel = [
    "编辑流水",
    primaryText,
    relatedAccounts.map((account) => account?.name ?? "未知账户").join(" → "),
    formatDateTime(operation.occurredAt),
    sourceEntry ? formatAmount(sourceEntry.amount, sourceAccount?.currency) : "",
    targetEntry ? formatAmount(targetEntry.amount, targetAccount?.currency) : "",
  ].filter(Boolean).join("，")

  // Amount display
  const isCrossCurrency = isMultiEntry && sourceEntry && targetEntry &&
    sourceAccount && targetAccount &&
    sourceAccount.currency !== targetAccount.currency
  const hasFee = isMultiEntry && sourceEntry && targetEntry &&
    sourceAccount && targetAccount &&
    !isCrossCurrency && sourceEntry.amount !== targetEntry.amount

  // Running balance text (rendered below the amount column)
  const balanceText = (() => {
    if (!runningBalances) return null

    const fmt = (cents: number, currency: string) => formatAmount(cents, currency)

    if (filterAccountId) {
      const entry = entries.find((e) => e.accountId === filterAccountId)
      if (!entry) return null
      const account = entry.id === sourceEntry?.id ? sourceAccount : targetAccount
      const balance = runningBalances.get(entry.id)
      if (balance === undefined || !account) return null
      return `余 ${fmt(balance, account.currency)}`
    }

    if (isSingleEntry && sourceEntry && sourceAccount) {
      const balance = runningBalances.get(sourceEntry.id)
      if (balance === undefined) return null
      return `余 ${fmt(balance, sourceAccount.currency)}`
    }

    if (isMultiEntry && sourceEntry && targetEntry && sourceAccount && targetAccount) {
      const srcBal = runningBalances.get(sourceEntry.id)
      const tgtBal = runningBalances.get(targetEntry.id)
      if (srcBal === undefined || tgtBal === undefined) return null
      return `余 ${fmt(srcBal, sourceAccount.currency)} → ${fmt(tgtBal, targetAccount.currency)}`
    }

    return null
  })()

  return (
    <div className="relative isolate flex items-center gap-3 py-3 px-4 hover:bg-accent/50 active:bg-accent rounded-lg">
      <div className={cn("shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-muted", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        {/* The edit link covers the row; account links sit above it. */}
        <Link
          href={`/transactions/edit?id=${operation.id}`}
          aria-label={editLabel}
          className="block min-w-0 min-h-0 text-sm font-medium truncate after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {primaryText}
        </Link>
        <div className="flex items-center min-w-0 text-xs text-muted-foreground mt-0.5">
          <span className={cn(
            "items-center gap-1 min-w-0 max-w-full shrink-0",
            isMultiEntry ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "flex"
          )}>
            {relatedAccounts.map((account, index) => (
              <Fragment key={index}>
                {index > 0 && <span className="shrink-0" aria-hidden="true">→</span>}
                {account ? (
                  <Link
                    href={`/accounts/detail?id=${account.id}`}
                    aria-label={`查看账户：${account.name}`}
                    title={account.name}
                    className="relative z-10 min-w-0 min-h-0 truncate rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {account.name}
                  </Link>
                ) : (
                  <span className="truncate">未知账户</span>
                )}
              </Fragment>
            ))}
          </span>
          <span className="ml-1 truncate" title={formatDateTime(operation.occurredAt)}>
            · {formatDateTime(operation.occurredAt)}
          </span>
        </div>
      </div>
      <div className="min-w-0 max-w-[50%] shrink-0 text-right flex flex-col items-end">
        {isSingleEntry && sourceEntry ? (
          <AmountDisplay
            cents={
              (isSourceLiability
                ? sourceEntry.effect === "decrease"  // liability decrease = debt reduced = positive
                : sourceEntry.effect === "increase"  // asset increase = income = positive
              ) ? sourceEntry.amount : -sourceEntry.amount
            }
            size="sm"
            colorize
            currency={sourceAccount?.currency}
          />
        ) : isMultiEntry && sourceEntry && targetEntry ? (
          isCrossCurrency || hasFee ? (
            <>
              <span className="text-sm tabular-nums text-red-500">
                {formatAmount(-sourceEntry.amount, sourceAccount!.currency)}
              </span>
              <span className="text-xs tabular-nums text-emerald-600">
                {operation.kind === "liability_repayment"
                  ? formatAmount(-targetEntry.amount, targetAccount!.currency)
                  : formatAmount(targetEntry.amount, targetAccount!.currency)}
              </span>
            </>
          ) : (
            <AmountDisplay
              cents={sourceEntry.amount}
              size="sm"
              currency={sourceAccount?.currency}
            />
          )
        ) : null}
        {balanceText && (
          <span className="max-w-full text-xs tabular-nums text-muted-foreground mt-0.5 wrap-anywhere">
            {balanceText}
          </span>
        )}
      </div>
    </div>
  )
}
