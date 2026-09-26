"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AmountInput } from "@/components/shared/amount-input"
import { accountService } from "@/lib/services/account-service"
import { toast } from "sonner"
import type { Account } from "@/types"

export function OpeningRecordEditor({ account }: { account: Account }) {
  const router = useRouter()
  const [amount, setAmount] = useState(account.openingBalance)
  const [note, setNote] = useState(account.note)
  const [saving, setSaving] = useState(false)

  const saveOpening = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!Number.isSafeInteger(amount)) {
      toast.error("Enter a valid opening balance")
      return
    }
    setSaving(true)
    try {
      await accountService.update(account.id, { openingBalance: amount, note })
      toast.success("Changes saved")
      router.replace("/transactions")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes")
    } finally {
      setSaving(false)
    }
  }

  return (
        <form onSubmit={saveOpening} className="p-4 space-y-6">
          <div className="text-sm font-medium">{account.name}</div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Opening balance</label>
            <AmountInput value={amount} onChange={setAmount} currency={account.currency} allowNegative ariaLabel="Opening balance" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} aria-label="Note" placeholder="Optional note" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </form>
  )
}
