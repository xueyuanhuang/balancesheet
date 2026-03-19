"use client"

import { useCallback, useMemo } from "react"
import { CategoryNode } from "./category-node"
import { DragOverlay } from "@/components/shared/drag-overlay"
import { useCategoryDrag } from "@/lib/hooks/use-category-drag"
import { flattenTree } from "@/lib/hooks/use-category-tree"
import { categoryService } from "@/lib/services/category-service"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CategoryTreeNode } from "@/types"

interface CategoryTreeProps {
  nodes: CategoryTreeNode[]
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

export function CategoryTree({ nodes, onArchive, onDelete }: CategoryTreeProps) {
  const allCategories = useMemo(() => flattenTree(nodes), [nodes])

  const handleMove = useCallback(async (
    categoryId: string,
    targetParentId: string | null,
    sortIndex: number | null
  ) => {
    try {
      await categoryService.moveCategory(categoryId, targetParentId, sortIndex)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移动失败")
    }
  }, [])

  const { state, handleTouchStart, handleMouseDown, registerNode, registerRootDropZone } = useCategoryDrag({
    nodes,
    allCategories,
    onMove: handleMove,
  })

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
          isDragging={state.isDragging}
          dragId={state.dragId}
          dropTargetId={state.dropTargetId}
          dropPosition={state.dropPosition}
          registerNode={registerNode}
          onTouchStart={handleTouchStart}
          onMouseDown={handleMouseDown}
        />
      ))}

      {/* Root drop zone — visible only during drag */}
      <div
        ref={registerRootDropZone}
        className={cn(
          "mt-2 py-4 border-2 border-dashed rounded-lg text-center text-xs transition-all",
          state.isDragging
            ? "opacity-100 border-muted-foreground/40 text-muted-foreground"
            : "opacity-0 h-0 py-0 mt-0 overflow-hidden border-transparent",
          state.dropPosition === "drop-root" && "border-primary bg-primary/5 text-primary"
        )}
      >
        拖拽到此处移为顶级分类
      </div>

      {/* Drag overlay portal */}
      {state.isDragging && state.dragNode && state.overlayPos && (
        <DragOverlay
          label={state.dragNode.name}
          badge={state.dragNode.children.length > 0 ? `(+${state.dragNode.children.length})` : undefined}
          position={state.overlayPos}
        />
      )}
    </div>
  )
}
