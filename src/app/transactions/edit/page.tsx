"use client"

import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/transactions/transaction-form"
import { useOperation } from "@/lib/hooks/use-operations"
import { operationService } from "@/lib/services/operation-service"
import { toast } from "sonner"

export default function EditTransactionPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const router = useRouter()
  const operationData = useOperation(id || undefined)

  const handleDelete = async () => {
    if (!operationData) return
    try {
      await operationService.deleteOperation(operationData.operation.id)
      toast.success("Deleted")
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete")
    }
  }

  if (!operationData) {
    return (
      <div>
        <PageHeader title="Edit transaction" showBack />
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Edit transaction"
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
