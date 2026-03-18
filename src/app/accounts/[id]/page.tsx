"use client"

import { use, useState } from "react"
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
import { useOperations } from "@/lib/hooks/use-operations"
import { useRateMap } from "@/lib/hooks/use-exchange-rates"
import { accountService } from "@/lib/services/account-service"
import { formatAmount, formatDate } from "@/lib/utils/format"
import { convertToCNY } from "@/lib/utils/currency"
import { toast } from "sonner"

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const account = useAccount(id)
  const category = useCategory(account?.categoryId)
  const operations = useOperations({ accountId: id })
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
      setDeleteDesc(`该账户已有 ${info.entryCount} 条流水记录，无法删除。请使用归档功能。`)
      setDeleteOpen(true)
    } else {
      setDeleteDesc(`确定要删除账户「${account.name}」吗？此操作不可撤销。`)
      setDeleteOpen(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await accountService.delete(id)
      toast.success("已删除账户")
      router.replace("/accounts")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
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
        toast.success("已取消归档")
      } else {
        await accountService.archive(id)
        toast.success("已归档账户")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  if (!account) {
    return (
      <div>
        <PageHeader title="账户详情" showBack />
        <div className="p-4 text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  const hasEntries = operations.length > 0
  const canDelete = !hasEntries

  return (
    <div>
      <PageHeader
        title={account.name}
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            <Link href={`/accounts/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-5 w-5" />
              </Button>
            </Link>
            {canDelete ? (
              <Button variant="ghost" size="icon" onClick={handleDeleteClick}>
                <Trash2 className="h-5 w-5 text-destructive" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={handleArchive}>
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
              <div className="text-sm text-muted-foreground mb-1">当前余额</div>
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
                <span className="text-muted-foreground">分类</span>
                <span>{category?.name ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">币种</span>
                <span>{account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">初始余额</span>
                <span>{formatAmount(account.openingBalance, account.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建日期</span>
                <span>{formatDate(account.createdAt)}</span>
              </div>
              {account.note && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">备注</span>
                  <span>{account.note}</span>
                </div>
              )}
              {account.isArchived && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <span className="text-amber-500">已归档</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent operations */}
        {operations.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">最近流水</h3>
            <TransactionList operations={operations} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={canDelete ? "删除账户" : "无法删除"}
        description={deleteDesc}
        confirmLabel={canDelete ? "删除" : "知道了"}
        variant={canDelete ? "destructive" : "default"}
        loading={deleting}
        onConfirm={canDelete ? confirmDelete : () => setDeleteOpen(false)}
      />
    </div>
  )
}
