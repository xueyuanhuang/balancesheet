"use client"

import { PageHeader } from "@/components/layout/page-header"
import { AccountForm } from "@/components/accounts/account-form"

export default function NewAccountPage() {
  return (
    <div>
      <PageHeader title="New account" showBack />
      <AccountForm mode="create" />
    </div>
  )
}
