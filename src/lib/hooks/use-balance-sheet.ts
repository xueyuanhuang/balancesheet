"use client"

import { useMemo } from "react"
import { useCategories } from "./use-categories"
import { useAccounts } from "./use-accounts"
import { useCategoryTree } from "./use-category-tree"
import { useRateMap } from "./use-exchange-rates"
import { convertToCNY } from "@/lib/utils/currency"
import type { CategoryTreeNode, BalanceSheetData } from "@/types"

function attachBalances(
  nodes: CategoryTreeNode[],
  accountsByCategoryId: Map<string, number>
): CategoryTreeNode[] {
  return nodes.map((node) => {
    const children = attachBalances(node.children, accountsByCategoryId)
    const ownBalance = accountsByCategoryId.get(node.id) ?? 0
    const childrenBalance = children.reduce((sum, c) => sum + c.totalBalance, 0)
    return {
      ...node,
      children,
      totalBalance: ownBalance + childrenBalance,
    }
  })
}

export function useBalanceSheet(): BalanceSheetData {
  const categories = useCategories()
  const accounts = useAccounts()
  const { assetTree, liabilityTree } = useCategoryTree(categories)
  const rateMap = useRateMap()

  return useMemo(() => {
    // Build a map: categoryId -> total balance of non-archived accounts (converted to CNY)
    const balanceMap = new Map<string, number>()
    for (const account of accounts) {
      if (account.isArchived) continue
      const cnyCents = convertToCNY(account.balance, account.currency, rateMap)
      const current = balanceMap.get(account.categoryId) ?? 0
      balanceMap.set(account.categoryId, current + cnyCents)
    }

    const assetTreeWithBalances = attachBalances(
      assetTree.filter((n) => !n.isArchived),
      balanceMap
    ).sort((a, b) => Math.abs(b.totalBalance) - Math.abs(a.totalBalance))
    const liabilityTreeWithBalances = attachBalances(
      liabilityTree.filter((n) => !n.isArchived),
      balanceMap
    ).sort((a, b) => Math.abs(b.totalBalance) - Math.abs(a.totalBalance))

    const totalAssets = assetTreeWithBalances.reduce((sum, n) => sum + n.totalBalance, 0)
    const totalLiabilities = liabilityTreeWithBalances.reduce((sum, n) => sum + n.totalBalance, 0)

    return {
      assetTree: assetTreeWithBalances,
      liabilityTree: liabilityTreeWithBalances,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    }
  }, [accounts, assetTree, liabilityTree, rateMap])
}
