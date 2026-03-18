"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { toast } from "sonner"
import { categoryService } from "@/lib/services/category-service"
import { useCategories } from "@/lib/hooks/use-categories"
import type { Category, CategoryType } from "@/types"

interface CategoryFormProps {
  mode: "create" | "edit"
  initialData?: Category
  defaultType?: CategoryType
  defaultParentId?: string | null
}

function getCategoryDepth(catId: string, allCats: Category[]): number {
  let depth = 1
  let cat = allCats.find((c) => c.id === catId)
  while (cat?.parentId) {
    depth++
    cat = allCats.find((c) => c.id === cat!.parentId)
  }
  return depth
}

function getCategoryPath(catId: string, allCats: Category[]): string {
  const cat = allCats.find((c) => c.id === catId)
  if (!cat) return ""
  if (cat.parentId) {
    const parent = allCats.find((c) => c.id === cat.parentId)
    if (parent) return `${parent.name} / ${cat.name}`
  }
  return cat.name
}

export function CategoryForm({ mode, initialData, defaultType = "asset", defaultParentId = null }: CategoryFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? "")
  const [type, setType] = useState<CategoryType>(initialData?.type ?? defaultType)
  const [parentId, setParentId] = useState<string | null>(initialData?.parentId ?? defaultParentId)
  const [loading, setLoading] = useState(false)

  const categories = useCategories(type)

  // Allow L1 (depth=1) and L2 (depth=2) as parents (creating L2 or L3 children)
  const parentOptions = categories.filter((c) => {
    if (c.isArchived) return false
    if (initialData && c.id === initialData.id) return false
    const depth = getCategoryDepth(c.id, categories)
    return depth < 3
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("请输入分类名称")
      return
    }

    setLoading(true)
    try {
      if (mode === "create") {
        await categoryService.create({ name: name.trim(), type, parentId })
        toast.success("分类创建成功")
      } else if (initialData) {
        await categoryService.update(initialData.id, { name: name.trim(), parentId })
        toast.success("分类更新成功")
      }
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-6">
      {/* Type selector - only for create mode */}
      {mode === "create" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">类型</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "asset" ? "default" : "outline"}
              className="flex-1"
              onClick={() => { setType("asset"); setParentId(null) }}
            >
              资产
            </Button>
            <Button
              type="button"
              variant={type === "liability" ? "default" : "outline"}
              className="flex-1"
              onClick={() => { setType("liability"); setParentId(null) }}
            >
              负债
            </Button>
          </div>
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">名称</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入分类名称"
          maxLength={20}
        />
      </div>

      {/* Parent category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">父级分类</label>
        <Select value={parentId ?? "__none__"} onValueChange={(v) => setParentId(v === "__none__" ? null : v)}>
          <SelectTrigger className="w-full">
            <span data-slot="select-value" className="flex flex-1 text-left truncate">
              {parentId
                ? getCategoryPath(parentId, categories) || "选择父级分类"
                : "无（顶级分类）"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">无（顶级分类）</SelectItem>
            {parentOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {getCategoryPath(c.id, categories)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "保存中..." : mode === "create" ? "创建分类" : "保存修改"}
      </Button>
    </form>
  )
}
