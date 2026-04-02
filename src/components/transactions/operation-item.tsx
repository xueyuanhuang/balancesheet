"use client"

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
}

export function OperationItem({ data }: OperationItemProps) {
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

  // Secondary text
  let secondaryText = ""
  if (isMultiEntry) {
    const fromName = sourceAccount?.name ?? ""
    const toName = targetAccount?.name ?? ""
    secondaryText = `${fromName} → ${toName}`
  } else {
    secondaryText = sourceAccount?.name ?? ""
  }
  secondaryText += ` · ${formatDateTime(operation.occurredAt)}`

  // Amount display
  const isCrossCurrency = isMultiEntry && sourceEntry && targetEntry &&
    sourceAccount && targetAccount &&
    sourceAccount.currency !== targetAccount.currency
  const hasFee = isMultiEntry && sourceEntry && targetEntry &&
    sourceAccount && targetAccount &&
    !isCrossCurrency && sourceEntry.amount !== targetEntry.amount

  return (
    <Link href={`/transactions/edit?id=${operation.id}`}>
      <div className="flex items-center gap-3 py-3 px-4 hover:bg-accent/50 active:bg-accent rounded-lg">
        <div className={cn("shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-muted", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{primaryText}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {secondaryText}
          </div>
        </div>
        <div className="text-right shrink-0">
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
              <div className="flex flex-col items-end">
                <span className="text-sm tabular-nums text-red-500">
                  {formatAmount(-sourceEntry.amount, sourceAccount!.currency)}
                </span>
                <span className="text-xs tabular-nums text-emerald-600">
                  {operation.kind === "liability_repayment"
                    ? formatAmount(-targetEntry.amount, targetAccount!.currency)
                    : formatAmount(targetEntry.amount, targetAccount!.currency)}
                </span>
              </div>
            ) : (
              <AmountDisplay
                cents={sourceEntry.amount}
                size="sm"
                currency={sourceAccount?.currency}
              />
            )
          ) : null}
        </div>
      </div>
    </Link>
  )
}
