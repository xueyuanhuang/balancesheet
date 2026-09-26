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
import { findAccountCreationTransfer } from "@/lib/utils/activity"
import { toast } from "sonner"

export default function EditTransactionPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const openingAccountId = searchParams.get("openingAccountId") ?? ""
  const router = useRouter()
  const savedOperation = useOperation(id || undefined)
  const loadedOpening = useLiveQuery(async () => {
    if (!openingAccountId) return undefined
    return db.transaction("r", [db.accounts, db.operations, db.entries], async () => {
      const account = await db.accounts.get(openingAccountId)
      if (!account) return { accountId: openingAccountId, account: null, transfer: undefined }
      const linkedOperations = await db.operations.filter((operation) =>
        operation.createdAccountIds?.includes(openingAccountId) ?? false).toArray()
      const operations = await Promise.all(linkedOperations.map(async (operation) => ({
        operation,
        entries: await db.entries.where("operationId").equals(operation.id).toArray(),
      })))
      return { accountId: openingAccountId, account, transfer: findAccountCreationTransfer(openingAccountId, operations) }
    })
  }, [openingAccountId])
  const openingRecord = loadedOpening?.accountId === openingAccountId ? loadedOpening : undefined
  const operationData = id
    ? savedOperation?.operation.id === id ? savedOperation : undefined
    : openingRecord?.transfer

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

  if (openingAccountId && !id && !operationData) {
    return (
      <div>
        <PageHeader title="Opening balance" showBack />
        {openingRecord?.account ? (
          <OpeningRecordEditor key={openingAccountId} account={openingRecord.account} />
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
        <div className="p-4 text-center text-muted-foreground">{savedOperation === null ? "Transaction not found" : "Loading..."}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={operationData.entries.length === 2 ? "Edit transfer" : "Edit transaction"}
        showBack
        rightAction={
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        }
      />
      <TransactionForm
        key={operationData.operation.id}
        mode="edit"
        initialData={operationData}
      />
    </div>
  )
}
