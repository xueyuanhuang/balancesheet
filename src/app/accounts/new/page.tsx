"use client"

import { PageHeader } from "@/components/layout/page-header"
import { AccountForm } from "@/components/accounts/account-form"

export default function NewAccountPage() {
  return (
    <div>
      <PageHeader title="新建账户" showBack />
      <AccountForm mode="create" />
    </div>
  )
}
