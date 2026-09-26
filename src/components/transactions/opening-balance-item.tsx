"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"
import { AmountDisplay } from "@/components/shared/amount-display"
import { formatAmount, formatDateTime } from "@/lib/utils/format"
import { useCategory } from "@/lib/hooks/use-categories"
import { getOpeningBalanceType } from "@/lib/utils/opening-balance"
import type { Account } from "@/types"

export function OpeningBalanceItem({ account, transferOperationId }: { account: Account; transferOperationId?: string }) {
  const category = useCategory(account.categoryId)
  const type = category ? getOpeningBalanceType(account.openingBalance, category.type) : undefined
  const displayAmount = type === "expense" ? -Math.abs(account.openingBalance) : Math.abs(account.openingBalance)

  return (
    <div className="relative isolate flex items-center gap-3 py-3 px-4 hover:bg-accent/50 active:bg-accent rounded-lg">
      <Link
        href={transferOperationId
          ? `/transactions/edit?id=${encodeURIComponent(transferOperationId)}`
          : `/transactions/edit?openingAccountId=${encodeURIComponent(account.id)}`}
        aria-label={`Edit opening balance: ${account.name}, ${formatAmount(account.openingBalance, account.currency)}, ${formatDateTime(account.createdAt)}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
        <Wallet className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">Account opened</div>
        <div className="flex items-center min-w-0 text-xs text-muted-foreground mt-0.5">
          <Link
            href={`/accounts/detail?id=${encodeURIComponent(account.id)}`}
            aria-label={`View account: ${account.name}`}
            title={account.name}
            className="relative z-10 min-h-0 min-w-0 truncate underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {account.name}
          </Link>
          <span className="ml-1 truncate" title={formatDateTime(account.createdAt)}>
            · {formatDateTime(account.createdAt)}
          </span>
        </div>
      </div>
      <div className="min-w-0 max-w-[50%] shrink-0 text-right">
        <AmountDisplay cents={displayAmount} currency={account.currency} size="sm" colorize={!!type} />
        <div className="text-xs text-muted-foreground mt-0.5">
          {type === "income" ? "Opening income" : type === "expense" ? "Opening expense" : "Opening balance"}
        </div>
      </div>
    </div>
  )
}
