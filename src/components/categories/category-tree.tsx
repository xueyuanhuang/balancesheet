"use client"

import { CategoryNode } from "./category-node"
import type { CategoryTreeNode } from "@/types"

interface CategoryTreeProps {
  nodes: CategoryTreeNode[]
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

export function CategoryTree({ nodes, onArchive, onDelete }: CategoryTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无分类
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <CategoryNode
          key={node.id}
          node={node}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
