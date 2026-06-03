"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { ChevronDown, ChevronRight, Check } from "lucide-react"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { formatAmount } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { Account, Category } from "@/types"

type AccountPickerSortMode =
  | "recentAny"
  | "recentExpense"
  | "recentIncome"
  | "recentTransferSource"
  | "recentTransferTarget"
  | "recentAdjustment"
const EMPTY_SORT_VALUES: Record<string, number> = {}

interface AccountPickerProps {
  value: string | null
  onChange: (accountId: string) => void
  label?: string
  excludeId?: string
  sortMode?: AccountPickerSortMode
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
  excludeId: string | undefined,
  sortMode: AccountPickerSortMode,
  sortValues: Record<string, number>
): CategoryTreeNode[] {
  return categories
    .filter((c) => c.parentId === parentId && !c.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cat) => {
      const children = buildPickerTree(categories, accounts, cat.id, excludeId, sortMode, sortValues)
      const directAccounts = accounts
        .filter((a) => a.categoryId === cat.id && !a.isArchived && a.id !== excludeId)
        .sort((a, b) => {
          const sortDiff = getAccountSortValue(b.id, sortValues) - getAccountSortValue(a.id, sortValues)
          if (sortDiff !== 0) return sortDiff
          return a.name.localeCompare(b.name)
        })
      return { category: cat, accounts: directAccounts, children }
    })
    .filter((node) => node.accounts.length > 0 || node.children.length > 0)
    .sort((a, b) => {
      const sortDiff = treeSortValue(b, sortValues) - treeSortValue(a, sortValues)
      if (sortDiff !== 0) return sortDiff
      return a.category.sortOrder - b.category.sortOrder
    })
}

function getAccountSortValue(
  accountId: string,
  sortValues: Record<string, number>
): number {
  return sortValues[accountId] ?? 0
}

function treeSortValue(
  node: CategoryTreeNode,
  sortValues: Record<string, number>
): number {
  const accountValues = node.accounts.map((a) => getAccountSortValue(a.id, sortValues))
  const childValues = node.children.map((c) => treeSortValue(c, sortValues))

  return Math.max(0, ...accountValues, ...childValues)
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
  sortMode,
  sortValues,
  onToggle,
  onSelect,
}: {
  node: CategoryTreeNode
  depth: number
  value: string | null
  expanded: Set<string>
  sortMode: AccountPickerSortMode
  sortValues: Record<string, number>
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
          {/* Mixed: sub-categories and accounts sorted together by picker mode */}
          {mixedItems(node, sortMode, sortValues).map((item) =>
            item.type === "category" ? (
              <PickerTreeNode
                key={item.node.category.id}
                node={item.node}
                depth={depth + 1}
                value={value}
                expanded={expanded}
                sortMode={sortMode}
                sortValues={sortValues}
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
  | { type: "category"; node: CategoryTreeNode; sortValue: number }
  | { type: "account"; account: Account; sortValue: number }

/** Merge sub-categories and accounts into one list sorted by the picker mode */
function mixedItems(
  node: CategoryTreeNode,
  sortMode: AccountPickerSortMode,
  sortValues: Record<string, number>
): MixedItem[] {
  const items: MixedItem[] = [
    ...node.children.map((child) => ({
      type: "category" as const,
      node: child,
      sortValue: treeSortValue(child, sortValues),
    })),
    ...node.accounts.map((account) => ({
      type: "account" as const,
      account,
      sortValue: getAccountSortValue(account.id, sortValues),
    })),
  ]
  return items.sort((a, b) => {
    const sortDiff = b.sortValue - a.sortValue
    if (sortDiff !== 0) return sortDiff

    if (a.type === "category" && b.type === "category") {
      return a.node.category.sortOrder - b.node.category.sortOrder
    }
    if (a.type === "account" && b.type === "account") {
      return a.account.name.localeCompare(b.account.name)
    }
    return a.type === "category" ? -1 : 1
  })
}

function countAccounts(node: CategoryTreeNode): number {
  return node.accounts.length + node.children.reduce((sum, c) => sum + countAccounts(c), 0)
}

function useRecentAccountSortValues(sortMode: AccountPickerSortMode) {
  return useLiveQuery(
    async (): Promise<Record<string, number>> => {
      const [accounts, categories, operations, entries] = await Promise.all([
        db.accounts.toArray(),
        db.categories.toArray(),
        db.operations.toArray(),
        db.entries.toArray(),
      ])

      const categoryTypeById = new Map(categories.map((category) => [category.id, category.type]))
      const accountTypeById = new Map(
        accounts.map((account) => [account.id, categoryTypeById.get(account.categoryId)])
      )
      const operationById = new Map(operations.map((operation) => [operation.id, operation]))
      const latestByAccount: Record<string, number> = {}

      for (const entry of entries) {
        const operation = operationById.get(entry.operationId)
        if (!operation) continue

        const accountType = accountTypeById.get(entry.accountId)
        const isUserFacingExpense =
          (accountType === "asset" && entry.effect === "decrease") ||
          (accountType === "liability" && entry.effect === "increase")
        const isUserFacingIncome =
          (accountType === "asset" && entry.effect === "increase") ||
          (accountType === "liability" && entry.effect === "decrease")

        const matchesSortMode =
          sortMode === "recentAny" ||
          (sortMode === "recentExpense" && operation.kind === "normal" && isUserFacingExpense) ||
          (sortMode === "recentIncome" && operation.kind === "normal" && isUserFacingIncome) ||
          (sortMode === "recentTransferSource" &&
            operation.kind !== "normal" &&
            operation.kind !== "adjustment" &&
            entry.role === "source") ||
          (sortMode === "recentTransferTarget" &&
            operation.kind !== "normal" &&
            operation.kind !== "adjustment" &&
            entry.role === "target") ||
          (sortMode === "recentAdjustment" && operation.kind === "adjustment")

        if (!matchesSortMode) continue

        latestByAccount[entry.accountId] = Math.max(
          latestByAccount[entry.accountId] ?? 0,
          operation.occurredAt
        )
      }

      return latestByAccount
    },
    [sortMode],
    {} as Record<string, number>
  )
}

export function AccountPicker({
  value,
  onChange,
  label = "选择账户",
  excludeId,
  sortMode = "recentAny",
}: AccountPickerProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const accounts = useAccounts()
  const categories = useCategories()
  const recentSortValues = useRecentAccountSortValues(sortMode)
  const sortValues = recentSortValues ?? EMPTY_SORT_VALUES
  const selectedAccount = accounts.find((a) => a.id === value)

  const displayText = selectedAccount
    ? selectedAccount.currency !== "CNY"
      ? `${selectedAccount.name} (${selectedAccount.currency})`
      : selectedAccount.name
    : null

  const tree = useMemo(
    () => buildPickerTree(categories, accounts, null, excludeId, sortMode, sortValues),
    [categories, accounts, excludeId, sortMode, sortValues]
  )

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

  const expandSelectedAncestors = () => {
    if (!value) return

    const account = accounts.find((a) => a.id === value)
    if (!account) return

    const ancestorIds = findAncestorIds(categories, account.categoryId)
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of ancestorIds) next.add(id)
      return next
    })
  }

  const handleTriggerClick = () => {
    if (!open) {
      expandSelectedAncestors()
    }
    setOpen((prev) => !prev)
  }

  const handleSelect = (accountId: string) => {
    onChange(accountId)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleTriggerClick}
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
              sortMode={sortMode}
              sortValues={sortValues}
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
