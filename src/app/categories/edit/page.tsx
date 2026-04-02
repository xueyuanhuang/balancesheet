"use client"

import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { CategoryForm } from "@/components/categories/category-form"
import { useCategory } from "@/lib/hooks/use-categories"

export default function EditCategoryPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const category = useCategory(id || undefined)

  if (!category) {
    return (
      <div>
        <PageHeader title="编辑分类" showBack />
        <div className="p-4 text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="编辑分类" showBack />
      <CategoryForm mode="edit" initialData={category} />
    </div>
  )
}
