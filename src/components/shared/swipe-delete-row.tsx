"use client"

import { useRef, useState, type PointerEvent, type ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const ACTION_WIDTH = 80
const DIRECTION_THRESHOLD = 8

interface SwipeDeleteRowProps {
  children: ReactNode
  onDelete: () => void
  label: string
  disabled?: boolean
}

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  startOffset: number
  axis: "horizontal" | "vertical" | null
}

export function SwipeDeleteRow({ children, onDelete, label, disabled = false }: SwipeDeleteRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef(0)
  const gestureRef = useRef<Gesture | null>(null)
  const suppressClickRef = useRef(false)

  function moveTo(nextOffset: number) {
    const clamped = Math.max(-ACTION_WIDTH, Math.min(0, nextOffset))
    offsetRef.current = clamped
    setOffset(clamped)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return
    suppressClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetRef.current,
      axis: null,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DIRECTION_THRESHOLD) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesture.axis = "vertical"
        moveTo(0)
        return
      }
      gesture.axis = "horizontal"
      suppressClickRef.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (gesture.axis === "horizontal") {
      event.preventDefault()
      moveTo(gesture.startOffset + dx)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    gestureRef.current = null
    setDragging(false)
    if (gesture.axis === "horizontal") {
      moveTo(offsetRef.current <= -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0)
    } else if (!gesture.axis && gesture.startOffset < 0) {
      // A tap on an already revealed row closes it before it can open the record.
      suppressClickRef.current = true
      moveTo(0)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    setDragging(false)
    moveTo(0)
  }

  return (
    <div
      className="relative isolate overflow-hidden rounded-lg"
      role="group"
      aria-label={label}
      data-swipe-open={offset < 0}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) moveTo(0)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          moveTo(0)
        } else if (event.key === "ArrowLeft" && !disabled) {
          event.preventDefault()
          moveTo(-ACTION_WIDTH)
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          moveTo(0)
        }
      }}
    >
      <div
        className={cn(
          "relative z-10 touch-pan-y bg-background",
          !dragging && "transition-transform duration-200 ease-out motion-reduce:transition-none",
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return
          event.preventDefault()
          event.stopPropagation()
          suppressClickRef.current = false
        }}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Delete ${label}`}
        disabled={disabled}
        className={cn(
          "absolute inset-y-0 right-0 flex w-20 flex-col items-center justify-center gap-1 bg-red-600 text-xs font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:opacity-50",
          offset === 0 && "pointer-events-none",
        )}
        onFocus={() => moveTo(-ACTION_WIDTH)}
        onClick={() => {
          moveTo(0)
          onDelete()
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>
    </div>
  )
}
