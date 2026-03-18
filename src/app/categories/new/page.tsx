"use client"

import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { CategoryForm } from "@/components/categories/category-form"
import type { CategoryType } from "@/types"

export default function NewCategoryPage() {
  const searchParams = useSearchParams()
  const type = (searchParams.get("type") as CategoryType) || "asset"
  const parentId = searchParams.get("parentId") || null

  return (
    <div>
      <PageHeader title="新建分类" showBack />
      <CategoryForm mode="create" defaultType={type} defaultParentId={parentId} />
    </div>
  )
}
