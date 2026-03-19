"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { ChevronDown, ChevronRight, Wallet } from "lucide-react"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { useCategoryTree, flattenTree } from "@/lib/hooks/use-category-tree"
import { useAccountListDrag } from "@/lib/hooks/use-account-list-drag"
import type { DragItemType } from "@/lib/hooks/use-account-list-drag"
import { AccountCard } from "./account-card"
import { AmountDisplay } from "@/components/shared/amount-display"
import { DragOverlay } from "@/components/shared/drag-overlay"
import { DropIndicator } from "@/components/categories/drop-indicator"
import { EmptyState } from "@/components/shared/empty-state"
import { categoryService } from "@/lib/services/category-service"
import { accountService } from "@/lib/services/account-service"
import { convertToCNY, convertFromCNY } from "@/lib/utils/currency"
import { formatAmount } from "@/lib/utils/format"
import { CURRENCIES } from "@/lib/utils/constants"
import { toast } from "sonner"
import type { Account, Category } from "@/types"
import type { CurrencyDisplayMode } from "@/lib/hooks/use-currency-display"
import { cn } from "@/lib/utils"

interface CurrencyBreakdown {
  [currency: string]: number
}

interface CategoryAccountNode {
  category: Category
  accounts: Account[]
  children: CategoryAccountNode[]
  totalBalance: number
  dominantCurrency: string
}

interface AccountGroup {
  name: string
  accounts: Account[]
  totalCNY: number
  dominantCurrency: string
}

const CURRENCY_ORDER: string[] = CURRENCIES.map((c) => c.code)

function pickDominantCurrency(breakdown: CurrencyBreakdown): string {
  let maxVal = -1
  let dominant = "CNY"

  for (const code of CURRENCY_ORDER) {
    const val = breakdown[code] ?? 0
    if (val > maxVal) {
      maxVal = val
      dominant = code
    }
  }

  for (const [code, val] of Object.entries(breakdown)) {
    if (!CURRENCY_ORDER.includes(code) && val > maxVal) {
      maxVal = val
      dominant = code
    }
  }

  return dominant
}

function collectBreakdown(
  directAccounts: Account[],
  children: CategoryAccountNode[],
  rateMap: Record<string, number>
): CurrencyBreakdown {
  const breakdown: CurrencyBreakdown = {}

  for (const a of directAccounts) {
    if (a.isArchived) continue
    const cnyCents = Math.abs(convertToCNY(a.balance, a.currency, rateMap))
    breakdown[a.currency] = (breakdown[a.currency] ?? 0) + cnyCents
  }

  for (const child of children) {
    const childBreakdown = collectBreakdown(child.accounts, child.children, rateMap)
    for (const [code, val] of Object.entries(childBreakdown)) {
      breakdown[code] = (breakdown[code] ?? 0) + val
    }
  }

  return breakdown
}

function buildCategoryAccountTree(
  categories: Category[],
  accounts: Account[],
  parentId: string | null,
  type: "asset" | "liability",
  rateMap: Record<string, number>
): CategoryAccountNode[] {
  return categories
    .filter((c) => c.parentId === parentId && c.type === type && !c.isArchived)
    .map((cat) => {
      const children = buildCategoryAccountTree(categories, accounts, cat.id, type, rateMap)
      const directAccounts = accounts.filter(
        (a) => a.categoryId === cat.id && !a.isArchived
      )
      const directSum = directAccounts.reduce(
        (s, a) => s + convertToCNY(a.balance, a.currency, rateMap),
        0
      )
      const childrenSum = children.reduce((s, c) => s + c.totalBalance, 0)
      const breakdown = collectBreakdown(directAccounts, children, rateMap)
      return {
        category: cat,
        accounts: directAccounts,
        children,
        totalBalance: directSum + childrenSum,
        dominantCurrency: pickDominantCurrency(breakdown),
      }
    })
    .filter((node) => node.totalBalance !== 0 || node.accounts.length > 0 || node.children.length > 0)
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
}

/** Group accounts by name for multi-currency display, preserving sortOrder */
function groupAccountsByName(accounts: Account[], rateMap: Record<string, number>): AccountGroup[] {
  const map = new Map<string, Account[]>()
  const order: string[] = []
  for (const acc of accounts) {
    if (!map.has(acc.name)) {
      map.set(acc.name, [])
      order.push(acc.name)
    }
    map.get(acc.name)!.push(acc)
  }
  return order.map((name) => {
    const accs = map.get(name)!
    const breakdown: CurrencyBreakdown = {}
    for (const a of accs) {
      const cnyCents = Math.abs(convertToCNY(a.balance, a.currency, rateMap))
      breakdown[a.currency] = (breakdown[a.currency] ?? 0) + cnyCents
    }
    return {
      name,
      accounts: accs,
      totalCNY: accs.reduce((s, a) => s + convertToCNY(a.balance, a.currency, rateMap), 0),
      dominantCurrency: pickDominantCurrency(breakdown),
    }
  })
}

function formatDisplayAmount(
  cnyCents: number,
  targetCurrency: string,
  rateMap: Record<string, number>
): string {
  if (targetCurrency === "CNY") {
    return formatAmount(cnyCents, "CNY")
  }
  const converted = convertFromCNY(cnyCents, targetCurrency, rateMap)
  if (converted === null) {
    return formatAmount(cnyCents, "CNY")
  }
  return `≈${formatAmount(converted, targetCurrency)}`
}

// ─── Drag-aware sub-components ──────────────────────────

interface DragProps {
  isDragging: boolean
  dragItemId: string | null
  dragItemType: DragItemType | null
  dropTargetId: string | null
  dropPosition: import("@/lib/hooks/use-account-list-drag").DropPosition | null
  registerNode: (
    id: string,
    type: DragItemType,
    parentId: string | null,
    categoryType: "asset" | "liability",
    depth: number,
    el: HTMLElement | null
  ) => void
  onTouchStart: (
    id: string,
    type: DragItemType,
    label: string,
    badge: string | undefined,
    categoryType: "asset" | "liability",
    e: React.TouchEvent
  ) => void
  onMouseDown: (
    id: string,
    type: DragItemType,
    label: string,
    badge: string | undefined,
    categoryType: "asset" | "liability",
    e: React.MouseEvent
  ) => void
}

function AccountGroupRow({
  group,
  depth,
  displayCurrency,
  rateMap,
  categoryType,
  drag,
}: {
  group: AccountGroup
  depth: number
  displayCurrency: CurrencyDisplayMode
  rateMap: Record<string, number>
  categoryType: "asset" | "liability"
  drag: DragProps
}) {
  const [expanded, setExpanded] = useState(false)

  const targetCurrency = displayCurrency === "auto" ? group.dominantCurrency : displayCurrency
  const displayText = formatDisplayAmount(group.totalCNY, targetCurrency, rateMap)

  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-1 rounded-lg hover:bg-accent/50 active:bg-accent text-sm"
        style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
        onClick={() => !drag.isDragging && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{group.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            ({group.accounts.length}币种)
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm tabular-nums">
            {displayText}
          </span>
        </div>
      </button>
      {expanded && (
        <div>
          {group.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              depth={depth + 1}
              showCNYConversion={false}
              isDragging={drag.isDragging}
              dragItemId={drag.dragItemId}
              dragItemType={drag.dragItemType}
              dropTargetId={drag.dropTargetId}
              dropPosition={drag.dropPosition}
              categoryType={categoryType}
              registerNode={drag.registerNode}
              onTouchStart={drag.onTouchStart}
              onMouseDown={drag.onMouseDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryAccountTreeNode({
  node,
  depth = 0,
  rateMap,
  displayCurrency,
  drag,
  expandedIds,
  onToggleExpand,
}: {
  node: CategoryAccountNode
  depth?: number
  rateMap: Record<string, number>
  displayCurrency: CurrencyDisplayMode
  drag: DragProps
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const expanded = expandedIds.has(node.category.id)
  const nodeRef = useRef<HTMLDivElement>(null)
  const hasContent = node.children.length > 0 || node.accounts.length > 0

  const groups = groupAccountsByName(node.accounts, rateMap)

  const targetCurrency = displayCurrency === "auto" ? node.dominantCurrency : displayCurrency
  const displayText = formatDisplayAmount(node.totalBalance, targetCurrency, rateMap)

  const isBeingDragged = drag.dragItemId === node.category.id
  const isDropTarget = drag.dropTargetId === node.category.id
  const childCount = node.children.length

  // Register this category for hit testing
  useEffect(() => {
    drag.registerNode(node.category.id, "category", node.category.parentId, node.category.type, depth, nodeRef.current)
    return () => drag.registerNode(node.category.id, "category", node.category.parentId, node.category.type, depth, null)
  }, [node.category.id, node.category.parentId, node.category.type, depth, drag])

  return (
    <div>
      {/* Drop-before indicator */}
      {isDropTarget && drag.dropPosition === "drop-before" && drag.dragItemType === "category" && <DropIndicator />}

      <div
        ref={nodeRef}
        className={cn(
          "rounded-lg transition-all",
          isBeingDragged && "opacity-30",
          isDropTarget && drag.dropPosition === "drop-into" && "ring-2 ring-primary bg-primary/5"
        )}
        onTouchStart={(e) => {
          drag.onTouchStart(
            node.category.id,
            "category",
            node.category.name,
            childCount > 0 ? `(+${childCount})` : undefined,
            node.category.type,
            e
          )
        }}
        onMouseDown={(e) => {
          drag.onMouseDown(
            node.category.id,
            "category",
            node.category.name,
            childCount > 0 ? `(+${childCount})` : undefined,
            node.category.type,
            e
          )
        }}
      >
        <button
          className={cn(
            "flex w-full items-center gap-2 py-1 rounded-lg text-sm",
            hasContent && !drag.isDragging && "hover:bg-accent/50 active:bg-accent"
          )}
          style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
          onClick={() => {
            if (drag.isDragging) return
            if (hasContent) onToggleExpand(node.category.id)
          }}
        >
          <span className="flex-1 text-left font-medium truncate flex items-center gap-1">
            {node.category.name}
            {hasContent && (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )
            )}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground shrink-0">
            {displayText}
          </span>
        </button>
      </div>

      {/* Drop-after indicator (before children) */}
      {isDropTarget && drag.dropPosition === "drop-after" && !hasContent && drag.dragItemType === "category" && <DropIndicator />}

      {expanded && (
        <div>
          {node.children.map((child) => (
            <CategoryAccountTreeNode
              key={child.category.id}
              node={child}
              depth={depth + 1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
              drag={drag}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {groups.map((group) =>
            group.accounts.length === 1 ? (
              <AccountCard
                key={group.accounts[0].id}
                account={group.accounts[0]}
                depth={depth + 1}
                showCNYConversion={false}
                isDragging={drag.isDragging}
                dragItemId={drag.dragItemId}
                dragItemType={drag.dragItemType}
                dropTargetId={drag.dropTargetId}
                dropPosition={drag.dropPosition}
                categoryType={node.category.type}
                registerNode={drag.registerNode}
                onTouchStart={drag.onTouchStart}
                onMouseDown={drag.onMouseDown}
              />
            ) : (
              <AccountGroupRow
                key={group.name}
                group={group}
                depth={depth + 1}
                displayCurrency={displayCurrency}
                rateMap={rateMap}
                categoryType={node.category.type}
                drag={drag}
              />
            )
          )}
        </div>
      )}

      {/* Drop-after indicator (after expanded children) */}
      {isDropTarget && drag.dropPosition === "drop-after" && hasContent && expanded && drag.dragItemType === "category" && <DropIndicator />}
    </div>
  )
}

const EXPANDED_STORAGE_KEY = "accountListExpandedCategories"

export function AccountList({ displayCurrency = "auto" }: { displayCurrency?: CurrencyDisplayMode }) {
  const accounts = useAccounts()
  const categories = useCategories()
  const rateMap = useRateMap()
  const { assetTree, liabilityTree } = useCategoryTree(categories)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  const allCategoryNodes = useMemo(
    () => [...flattenTree(assetTree), ...flattenTree(liabilityTree)],
    [assetTree, liabilityTree]
  )
  const allTreeNodes = useMemo(
    () => [...assetTree, ...liabilityTree],
    [assetTree, liabilityTree]
  )

  const handleMoveCategory = useCallback(async (
    categoryId: string,
    targetParentId: string | null,
    sortIndex: number | null
  ) => {
    try {
      await categoryService.moveCategory(categoryId, targetParentId, sortIndex)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移动分类失败")
    }
  }, [])

  const handleMoveAccount = useCallback(async (
    accountId: string,
    targetCategoryId: string,
    sortIndex: number | null
  ) => {
    try {
      await accountService.moveAccount(accountId, targetCategoryId, sortIndex)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移动账户失败")
    }
  }, [])

  const { state, handleTouchStart, handleMouseDown, registerNode, registerRootDropZone } = useAccountListDrag({
    nodes: allTreeNodes,
    allCategories: allCategoryNodes,
    onMoveCategory: handleMoveCategory,
    onMoveAccount: handleMoveAccount,
  })

  const drag: DragProps = {
    isDragging: state.isDragging,
    dragItemId: state.dragId,
    dragItemType: state.dragType,
    dropTargetId: state.dropTargetId,
    dropPosition: state.dropPosition,
    registerNode,
    onTouchStart: handleTouchStart,
    onMouseDown: handleMouseDown,
  }

  const activeAccounts = accounts.filter((a) => !a.isArchived)

  if (activeAccounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="暂无账户"
        description="创建你的第一个账户开始记录资产和负债"
        actionLabel="创建账户"
        actionHref="/accounts/new"
      />
    )
  }

  const assetAccountTree = buildCategoryAccountTree(categories, accounts, null, "asset", rateMap)
  const liabilityAccountTree = buildCategoryAccountTree(categories, accounts, null, "liability", rateMap)

  const totalAssets = assetAccountTree.reduce((s, n) => s + n.totalBalance, 0)
  const totalLiabilities = liabilityAccountTree.reduce((s, n) => s + n.totalBalance, 0)

  return (
    <div className="space-y-4">
      {assetAccountTree.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-sm font-semibold">资产</h2>
            <AmountDisplay cents={totalAssets} size="sm" className="text-emerald-600" />
          </div>
          {assetAccountTree.map((node) => (
            <CategoryAccountTreeNode
              key={node.category.id}
              node={node}
              depth={1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
              drag={drag}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </section>
      )}
      {liabilityAccountTree.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-sm font-semibold">负债</h2>
            <AmountDisplay cents={totalLiabilities} size="sm" className="text-red-500" />
          </div>
          {liabilityAccountTree.map((node) => (
            <CategoryAccountTreeNode
              key={node.category.id}
              node={node}
              depth={1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
              drag={drag}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </section>
      )}

      {/* Root drop zone — only for category drag */}
      <div
        ref={registerRootDropZone}
        className={cn(
          "mt-2 py-4 border-2 border-dashed rounded-lg text-center text-xs transition-all mx-4",
          state.isDragging && state.dragType === "category"
            ? "opacity-100 border-muted-foreground/40 text-muted-foreground"
            : "opacity-0 h-0 py-0 mt-0 overflow-hidden border-transparent",
          state.dropPosition === "drop-root" && "border-primary bg-primary/5 text-primary"
        )}
      >
        拖拽到此处移为顶级分类
      </div>

      {/* Drag overlay */}
      {state.isDragging && state.dragLabel && state.overlayPos && (
        <DragOverlay
          label={state.dragLabel}
          badge={state.dragBadge}
          position={state.overlayPos}
        />
      )}
    </div>
  )
}
