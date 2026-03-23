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

interface CategoryTreeNode {
  category: Category
  accounts: Account[]
  children: CategoryTreeNode[]
}

function buildPickerTree(
  categories: Category[],
  accounts: Account[],
  parentId: string | null,
  excludeId?: string
): CategoryTreeNode[] {
  return categories
    .filter((c) => c.parentId === parentId && !c.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cat) => {
      const children = buildPickerTree(categories, accounts, cat.id, excludeId)
      const directAccounts = accounts
        .filter((a) => a.categoryId === cat.id && !a.isArchived && a.id !== excludeId)
        .sort((a, b) => {
          const usageDiff = getAccountUsageCount(b.id) - getAccountUsageCount(a.id)
          if (usageDiff !== 0) return usageDiff
          return a.name.localeCompare(b.name)
        })
      return { category: cat, accounts: directAccounts, children }
    })
    .filter((node) => node.accounts.length > 0 || node.children.length > 0)
    .sort((a, b) => {
      const usageDiff = treeUsageCount(b) - treeUsageCount(a)
      if (usageDiff !== 0) return usageDiff
      return a.category.sortOrder - b.category.sortOrder
    })
}

function treeUsageCount(node: CategoryTreeNode): number {
  return node.accounts.reduce((sum, a) => sum + getAccountUsageCount(a.id), 0)
    + node.children.reduce((sum, c) => sum + treeUsageCount(c), 0)
}

/** Collect all category IDs in the ancestor path to a given account */
function findAncestorIds(
  categories: Category[],
  accountCategoryId: string
): string[] {
  const ids: string[] = []
  let currentId: string | null = accountCategoryId
  while (currentId) {
    ids.push(currentId)
    const cat = categories.find((c) => c.id === currentId)
    currentId = cat?.parentId ?? null
  }
  return ids
}

function PickerTreeNode({
  node,
  depth,
  value,
  expanded,
  onToggle,
  onSelect,
}: {
  node: CategoryTreeNode
  depth: number
  value: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (accountId: string) => void
}) {
  const isExpanded = expanded.has(node.category.id)
  const hasContent = node.children.length > 0 || node.accounts.length > 0
  const totalAccounts = countAccounts(node)

  return (
    <div>
      {/* Category header */}
      <button
        type="button"
        className="flex w-full items-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 16 + 12}px`, paddingRight: 12 }}
        onClick={() => hasContent && onToggle(node.category.id)}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {node.category.name}
        <span className="ml-auto text-xs tabular-nums">{totalAccounts}</span>
      </button>

      {isExpanded && (
        <div>
          {/* Mixed: sub-categories and accounts sorted together by usage */}
          {mixedItems(node).map((item) =>
            item.type === "category" ? (
              <PickerTreeNode
                key={item.node.category.id}
                node={item.node}
                depth={depth + 1}
                value={value}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : (
              <button
                key={item.account.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between py-2 text-sm hover:bg-accent",
                  value === item.account.id && "bg-accent"
                )}
                style={{ paddingLeft: `${(depth + 1) * 16 + 12}px`, paddingRight: 12 }}
                onClick={() => onSelect(item.account.id)}
              >
                <span className="truncate">
                  {item.account.name}
                  {item.account.currency !== "CNY" && (
                    <span className="text-muted-foreground ml-1">({item.account.currency})</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatAmount(item.account.balance, item.account.currency)}
                  </span>
                  {value === item.account.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

type MixedItem =
  | { type: "category"; node: CategoryTreeNode; usage: number }
  | { type: "account"; account: Account; usage: number }

/** Merge sub-categories and accounts into one list sorted by usage */
function mixedItems(node: CategoryTreeNode): MixedItem[] {
  const items: MixedItem[] = [
    ...node.children.map((child) => ({
      type: "category" as const,
      node: child,
      usage: treeUsageCount(child),
    })),
    ...node.accounts.map((account) => ({
      type: "account" as const,
      account,
      usage: getAccountUsageCount(account.id),
    })),
  ]
  return items.sort((a, b) => b.usage - a.usage)
}

function countAccounts(node: CategoryTreeNode): number {
  return node.accounts.length + node.children.reduce((sum, c) => sum + countAccounts(c), 0)
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

  const tree = useMemo(
    () => buildPickerTree(categories, accounts, null, excludeId),
    [categories, accounts, excludeId]
  )

  // Auto-expand ancestors of selected account when opening
  useEffect(() => {
    if (open && value) {
      const account = accounts.find((a) => a.id === value)
      if (account) {
        const ancestorIds = findAncestorIds(categories, account.categoryId)
        setExpanded((prev) => {
          const next = new Set(prev)
          for (const id of ancestorIds) next.add(id)
          return next
        })
      }
    }
  }, [open, value, accounts, categories])

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
          {tree.map((node) => (
            <PickerTreeNode
              key={node.category.id}
              node={node}
              depth={0}
              value={value}
              expanded={expanded}
              onToggle={toggleCategory}
              onSelect={handleSelect}
            />
          ))}
          {tree.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              暂无可选账户
            </div>
          )}
        </div>
      )}
    </div>
  )
}
