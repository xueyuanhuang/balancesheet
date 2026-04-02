"use client"

import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { AccountForm } from "@/components/accounts/account-form"
import { useAccount } from "@/lib/hooks/use-accounts"

export default function EditAccountPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") ?? ""
  const account = useAccount(id || undefined)

  if (!account) {
    return (
      <div>
        <PageHeader title="编辑账户" showBack />
        <div className="p-4 text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="编辑账户" showBack />
      <AccountForm mode="edit" initialData={account} />
    </div>
  )
}
