"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select"
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
}

export function AccountForm({ mode, initialData }: AccountFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "")
  const [openingBalance, setOpeningBalance] = useState(initialData?.openingBalance ?? 0)
  const [currency, setCurrency] = useState(() => {
    if (initialData?.currency) return initialData.currency
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
    if (!name.trim()) {
      toast.error("请输入账户名称")
      return
    }
    if (!categoryId) {
      toast.error("请选择分类")
      return
    }

    setLoading(true)
    try {
      if (mode === "create") {
        await accountService.create({
          name: name.trim(),
          categoryId,
          openingBalance,
          currency,
          note,
        })
        localStorage.setItem("lastCurrency", currency)
        await categoryService.incrementUsageCount(categoryId)
        toast.success("账户创建成功")
      } else if (initialData) {
        await accountService.update(initialData.id, {
          name: name.trim(),
          categoryId,
          openingBalance,
          currency,
          note,
        })
        await categoryService.incrementUsageCount(categoryId)
        toast.success("账户更新成功")
      }
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    } finally {
      setLoading(false)
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

  function renderPickerNodes(nodes: CategoryTreeNode[], depth: number, typeLabel?: string): React.ReactNode {
    const activeNodes = nodes.filter((n) => !n.isArchived)
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
          const isSelected = !hasChildren && categoryId === node.id
          const indent = depth * 12 + 12
          return (
            <div key={node.id}>
              <div
                className={cn(
                  "flex items-center py-2.5 cursor-pointer",
                  isSelected ? "bg-accent" : "hover:bg-accent/50"
                )}
                style={{ paddingLeft: `${indent}px`, paddingRight: 12 }}
                onClick={() => {
                  if (hasChildren) {
                    setExpandedNodes((prev) => {
                      const next = new Set(prev)
                      if (next.has(node.id)) next.delete(node.id)
                      else next.add(node.id)
                      return next
                    })
                  } else {
                    setCategoryId(node.id)
                    setPickerOpen(false)
                    setExpandedNodes(new Set())
                  }
                }}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  )
                ) : (
                  <span className="w-4 mr-2 shrink-0" />
                )}
                <span className="flex-1 text-sm">{node.name}</span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
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
        <label className="text-sm font-medium">账户名称</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：招商银行储蓄卡" maxLength={30} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">所属分类</label>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            className={cn(
              "flex items-center w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
            onClick={() => { setPickerOpen((v) => !v); setExpandedNodes(new Set()) }}
          >
            <span className="flex-1 text-left truncate">
              {selectedCategory
                ? getCategoryPath(selectedCategory.id)
                : <span className="text-muted-foreground">选择分类</span>}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", pickerOpen && "rotate-180")} />
          </button>
          {pickerOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
              {renderPickerNodes(assetTree, 0, "资产")}
              {renderPickerNodes(liabilityTree, 0, "负债")}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">币种</label>
        <Select value={currency} onValueChange={(v) => { if (v) setCurrency(v) }} disabled={hasEntries}>
          <SelectTrigger className="w-full">
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
          <p className="text-xs text-muted-foreground">该账户已有流水记录，无法修改币种</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">初始余额</label>
        <AmountInput value={openingBalance} onChange={setOpeningBalance} currency={currency} />
        <p className="text-xs text-muted-foreground">设定账户的初始金额，后续通过记账增减</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">备注</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选备注" />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "保存中..." : mode === "create" ? "创建账户" : "保存修改"}
      </Button>
    </form>
  )
}
