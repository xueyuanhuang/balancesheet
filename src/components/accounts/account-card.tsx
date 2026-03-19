"use client"

import { useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AmountDisplay } from "@/components/shared/amount-display"
import { DropIndicator } from "@/components/categories/drop-indicator"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { convertToCNY } from "@/lib/utils/currency"
import { formatAmount } from "@/lib/utils/format"
import type { Account } from "@/types"
import type { DropPosition, DragItemType } from "@/lib/hooks/use-account-list-drag"
import { cn } from "@/lib/utils"

interface AccountCardProps {
  account: Account
  depth?: number
  showCNYConversion?: boolean
  // Drag props
  isDragging?: boolean
  dragItemId?: string | null
  dragItemType?: DragItemType | null
  dropTargetId?: string | null
  dropPosition?: DropPosition | null
  categoryType?: "asset" | "liability"
  registerNode?: (
    id: string,
    type: DragItemType,
    parentId: string | null,
    categoryType: "asset" | "liability",
    depth: number,
    el: HTMLElement | null
  ) => void
  onTouchStart?: (
    id: string,
    type: DragItemType,
    label: string,
    badge: string | undefined,
    categoryType: "asset" | "liability",
    e: React.TouchEvent
  ) => void
  onMouseDown?: (
    id: string,
    type: DragItemType,
    label: string,
    badge: string | undefined,
    categoryType: "asset" | "liability",
    e: React.MouseEvent
  ) => void
  onDragEnd?: () => void
}

export function AccountCard({
  account,
  depth = 0,
  showCNYConversion = true,
  isDragging = false,
  dragItemId,
  dragItemType,
  dropTargetId,
  dropPosition,
  categoryType = "asset",
  registerNode,
  onTouchStart,
  onMouseDown,
  onDragEnd,
}: AccountCardProps) {
  const router = useRouter()
  const rateMap = useRateMap()
  const nodeRef = useRef<HTMLDivElement>(null)
  const dragJustEnded = useRef(false)

  const isForeign = account.currency !== "CNY"
  const cnyCents = isForeign && showCNYConversion ? convertToCNY(account.balance, account.currency, rateMap) : null

  const isBeingDragged = dragItemId === account.id
  const isDropTarget = dropTargetId === account.id

  // Register for hit testing
  useEffect(() => {
    if (registerNode) {
      registerNode(account.id, "account", account.categoryId, categoryType, depth, nodeRef.current)
      return () => registerNode(account.id, "account", account.categoryId, categoryType, depth, null)
    }
  }, [account.id, account.categoryId, categoryType, depth, registerNode])

  // Track when drag ends for click suppression
  useEffect(() => {
    if (!isDragging && dragJustEnded.current === false && dragItemId === null && onDragEnd) {
      // Not currently relevant
    }
  }, [isDragging, dragItemId, onDragEnd])

  // When drag state transitions from dragging to idle, set flag
  const wasDragging = useRef(false)
  useEffect(() => {
    if (isDragging) {
      wasDragging.current = true
    } else if (wasDragging.current) {
      wasDragging.current = false
      dragJustEnded.current = true
      const timer = setTimeout(() => {
        dragJustEnded.current = false
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isDragging])

  const handleClick = useCallback(() => {
    if (dragJustEnded.current) return
    if (isDragging) return
    router.push(`/accounts/${account.id}`)
  }, [isDragging, account.id, router])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      router.push(`/accounts/${account.id}`)
    }
  }, [account.id, router])

  return (
    <div>
      {/* Drop-before indicator */}
      {isDropTarget && dropPosition === "drop-before" && dragItemType === "account" && <DropIndicator />}

      <div
        ref={nodeRef}
        role="link"
        tabIndex={0}
        className={cn(
          "flex items-center justify-between py-1 rounded-lg hover:bg-accent/50 active:bg-accent cursor-pointer",
          account.isArchived && "opacity-50",
          isBeingDragged && "opacity-30",
          isDropTarget && dropPosition === "drop-into" && "ring-2 ring-primary bg-primary/5"
        )}
        style={{ paddingLeft: `${depth * 16 + 16}px`, paddingRight: 16 }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onTouchStart={(e) => {
          if (onTouchStart) {
            onTouchStart(account.id, "account", account.name, undefined, categoryType, e)
          }
        }}
        onMouseDown={(e) => {
          if (onMouseDown) {
            onMouseDown(account.id, "account", account.name, undefined, categoryType, e)
          }
        }}
      >
        <div className="text-sm truncate">{account.name}</div>
        <div className="text-right shrink-0">
          <AmountDisplay cents={account.balance} size="sm" currency={account.currency} />
          {isForeign && cnyCents !== null && (
            <div className="text-xs text-muted-foreground">
              ≈{formatAmount(cnyCents)}
            </div>
          )}
        </div>
      </div>

      {/* Drop-after indicator */}
      {isDropTarget && dropPosition === "drop-after" && dragItemType === "account" && <DropIndicator />}
    </div>
  )
}
