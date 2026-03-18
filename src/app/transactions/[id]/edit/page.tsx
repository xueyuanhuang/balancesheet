"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/transactions/transaction-form"
import { useOperation } from "@/lib/hooks/use-operations"
import { operationService } from "@/lib/services/operation-service"
import { toast } from "sonner"

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const operationData = useOperation(id)

  const handleDelete = async () => {
    if (!operationData) return
    try {
      await operationService.deleteOperation(operationData.operation.id)
      toast.success("已删除")
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  if (!operationData) {
    return (
      <div>
        <PageHeader title="编辑交易" showBack />
        <div className="p-4 text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="编辑交易"
        showBack
        rightAction={
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        }
      />
      <TransactionForm
        mode="edit"
        initialData={operationData}
      />
    </div>
  )
}
