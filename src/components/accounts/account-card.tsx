"use client"

import Link from "next/link"
import { AmountDisplay } from "@/components/shared/amount-display"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { convertToCNY } from "@/lib/utils/currency"
import { formatAmount } from "@/lib/utils/format"
import type { Account } from "@/types"
import { cn } from "@/lib/utils"

interface AccountCardProps {
  account: Account
  depth?: number
  showCNYConversion?: boolean
}

export function AccountCard({ account, depth = 0, showCNYConversion = true }: AccountCardProps) {
  const rateMap = useRateMap()
  const isForeign = account.currency !== "CNY"
  const cnyCents = isForeign && showCNYConversion ? convertToCNY(account.balance, account.currency, rateMap) : null

  return (
    <Link href={`/accounts/${account.id}`}>
      <div
        className={cn(
          "flex items-center justify-between py-1 rounded-lg hover:bg-accent/50 active:bg-accent",
          account.isArchived && "opacity-50"
        )}
        style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
      >
        <div className="text-sm truncate">{account.name}</div>
        <div className="text-right shrink-0">
          <AmountDisplay cents={account.balance} size="sm" currency={account.currency} />
          {isForeign && cnyCents !== null && (
            <div className="text-xs text-muted-foreground">
              ≈{formatAmount(cnyCents)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
