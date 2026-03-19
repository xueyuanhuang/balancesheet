"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import type { CategoryTreeNode } from "@/types"

export type DropPosition = "drop-before" | "drop-after" | "drop-into" | "drop-root"

export interface DragState {
  dragId: string | null
  dropTargetId: string | null
  dropPosition: DropPosition | null
  isDragging: boolean
  overlayPos: { x: number; y: number } | null
  dragNode: CategoryTreeNode | null
}

interface NodeMeta {
  id: string
  parentId: string | null
  depth: number
  ref: HTMLElement
}

interface UseCategoryDragOptions {
  nodes: CategoryTreeNode[]
  allCategories: CategoryTreeNode[]
  onMove: (categoryId: string, targetParentId: string | null, sortIndex: number | null) => void
}

const LONG_PRESS_MS = 400
const MOVE_TOLERANCE = 10
const SCROLL_EDGE = 60
const SCROLL_SPEED = 8

function getDescendantIds(node: CategoryTreeNode): Set<string> {
  const ids = new Set<string>()
  function walk(n: CategoryTreeNode) {
    for (const child of n.children) {
      ids.add(child.id)
      walk(child)
    }
  }
  walk(node)
  return ids
}

function getSubtreeMaxDepth(node: CategoryTreeNode): number {
  if (node.children.length === 0) return 1
  let max = 0
  for (const child of node.children) {
    const d = getSubtreeMaxDepth(child)
    if (d > max) max = d
  }
  return 1 + max
}

function findNodeById(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeById(n.children, id)
    if (found) return found
  }
  return null
}

const IDLE_STATE: DragState = {
  dragId: null,
  dropTargetId: null,
  dropPosition: null,
  isDragging: false,
  overlayPos: null,
  dragNode: null,
}

export function useCategoryDrag({ nodes, allCategories, onMove }: UseCategoryDragOptions) {
  const [state, setState] = useState<DragState>(IDLE_STATE)

  const phase = useRef<"idle" | "pressing" | "dragging">("idle")
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const registeredNodes = useRef<Map<string, NodeMeta>>(new Map())
  const cachedRects = useRef<Map<string, DOMRect>>(new Map())
  const rootDropZoneRef = useRef<HTMLElement | null>(null)
  const rootDropZoneRect = useRef<DOMRect | null>(null)
  const rafId = useRef<number>(0)
  const scrollRafId = useRef<number>(0)
  const dragIdRef = useRef<string | null>(null)
  const descendantIdsRef = useRef<Set<string>>(new Set())
  const dragNodeRef = useRef<CategoryTreeNode | null>(null)

  // Refs for drop target (read by handleEnd without stale closure)
  const dropTargetIdRef = useRef<string | null>(null)
  const dropPositionRef = useRef<DropPosition | null>(null)

  // Stable refs for callbacks/data to avoid listener churn
  const onMoveRef = useRef(onMove)
  const allCategoriesRef = useRef(allCategories)
  const nodesRef = useRef(nodes)
  useEffect(() => {
    onMoveRef.current = onMove
    allCategoriesRef.current = allCategories
    nodesRef.current = nodes
  })

  const registerNode = useCallback((id: string, parentId: string | null, depth: number, el: HTMLElement | null) => {
    if (el) {
      registeredNodes.current.set(id, { id, parentId, depth, ref: el })
    } else {
      registeredNodes.current.delete(id)
    }
  }, [])

  const registerRootDropZone = useCallback((el: HTMLElement | null) => {
    rootDropZoneRef.current = el
  }, [])

  const refreshRects = useCallback(() => {
    cachedRects.current.clear()
    registeredNodes.current.forEach((meta, id) => {
      cachedRects.current.set(id, meta.ref.getBoundingClientRect())
    })
    if (rootDropZoneRef.current) {
      rootDropZoneRect.current = rootDropZoneRef.current.getBoundingClientRect()
    }
  }, [])

  // ─── Cancel ────────────────────────────────────────────
  const cancelDrag = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    cancelAnimationFrame(rafId.current)
    cancelAnimationFrame(scrollRafId.current)
    phase.current = "idle"
    dragIdRef.current = null
    dragNodeRef.current = null
    descendantIdsRef.current.clear()
    dropTargetIdRef.current = null
    dropPositionRef.current = null

    setState(IDLE_STATE)
  }, [])

  // ─── Drop target computation ──────────────────────────
  const setDropTarget = useCallback((targetId: string | null, position: DropPosition | null, pos: { x: number; y: number }) => {
    dropTargetIdRef.current = targetId
    dropPositionRef.current = position
    setState((prev) => ({
      ...prev,
      dropTargetId: targetId,
      dropPosition: position,
      overlayPos: pos,
    }))
  }, [])

  const computeDropTarget = useCallback(
    (clientX: number, clientY: number) => {
      const dragId = dragIdRef.current
      if (!dragId) return

      // Check root drop zone first
      if (rootDropZoneRect.current) {
        const rr = rootDropZoneRect.current
        if (clientX >= rr.left && clientX <= rr.right && clientY >= rr.top && clientY <= rr.bottom) {
          setDropTarget(null, "drop-root", { x: clientX, y: clientY })
          return
        }
      }

      let bestId: string | null = null
      let bestPosition: DropPosition | null = null
      let bestDistance = Infinity

      cachedRects.current.forEach((rect, id) => {
        if (id === dragId) return
        if (descendantIdsRef.current.has(id)) return
        if (clientX < rect.left - 20 || clientX > rect.right + 20) return

        const centerY = rect.top + rect.height / 2
        const dist = Math.abs(clientY - centerY)

        if (dist < bestDistance && clientY >= rect.top - 10 && clientY <= rect.bottom + 10) {
          bestDistance = dist
          bestId = id

          const relativeY = (clientY - rect.top) / rect.height
          if (relativeY < 0.2) {
            bestPosition = "drop-before"
          } else if (relativeY > 0.8) {
            bestPosition = "drop-after"
          } else {
            bestPosition = "drop-into"
          }
        }
      })

      // Validate drop-into: depth limit
      if (bestId && bestPosition === "drop-into") {
        const targetMeta = registeredNodes.current.get(bestId)
        const dragNode = dragNodeRef.current
        if (targetMeta && dragNode) {
          const subtreeDepth = getSubtreeMaxDepth(dragNode)
          if (targetMeta.depth + 1 + subtreeDepth - 1 > 3) {
            bestId = null
            bestPosition = null
          }
        }
      }

      setDropTarget(bestId, bestPosition, { x: clientX, y: clientY })
    },
    [setDropTarget]
  )

  // ─── Auto-scroll ──────────────────────────────────────
  const autoScroll = useCallback((clientY: number) => {
    cancelAnimationFrame(scrollRafId.current)
    const viewH = window.innerHeight
    let speed = 0

    if (clientY < SCROLL_EDGE) {
      speed = -SCROLL_SPEED * ((SCROLL_EDGE - clientY) / SCROLL_EDGE)
    } else if (clientY > viewH - SCROLL_EDGE) {
      speed = SCROLL_SPEED * ((clientY - (viewH - SCROLL_EDGE)) / SCROLL_EDGE)
    }

    if (speed !== 0) {
      const tick = () => {
        window.scrollBy(0, speed)
        refreshRects()
        scrollRafId.current = requestAnimationFrame(tick)
      }
      scrollRafId.current = requestAnimationFrame(tick)
    }
  }, [refreshRects])

  // ─── Enter dragging mode ──────────────────────────────
  const enterDragging = useCallback((categoryId: string, node: CategoryTreeNode | null, x: number, y: number) => {
    phase.current = "dragging"

    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    refreshRects()

    setState({
      dragId: categoryId,
      dropTargetId: null,
      dropPosition: null,
      isDragging: true,
      overlayPos: { x, y },
      dragNode: node,
    })
  }, [refreshRects])

  // ─── Execute drop ─────────────────────────────────────
  const executeDrop = useCallback(() => {
    if (phase.current !== "dragging") {
      cancelDrag()
      return
    }

    const dragId = dragIdRef.current
    const dropTargetId = dropTargetIdRef.current
    const dropPosition = dropPositionRef.current

    if (dragId && dropPosition) {
      if (dropPosition === "drop-root") {
        onMoveRef.current(dragId, null, null)
      } else if (dropTargetId) {
        const targetMeta = registeredNodes.current.get(dropTargetId)
        if (targetMeta) {
          if (dropPosition === "drop-into") {
            onMoveRef.current(dragId, dropTargetId, null)
          } else {
            const targetParentId = targetMeta.parentId
            const siblings = allCategoriesRef.current
              .filter((c) => c.parentId === targetParentId && c.id !== dragId)
              .sort((a, b) => a.sortOrder - b.sortOrder)
            const targetIdx = siblings.findIndex((c) => c.id === dropTargetId)
            const sortIndex = dropPosition === "drop-before" ? targetIdx : targetIdx + 1
            onMoveRef.current(dragId, targetParentId, sortIndex)
          }
        }
      }
    }

    cancelDrag()
  }, [cancelDrag])

  // ─── Touch event handlers (primary for mobile) ────────
  // These use refs and are stable — no dependency on render state.
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      if (phase.current === "pressing") {
        const dx = touch.clientX - startPos.current.x
        const dy = touch.clientY - startPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE) {
          cancelDrag()
          // Don't preventDefault — let browser scroll normally
        }
        return
      }

      if (phase.current === "dragging") {
        // Prevent browser scroll while dragging
        e.preventDefault()
        cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(() => {
          computeDropTarget(touch.clientX, touch.clientY)
          autoScroll(touch.clientY)
        })
      }
    }

    const handleTouchEnd = () => {
      if (phase.current === "dragging") {
        executeDrop()
      } else {
        cancelDrag()
      }
    }

    const handleTouchCancel = () => {
      cancelDrag()
    }

    const handleContextMenu = (e: Event) => {
      // Suppress context menu during pressing/dragging
      if (phase.current !== "idle") {
        e.preventDefault()
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelDrag()
      }
    }

    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)
    document.addEventListener("touchcancel", handleTouchCancel)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchcancel", handleTouchCancel)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [cancelDrag, computeDropTarget, autoScroll, executeDrop])

  // ─── Mouse event handlers (desktop fallback) ──────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (phase.current === "pressing") {
        const dx = e.clientX - startPos.current.x
        const dy = e.clientY - startPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE) {
          cancelDrag()
        }
        return
      }

      if (phase.current === "dragging") {
        cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(() => {
          computeDropTarget(e.clientX, e.clientY)
          autoScroll(e.clientY)
        })
      }
    }

    const handleMouseUp = () => {
      if (phase.current === "dragging") {
        executeDrop()
      } else {
        cancelDrag()
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [cancelDrag, computeDropTarget, autoScroll, executeDrop])

  // ─── Start long press (called from component) ─────────
  const handleTouchStart = useCallback(
    (categoryId: string, e: React.TouchEvent) => {
      if (phase.current !== "idle") return
      const touch = e.touches[0]
      if (!touch) return

      phase.current = "pressing"
      startPos.current = { x: touch.clientX, y: touch.clientY }
      dragIdRef.current = categoryId

      const node = findNodeById(nodesRef.current, categoryId)
      dragNodeRef.current = node

      if (node) {
        descendantIdsRef.current = getDescendantIds(node)
      }

      pressTimer.current = setTimeout(() => {
        if (phase.current !== "pressing") return
        enterDragging(categoryId, node, startPos.current.x, startPos.current.y)
      }, LONG_PRESS_MS)
    },
    [enterDragging]
  )

  const handleMouseDown = useCallback(
    (categoryId: string, e: React.MouseEvent) => {
      if (phase.current !== "idle") return
      if (e.button !== 0) return

      phase.current = "pressing"
      startPos.current = { x: e.clientX, y: e.clientY }
      dragIdRef.current = categoryId

      const node = findNodeById(nodesRef.current, categoryId)
      dragNodeRef.current = node

      if (node) {
        descendantIdsRef.current = getDescendantIds(node)
      }

      pressTimer.current = setTimeout(() => {
        if (phase.current !== "pressing") return
        enterDragging(categoryId, node, startPos.current.x, startPos.current.y)
      }, LONG_PRESS_MS)
    },
    [enterDragging]
  )

  return {
    state,
    handleTouchStart,
    handleMouseDown,
    registerNode,
    registerRootDropZone,
  }
}
