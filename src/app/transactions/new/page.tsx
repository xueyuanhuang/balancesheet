"use client"

import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/transactions/transaction-form"

export default function NewTransactionPage() {
  return (
    <div>
      <PageHeader title="记账" showBack />
      <TransactionForm mode="create" />
    </div>
  )
}
