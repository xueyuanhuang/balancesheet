"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { AmountDisplay } from "@/components/shared/amount-display"
import type { CategoryTreeNode } from "@/types"
import { cn } from "@/lib/utils"

interface CategoryTreeItemProps {
  node: CategoryTreeNode
  depth?: number
}

export function CategoryTreeItem({ node, depth = 0 }: CategoryTreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children.length > 0

  // Don't show categories with zero balance and no children with balance
  if (node.totalBalance === 0 && !hasChildren) return null

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 py-1 px-3 rounded-lg text-sm",
          hasChildren && "hover:bg-accent/50 active:bg-accent"
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="flex-1 text-left truncate flex items-center gap-1">
          {node.name}
          {hasChildren && (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )
          )}
        </span>
        <AmountDisplay cents={node.totalBalance} size="sm" />
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children
            .filter((c) => !c.isArchived)
            .sort((a, b) => Math.abs(b.totalBalance) - Math.abs(a.totalBalance))
            .map((child) => (
              <CategoryTreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  )
}
