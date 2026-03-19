"use client"

import { createPortal } from "react-dom"
import type { CategoryTreeNode } from "@/types"

interface DragOverlayProps {
  node: CategoryTreeNode
  position: { x: number; y: number }
}

export function DragOverlay({ node, position }: DragOverlayProps) {
  const childCount = node.children.length

  return createPortal(
    <div
      className="fixed z-50 pointer-events-none px-4 py-2.5 bg-background border rounded-lg shadow-xl"
      style={{
        left: position.x - 40,
        top: position.y - 24,
        opacity: 0.9,
        transform: "rotate(2deg)",
      }}
    >
      <span className="text-sm font-medium">
        {node.name}
        {childCount > 0 && (
          <span className="text-muted-foreground ml-1">(+{childCount})</span>
        )}
      </span>
    </div>,
    document.body
  )
}
