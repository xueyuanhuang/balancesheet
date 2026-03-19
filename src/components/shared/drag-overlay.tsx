"use client"

import { createPortal } from "react-dom"

interface DragOverlayProps {
  label: string
  badge?: string
  position: { x: number; y: number }
}

export function DragOverlay({ label, badge, position }: DragOverlayProps) {
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
        {label}
        {badge && (
          <span className="text-muted-foreground ml-1">{badge}</span>
        )}
      </span>
    </div>,
    document.body
  )
}
