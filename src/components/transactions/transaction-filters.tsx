"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import type { ActivityKind } from "@/types"

interface TransactionFiltersProps {
  keyword: string
  onKeywordChange: (keyword: string) => void
  kindFilter: ActivityKind | undefined
  onKindFilterChange: (kind: ActivityKind | undefined) => void
}

export function TransactionFilters({
  keyword,
  onKeywordChange,
  kindFilter,
  onKindFilterChange,
}: TransactionFiltersProps) {
  return (
    <div className="space-y-3 px-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Search activity..."
          className="pl-9 pr-8"
        />
        {keyword && (
          <button
            onClick={() => onKeywordChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Kind filter */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: undefined, label: "All" },
          { value: "normal" as const, label: "General" },
          { value: "transfer" as const, label: "Transfer" },
          { value: "fx_transfer" as const, label: "FX" },
          { value: "liability_repayment" as const, label: "Repayment" },
          { value: "liability_drawdown" as const, label: "Borrowing" },
          { value: "adjustment" as const, label: "Adjustment" },
          { value: "opening_balance" as const, label: "Opening balance" },
        ] as const).map((opt) => (
          <Button
            key={opt.label}
            variant={kindFilter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => onKindFilterChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
