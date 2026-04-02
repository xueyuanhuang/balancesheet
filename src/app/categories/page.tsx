"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import { CategoryTree } from "@/components/categories/category-tree"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useCategories } from "@/lib/hooks/use-categories"
import { useCategoryTree } from "@/lib/hooks/use-category-tree"
import { categoryService } from "@/lib/services/category-service"
import { toast } from "sonner"

export default function CategoriesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") === "liability" ? "liability" : "asset"
  const categories = useCategories()
  const { assetTree, liabilityTree } = useCategoryTree(categories)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteDescription, setDeleteDescription] = useState("")
  const [deleting, setDeleting] = useState(false)

  // For the "blocked" dialog when accounts exist
  const [blockedInfo, setBlockedInfo] = useState<{
    open: boolean
    reason: string
    accounts: { id: string; name: string; categoryName: string }[]
  }>({ open: false, reason: "", accounts: [] })

  const handleArchive = async (id: string) => {
    try {
      const cat = categories.find((c) => c.id === id)
      if (!cat) return
      if (cat.isArchived) {
        await categoryService.restore(id)
        toast.success("已恢复分类")
      } else {
        await categoryService.archive(id)
        toast.success("已归档分类")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDelete = async (id: string) => {
    const check = await categoryService.canDelete(id)
    if (!check.canDelete) {
      setBlockedInfo({
        open: true,
        reason: check.reason ?? "",
        accounts: check.linkedAccounts ?? [],
      })
      return
    }
    const cat = categories.find((c) => c.id === id)
    const childCount = categories.filter((c) => c.parentId === id).length
    if (childCount > 0) {
      setDeleteDescription(`将删除「${cat?.name ?? ""}」及其 ${childCount} 个子分类，此操作不可撤销。`)
    } else {
      setDeleteDescription(`确定要删除「${cat?.name ?? ""}」吗？此操作不可撤销。`)
    }
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await categoryService.delete(deleteTarget)
      toast.success("已删除分类")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="分类管理"
        showBack
        rightAction={
          <Link href={`/categories/new?type=${activeTab}`}>
            <Button variant="ghost" size="icon">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        }
      />
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={(v) => {
          router.replace(`/categories?tab=${v}`, { scroll: false })
        }}>
          <TabsList className="w-full">
            <TabsTrigger value="asset" className="flex-1">资产</TabsTrigger>
            <TabsTrigger value="liability" className="flex-1">负债</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground mt-3 px-1">
            长按分类可拖拽排序，拖入其他分类可设为子分类
          </p>
          <TabsContent value="asset" className="mt-4">
            <CategoryTree
              nodes={assetTree.filter((n) => !n.isArchived)}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          </TabsContent>
          <TabsContent value="liability" className="mt-4">
            <CategoryTree
              nodes={liabilityTree.filter((n) => !n.isArchived)}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Normal delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="删除分类"
        description={deleteDescription}
        confirmLabel="删除"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      {/* Blocked: has linked accounts */}
      <Dialog open={blockedInfo.open} onOpenChange={(open) => setBlockedInfo((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>无法删除</DialogTitle>
            <DialogDescription>
              该分类下有以下账户，需要先处理这些账户才能删除分类：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {blockedInfo.accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg text-sm"
              >
                <div>
                  <div className="font-medium">{acc.name}</div>
                  <div className="text-xs text-muted-foreground">分类：{acc.categoryName}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBlockedInfo((p) => ({ ...p, open: false }))
                    router.push(`/accounts/edit?id=${acc.id}`)
                  }}
                >
                  去编辑
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedInfo((p) => ({ ...p, open: false }))}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
