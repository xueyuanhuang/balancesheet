export type CategoryType = "asset" | "liability"

export type OperationKind = "normal" | "transfer" | "fx_transfer" | "liability_repayment" | "liability_drawdown" | "adjustment"
export type EntryEffect = "increase" | "decrease"
export type EntryRole = "source" | "target"

export interface Category {
  id: string
  name: string
  type: CategoryType
  parentId: string | null
  sortOrder: number
  isArchived: boolean
  usageCount?: number
  createdAt: number
  updatedAt: number
}

export interface Account {
  id: string
  name: string
  categoryId: string
  openingBalance: number // cents
  balance: number // cached, cents
  currency: string
  note: string
  isArchived: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Operation {
  id: string
  kind: OperationKind
  description: string
  occurredAt: number
  fxRate: number | null
  fxBaseCurrency: string | null
  fxQuoteCurrency: string | null
  createdAt: number
  updatedAt: number
}

export interface Entry {
  id: string
  operationId: string
  accountId: string
  role: EntryRole
  effect: EntryEffect
  amount: number // positive integer, cents
  createdAt: number
  updatedAt: number
}

export interface ExchangeRate {
  currency: string
  rateToCNY: number
  updatedAt: number
}

export interface OperationWithEntries {
  operation: Operation
  entries: Entry[]
}

// Tree node for category hierarchy
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
  totalBalance: number // sum of all accounts under this category tree, cents (converted to CNY)
}

// Net worth snapshot (recorded when user opens dashboard)
export interface NetWorthSnapshot {
  date: string        // "YYYY-MM-DD HH:00" local datetime, primary key
  // v2: per-currency native cents
  assets?: Record<string, number>
  liabilities?: Record<string, number>
  // v1 legacy: pre-computed CNY cents
  netWorth?: number
  totalAssets?: number
  totalLiabilities?: number
  createdAt: number
}

// Balance sheet summary
export interface BalanceSheetData {
  assetTree: CategoryTreeNode[]
  liabilityTree: CategoryTreeNode[]
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}
