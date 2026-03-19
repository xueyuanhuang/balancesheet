"use client"

import { useMemo } from "react"
import type { Category, CategoryTreeNode } from "@/types"

function buildTree(
  categories: Category[],
  parentId: string | null = null
): CategoryTreeNode[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      ...c,
      children: buildTree(categories, c.id),
      totalBalance: 0, // Will be populated by useBalanceSheet
    }))
}

export function useCategoryTree(categories: Category[]) {
  const assetTree = useMemo(
    () => buildTree(categories.filter((c) => c.type === "asset")),
    [categories]
  )

  const liabilityTree = useMemo(
    () => buildTree(categories.filter((c) => c.type === "liability")),
    [categories]
  )

  return { assetTree, liabilityTree }
}

export function flattenTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}
