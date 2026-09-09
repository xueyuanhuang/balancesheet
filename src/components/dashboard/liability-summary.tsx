"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AmountDisplay } from "@/components/shared/amount-display"
import { CategoryTreeItem } from "./category-tree-item"
import type { CategoryTreeNode } from "@/types"

interface LiabilitySummaryProps {
  tree: CategoryTreeNode[]
  total: number
}

export function LiabilitySummary({ tree, total }: LiabilitySummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Liabilities</CardTitle>
          <AmountDisplay cents={total} size="sm" className="text-red-500" />
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
            No liabilities yet
          </div>
        )}
      </CardContent>
    </Card>
  )
}
