"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { AmountInput } from "@/components/shared/amount-input"
import { accountService } from "@/lib/services/account-service"
import { categoryService } from "@/lib/services/category-service"
import { useCategories } from "@/lib/hooks/use-categories"
import { useCategoryTree } from "@/lib/hooks/use-category-tree"
import { CURRENCIES } from "@/lib/utils/constants"
import { db } from "@/lib/db"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Check } from "lucide-react"
import type { Account, CategoryTreeNode } from "@/types"

interface AccountFormProps {
  mode: "create" | "edit"
  initialData?: Account
  defaultCurrency?: string
  onCreated?: (accountId: string) => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

export function AccountForm({ mode, initialData, defaultCurrency, onCreated, onCancel, onSavingChange }: AccountFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "")
  const [openingBalance, setOpeningBalance] = useState(initialData?.openingBalance ?? 0)
  const [currency, setCurrency] = useState(() => {
    if (initialData?.currency) return initialData.currency
    if (defaultCurrency) return defaultCurrency
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastCurrency") ?? "CNY"
    }
    return "CNY"
  })
  const [note, setNote] = useState(initialData?.note ?? "")
  const [loading, setLoading] = useState(false)
  const [hasEntries, setHasEntries] = useState(false)

  const categories = useCategories()
  const { assetTree, liabilityTree } = useCategoryTree(categories)

  useEffect(() => {
    if (mode === "edit" && initialData) {
      db.entries.where("accountId").equals(initialData.id).count().then((count) => {
        setHasEntries(count > 0)
      })
    }
  }, [mode, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    if (!name.trim()) {
      toast.error("Enter an account name")
      return
    }
    if (!categoryId) {
      toast.error("Select a category")
      return
    }

    setLoading(true)
    onSavingChange?.(true)
    try {
      if (mode === "create") {
        const createdId = await accountService.create({
          name: name.trim(),
          categoryId,
          openingBalance,
          currency,
          note,
        })
        localStorage.setItem("lastCurrency", currency)
        await categoryService.incrementUsageCount(categoryId)
        toast.success("Account created")
        if (onCreated) {
          onCreated(createdId)
          return
        }
      } else if (initialData) {
        await accountService.update(initialData.id, {
          name: name.trim(),
          categoryId,
          openingBalance,
          currency,
          note,
        })
        await categoryService.incrementUsageCount(categoryId)
        toast.success("Account updated")
      }
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
      onSavingChange?.(false)
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
        setExpandedNodes(new Set())
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [pickerOpen])

  function getCategoryPath(id: string): string {
    const cat = categories.find((c) => c.id === id)
    if (!cat) return ""
    if (cat.parentId) {
      const parent = categories.find((c) => c.id === cat.parentId)
      if (parent?.parentId) {
        const grandparent = categories.find((c) => c.id === parent.parentId)
        if (grandparent) return `${grandparent.name} / ${parent.name} / ${cat.name}`
      }
      if (parent) return `${parent.name} / ${cat.name}`
    }
    return cat.name
  }

  function sortByUsage(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
    return [...nodes].sort((a, b) => {
      const countDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0)
      if (countDiff !== 0) return countDiff
      return a.name.localeCompare(b.name)
    })
  }

  function renderPickerNodes(nodes: CategoryTreeNode[], depth: number, typeLabel?: string): React.ReactNode {
    const activeNodes = sortByUsage(nodes.filter((n) => !n.isArchived))
    if (activeNodes.length === 0) return null
    return (
      <>
        {typeLabel && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">{typeLabel}</div>
        )}
        {activeNodes.map((node) => {
          const activeChildren = node.children.filter((c) => !c.isArchived)
          const hasChildren = activeChildren.length > 0
          const isExpanded = expandedNodes.has(node.id)
          const isSelected = categoryId === node.id
          const indent = depth * 12 + 12
          return (
            <div key={node.id}>
              <div
                className={cn(
                  "flex items-center",
                  isSelected ? "bg-accent" : "hover:bg-accent/50"
                )}
                style={{ paddingLeft: `${indent}px`, paddingRight: 12 }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
                    aria-expanded={isExpanded}
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setExpandedNodes((prev) => {
                      const next = new Set(prev)
                      if (next.has(node.id)) next.delete(node.id)
                      else next.add(node.id)
                      return next
                    })}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>
                ) : (
                  <span className="w-9 shrink-0" />
                )}
                <button
                  type="button"
                  aria-label={`Select category: ${node.name}`}
                  aria-pressed={isSelected}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left text-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setCategoryId(node.id)
                    setPickerOpen(false)
                    setExpandedNodes(new Set())
                  }}
                >
                  <span className="flex-1 truncate">{node.name}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              </div>
              {hasChildren && isExpanded && (
                <div className={depth === 0 ? "bg-muted/30" : undefined}>
                  {renderPickerNodes(activeChildren, depth + 1)}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Account name</label>
        <Input aria-label="Account name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main checking account" maxLength={30} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            aria-label="Choose category"
            aria-expanded={pickerOpen}
            className={cn(
              "flex items-center w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
            onClick={() => { setPickerOpen((v) => !v); setExpandedNodes(new Set()) }}
          >
            <span className="flex-1 text-left truncate">
              {selectedCategory
                ? getCategoryPath(selectedCategory.id)
                : <span className="text-muted-foreground">Select a category</span>}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", pickerOpen && "rotate-180")} />
          </button>
          {pickerOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
              {renderPickerNodes(assetTree, 0, "Assets")}
              {renderPickerNodes(liabilityTree, 0, "Liabilities")}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Currency</label>
        <Select value={currency} onValueChange={(v) => { if (v) setCurrency(v) }} disabled={hasEntries}>
          <SelectTrigger className="w-full" aria-label="Currency">
            <span data-slot="select-value" className="flex flex-1 text-left truncate">
              {CURRENCIES.find((c) => c.code === currency)?.symbol} {CURRENCIES.find((c) => c.code === currency)?.label}
            </span>
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.symbol} {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasEntries && (
          <p className="text-xs text-muted-foreground">The currency cannot be changed after transactions have been recorded.</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Opening balance</label>
        <AmountInput value={openingBalance} onChange={setOpeningBalance} currency={currency} ariaLabel="Opening balance" />
        <p className="text-xs text-muted-foreground">
          {onCreated ? "Balance before this transfer. Leave at 0 for a new account." : "Set the starting balance. Transactions will update it from here."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Note</label>
        <Input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
      </div>

      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>}
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Saving..." : mode === "create" ? onCreated ? "Create and select account" : "Create account" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
