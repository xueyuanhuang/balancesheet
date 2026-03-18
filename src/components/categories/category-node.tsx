"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, ChevronDown, Archive, ArchiveRestore, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CategoryTreeNode } from "@/types"

interface CategoryNodeProps {
  node: CategoryTreeNode
  depth?: number
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

export function CategoryNode({ node, depth = 0, onArchive, onDelete }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2.5 px-3 rounded-lg active:bg-accent",
          node.isArchived && "opacity-50"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Name + Expand/Collapse arrow (arrow right after name) */}
        <button
          className="flex-1 text-left text-sm min-h-[44px] flex items-center gap-1"
          onClick={() => hasChildren ? setExpanded(!expanded) : setShowActions(!showActions)}
        >
          <span className="truncate">{node.name}</span>
          {hasChildren && (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )
          )}
        </button>

        {/* Toggle actions button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setShowActions(!showActions)}
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Action bar — shown on tap */}
      {showActions && (
        <div
          className="flex items-center gap-1 py-1 px-3 bg-muted/50 rounded-lg mx-2 mb-1"
          style={{ marginLeft: `${depth * 20 + 16}px` }}
        >
          <Link href={`/categories/${node.id}/edit`} className="flex-1">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9">
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
          </Link>
          {onArchive && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 h-9"
              onClick={() => { onArchive(node.id); setShowActions(false) }}
            >
              {node.isArchived ? (
                <><ArchiveRestore className="h-3.5 w-3.5" />恢复</>
              ) : (
                <><Archive className="h-3.5 w-3.5" />归档</>
              )}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 h-9 text-destructive hover:text-destructive"
              onClick={() => { onDelete(node.id); setShowActions(false) }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
