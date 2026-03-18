"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronRight, Check } from "lucide-react"
import { useCategories } from "@/lib/hooks/use-categories"
import { useCategoryTree } from "@/lib/hooks/use-category-tree"
import type { Category, CategoryType, CategoryTreeNode } from "@/types"
import { cn } from "@/lib/utils"

interface CategoryPickerProps {
  value: string | null
  onChange: (categoryId: string) => void
  type?: CategoryType
  label?: string
  allowParent?: boolean // whether parent categories can be selected (default false, only leaf)
}

function PickerNode({
  node,
  selected,
  onSelect,
  allowParent,
  depth = 0,
}: {
  node: CategoryTreeNode
  selected: string | null
  onSelect: (id: string) => void
  allowParent: boolean
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isLeaf = !hasChildren
  const canSelect = isLeaf || allowParent

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 py-2.5 px-3 text-sm rounded-lg",
          canSelect ? "hover:bg-accent active:bg-accent" : "text-muted-foreground",
          selected === node.id && "bg-accent"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => {
          if (canSelect) onSelect(node.id)
          if (hasChildren) setExpanded(!expanded)
        }}
        type="button"
      >
        <span className="flex-1 text-left truncate">{node.name}</span>
        {selected === node.id && <Check className="h-4 w-4 text-primary shrink-0" />}
        {hasChildren && <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.filter(c => !c.isArchived).map((child) => (
            <PickerNode
              key={child.id}
              node={child}
              selected={selected}
              onSelect={onSelect}
              allowParent={allowParent}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryPicker({ value, onChange, type, label = "选择分类", allowParent = false }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const categories = useCategories(type)
  const { assetTree, liabilityTree } = useCategoryTree(categories)

  const selectedCategory = categories.find((c) => c.id === value)
  const trees = type === "asset" ? assetTree : type === "liability" ? liabilityTree : [...assetTree, ...liabilityTree]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" className="w-full justify-between font-normal" type="button">
            <span className={selectedCategory ? "" : "text-muted-foreground"}>
              {selectedCategory?.name ?? label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        }
      />
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto mt-4 -mx-2">
          {trees.filter(t => !t.isArchived).map((node) => (
            <PickerNode
              key={node.id}
              node={node}
              selected={value}
              onSelect={(id) => {
                onChange(id)
                setOpen(false)
              }}
              allowParent={allowParent}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
