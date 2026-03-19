"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { ChevronDown, ChevronRight, Check } from "lucide-react"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { formatAmount } from "@/lib/utils/format"
import { recordAccountUsage, getAccountUsageCount } from "@/lib/utils/account-usage"
import { cn } from "@/lib/utils"
import type { Account, Category } from "@/types"

interface AccountPickerProps {
  value: string | null
  onChange: (accountId: string) => void
  label?: string
  excludeId?: string
}

interface CategoryAccountGroup {
  category: Category
  accounts: Account[]
}

export function AccountPicker({ value, onChange, label = "选择账户", excludeId }: AccountPickerProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const accounts = useAccounts()
  const categories = useCategories()
  const selectedAccount = accounts.find((a) => a.id === value)

  const displayText = selectedAccount
    ? selectedAccount.currency !== "CNY"
      ? `${selectedAccount.name} (${selectedAccount.currency})`
      : selectedAccount.name
    : null

  const grouped = useMemo(() => {
    return categories
      .map((cat) => {
        const catAccounts = accounts
          .filter((a) => a.categoryId === cat.id && !a.isArchived && a.id !== excludeId)
          .sort((a, b) => {
            const usageDiff = getAccountUsageCount(b.id) - getAccountUsageCount(a.id)
            if (usageDiff !== 0) return usageDiff
            return a.name.localeCompare(b.name)
          })
        if (catAccounts.length === 0) return null
        return { category: cat, accounts: catAccounts } as CategoryAccountGroup
      })
      .filter((g): g is CategoryAccountGroup => g !== null)
      .sort((a, b) => {
        // Sum usage counts for all accounts in each category
        const usageA = a.accounts.reduce((sum, acc) => sum + getAccountUsageCount(acc.id), 0)
        const usageB = b.accounts.reduce((sum, acc) => sum + getAccountUsageCount(acc.id), 0)
        if (usageA !== usageB) return usageB - usageA // higher usage first
        return a.category.name.localeCompare(b.category.name) // then alphabetical
      })
  }, [categories, accounts, excludeId])

  // Auto-expand the category containing the selected account
  useEffect(() => {
    if (open && value) {
      for (const g of grouped) {
        if (g.accounts.some((a) => a.id === value)) {
          setExpanded((prev) => new Set(prev).add(g.category.id))
        }
      }
    }
  }, [open, value, grouped])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const toggleCategory = (catId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const handleSelect = (accountId: string) => {
    recordAccountUsage(accountId)
    onChange(accountId)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className={cn("truncate", !displayText && "text-muted-foreground")}>
          {displayText ?? label}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {grouped.map(({ category, accounts: accts }) => {
            const isExpanded = expanded.has(category.id)
            return (
              <div key={category.id}>
                {/* Category header */}
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50"
                  onClick={() => toggleCategory(category.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {category.name}
                  <span className="ml-auto text-xs tabular-nums">{accts.length}</span>
                </button>

                {/* Accounts */}
                {isExpanded && accts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 pl-8 text-sm hover:bg-accent",
                      value === account.id && "bg-accent"
                    )}
                    onClick={() => handleSelect(account.id)}
                  >
                    <span className="truncate">
                      {account.name}
                      {account.currency !== "CNY" && (
                        <span className="text-muted-foreground ml-1">({account.currency})</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatAmount(account.balance, account.currency)}
                      </span>
                      {value === account.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
          {grouped.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              暂无可选账户
            </div>
          )}
        </div>
      )}
    </div>
  )
}
