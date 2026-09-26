"use client"

import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/transactions/transaction-form"
import { OpeningRecordEditor } from "@/components/transactions/opening-record-editor"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useOperation } from "@/lib/hooks/use-operations"
import { operationService } from "@/lib/services/operation-service"
import { toast } from "sonner"

export default function EditTransactionPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const openingAccountId = searchParams.get("openingAccountId") ?? ""
  const router = useRouter()
  const operationData = useOperation(id || undefined)
  const openingRecord = useLiveQuery(async () => {
    if (!openingAccountId) return null
    const account = await db.accounts.get(openingAccountId)
    if (!account) return null
    const category = await db.categories.get(account.categoryId)
    const count = await db.entries.where("accountId").equals(openingAccountId).count()
    return { account, canConvert: count === 0 && account.openingBalance > 0 && category?.type === "asset" }
  }, [openingAccountId])

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

  if (openingAccountId) {
    return (
      <div>
        <PageHeader title="Edit record" showBack />
        {openingRecord ? (
          <OpeningRecordEditor key={openingAccountId} account={openingRecord.account} canConvert={openingRecord.canConvert} />
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            {openingRecord === undefined ? "Loading..." : "Record not found"}
          </div>
        )}
      </div>
    )
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
        key={id}
        mode="edit"
        initialData={operationData}
      />
    </div>
  )
}
