"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/layout/page-header"
import { AmountDisplay } from "@/components/shared/amount-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { TransactionList } from "@/components/transactions/transaction-list"
import { useAccount } from "@/lib/hooks/use-accounts"
import { useCategory } from "@/lib/hooks/use-categories"
import { useActivity } from "@/lib/hooks/use-activity"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { accountService } from "@/lib/services/account-service"
import { formatAmount, formatDate } from "@/lib/utils/format"
import { convertToCNY } from "@/lib/utils/currency"
import { toast } from "sonner"

export default function AccountDetailPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const router = useRouter()
  const account = useAccount(id || undefined)
  const category = useCategory(account?.categoryId)
  const items = useActivity({ accountId: id || undefined })
  const rateMap = useRateMap()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteDesc, setDeleteDesc] = useState("")
  const [deleting, setDeleting] = useState(false)

  const isForeign = account ? account.currency !== "CNY" : false
  const cnyCents = account && isForeign
    ? convertToCNY(account.balance, account.currency, rateMap)
    : null

  const handleDeleteClick = async () => {
    if (!account) return
    const info = await accountService.getDeleteInfo(id)
    if (info.entryCount > 0) {
      setDeleteDesc(`This account has ${info.entryCount} transactions and cannot be deleted. Archive it instead.`)
      setDeleteOpen(true)
    } else {
      setDeleteDesc(`Delete account “${account.name}”? This cannot be undone.`)
      setDeleteOpen(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await accountService.delete(id)
      toast.success("Account deleted")
      router.replace("/accounts")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete")
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleArchive = async () => {
    if (!account) return
    try {
      if (account.isArchived) {
        await accountService.restore(id)
        toast.success("Account restored")
      } else {
        await accountService.archive(id)
        toast.success("Account archived")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  if (!account) {
    return (
      <div>
        <PageHeader title="Account details" showBack />
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const hasEntries = items.some((item) => item.type === "operation")
  const canDelete = !hasEntries

  return (
    <div>
      <PageHeader
        title={account.name}
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            <Link href={`/accounts/edit?id=${id}`}>
              <Button variant="ghost" size="icon" aria-label="Edit account">
                <Pencil className="h-5 w-5" />
              </Button>
            </Link>
            {canDelete ? (
              <Button variant="ghost" size="icon" aria-label="Delete account" onClick={handleDeleteClick}>
                <Trash2 className="h-5 w-5 text-destructive" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" aria-label={account.isArchived ? "Restore account" : "Archive account"} onClick={handleArchive}>
                <Archive className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
          </div>
        }
      />
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Current balance</div>
              <AmountDisplay cents={account.balance} size="lg" currency={account.currency} />
              {isForeign && cnyCents !== null && (
                <div className="text-sm text-muted-foreground mt-1">
                  ≈{formatAmount(cnyCents)}
                </div>
              )}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{category?.name ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span>{account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening balance</span>
                <span>{formatAmount(account.openingBalance, account.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(account.createdAt)}</span>
              </div>
              {account.note && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Note</span>
                  <span>{account.note}</span>
                </div>
              )}
              {account.isArchived && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-amber-500">Archived</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {items.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">Recent activity</h3>
            <TransactionList items={items} filterAccountId={id} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={canDelete ? "Delete account" : "Cannot delete"}
        description={deleteDesc}
        confirmLabel={canDelete ? "Delete" : "Got it"}
        variant={canDelete ? "destructive" : "default"}
        loading={deleting}
        onConfirm={canDelete ? confirmDelete : () => setDeleteOpen(false)}
      />
    </div>
  )
}
