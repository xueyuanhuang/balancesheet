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
        <PageHeader title="Edit account" showBack />
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Edit account" showBack />
      <AccountForm mode="edit" initialData={account} />
    </div>
  )
}
