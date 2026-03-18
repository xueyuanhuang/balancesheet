"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Wallet } from "lucide-react"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { AccountCard } from "./account-card"
import { AmountDisplay } from "@/components/shared/amount-display"
import { EmptyState } from "@/components/shared/empty-state"
import { convertToCNY, convertFromCNY } from "@/lib/utils/currency"
import { formatAmount } from "@/lib/utils/format"
import { CURRENCIES } from "@/lib/utils/constants"
import type { Account, Category } from "@/types"
import type { CurrencyDisplayMode } from "@/lib/hooks/use-currency-display"
import { cn } from "@/lib/utils"

interface CurrencyBreakdown {
  [currency: string]: number // currency -> abs(CNY equivalent cents)
}

interface CategoryAccountNode {
  category: Category
  accounts: Account[]
  children: CategoryAccountNode[]
  totalBalance: number // CNY cents
  dominantCurrency: string
}

interface AccountGroup {
  name: string
  accounts: Account[]
  totalCNY: number
  dominantCurrency: string
}

const CURRENCY_ORDER: string[] = CURRENCIES.map((c) => c.code)

/** Compute dominant currency from a currency breakdown map */
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

  // Handle currencies not in CURRENCY_ORDER
  for (const [code, val] of Object.entries(breakdown)) {
    if (!CURRENCY_ORDER.includes(code) && val > maxVal) {
      maxVal = val
      dominant = code
    }
  }

  return dominant
}

/** Collect currency breakdown from direct accounts and children recursively */
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

  // Merge children's breakdowns by re-collecting from their accounts recursively
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
    .sort((a, b) => Math.abs(b.totalBalance) - Math.abs(a.totalBalance))
}

/** Group accounts by name for multi-currency display */
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
  return order
    .map((name) => {
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
    .sort((a, b) => Math.abs(b.totalCNY) - Math.abs(a.totalCNY))
}

/** Format amount with optional ≈ prefix for non-CNY display */
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
    // Fallback to CNY when rate is missing
    return formatAmount(cnyCents, "CNY")
  }
  return `≈${formatAmount(converted, targetCurrency)}`
}

/** Renders a group of same-name, multi-currency accounts */
function AccountGroupRow({
  group,
  depth,
  displayCurrency,
  rateMap,
}: {
  group: AccountGroup
  depth: number
  displayCurrency: CurrencyDisplayMode
  rateMap: Record<string, number>
}) {
  const [expanded, setExpanded] = useState(false)

  const targetCurrency = displayCurrency === "auto" ? group.dominantCurrency : displayCurrency
  const displayText = formatDisplayAmount(group.totalCNY, targetCurrency, rateMap)

  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-1 rounded-lg hover:bg-accent/50 active:bg-accent text-sm"
        style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
        onClick={() => setExpanded(!expanded)}
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
            <AccountCard key={account.id} account={account} depth={depth + 1} showCNYConversion={false} />
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
}: {
  node: CategoryAccountNode
  depth?: number
  rateMap: Record<string, number>
  displayCurrency: CurrencyDisplayMode
}) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = node.children.length > 0 || node.accounts.length > 0

  const groups = groupAccountsByName(node.accounts, rateMap)

  const targetCurrency = displayCurrency === "auto" ? node.dominantCurrency : displayCurrency
  const displayText = formatDisplayAmount(node.totalBalance, targetCurrency, rateMap)

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 py-1 rounded-lg text-sm",
          hasContent && "hover:bg-accent/50 active:bg-accent"
        )}
        style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
        onClick={() => hasContent && setExpanded(!expanded)}
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

      {expanded && (
        <div>
          {node.children.map((child) => (
            <CategoryAccountTreeNode
              key={child.category.id}
              node={child}
              depth={depth + 1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
            />
          ))}
          {groups.map((group) =>
            group.accounts.length === 1 ? (
              <AccountCard key={group.accounts[0].id} account={group.accounts[0]} depth={depth + 1} showCNYConversion={false} />
            ) : (
              <AccountGroupRow key={group.name} group={group} depth={depth + 1} displayCurrency={displayCurrency} rateMap={rateMap} />
            )
          )}
        </div>
      )}
    </div>
  )
}

export function AccountList({ displayCurrency = "auto" }: { displayCurrency?: CurrencyDisplayMode }) {
  const accounts = useAccounts()
  const categories = useCategories()
  const rateMap = useRateMap()

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

  const assetTree = buildCategoryAccountTree(categories, accounts, null, "asset", rateMap)
  const liabilityTree = buildCategoryAccountTree(categories, accounts, null, "liability", rateMap)

  const totalAssets = assetTree.reduce((s, n) => s + n.totalBalance, 0)
  const totalLiabilities = liabilityTree.reduce((s, n) => s + n.totalBalance, 0)

  return (
    <div className="space-y-4">
      {assetTree.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-sm font-semibold">资产</h2>
            <AmountDisplay cents={totalAssets} size="sm" className="text-emerald-600" />
          </div>
          {assetTree.map((node) => (
            <CategoryAccountTreeNode
              key={node.category.id}
              node={node}
              depth={1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
            />
          ))}
        </section>
      )}
      {liabilityTree.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-sm font-semibold">负债</h2>
            <AmountDisplay cents={totalLiabilities} size="sm" className="text-red-500" />
          </div>
          {liabilityTree.map((node) => (
            <CategoryAccountTreeNode
              key={node.category.id}
              node={node}
              depth={1}
              rateMap={rateMap}
              displayCurrency={displayCurrency}
            />
          ))}
        </section>
      )}
    </div>
  )
}
