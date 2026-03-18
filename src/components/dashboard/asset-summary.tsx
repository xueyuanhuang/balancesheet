"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AmountDisplay } from "@/components/shared/amount-display"
import { CategoryTreeItem } from "./category-tree-item"
import type { CategoryTreeNode } from "@/types"

interface AssetSummaryProps {
  tree: CategoryTreeNode[]
  total: number
}

export function AssetSummary({ tree, total }: AssetSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">资产</CardTitle>
          <AmountDisplay cents={total} size="sm" className="text-emerald-600" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tree.length > 0 ? (
          <div className="-mx-3">
            {tree.map((node) => (
              <CategoryTreeItem key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            暂无资产
          </div>
        )}
      </CardContent>
    </Card>
  )
}
