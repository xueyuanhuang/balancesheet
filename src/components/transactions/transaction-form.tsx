"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AccountForm } from "@/components/accounts/account-form"
import { Plus } from "lucide-react"
import { AmountInput, type AmountInputStatus } from "@/components/shared/amount-input"
import { AccountPicker } from "@/components/shared/account-picker"
import { operationService } from "@/lib/services/operation-service"
import { useAccount } from "@/lib/hooks/use-accounts"
import { useCategory } from "@/lib/hooks/use-categories"
import { getCurrencySymbol } from "@/lib/utils/constants"
import { normalizeEntryAmount, normalizeTransferAmounts } from "@/lib/utils/transaction-amount"
import { toast } from "sonner"
import type { OperationWithEntries, EntryEffect } from "@/types"

type FormKind = "normal" | "transfer"

function getAmountError(label: string, cents: number, status: AmountInputStatus | null): string | null {
  if (!status) {
    return !Number.isSafeInteger(cents) || cents === 0 ? `Enter ${label.toLowerCase()}` : null
  }

  if (!status.hasInput) {
    return `Enter ${label.toLowerCase()}`
  }

  if (status.error) {
    return `${label}: ${status.error}`
  }

  if (!status.isValid) {
    return `${label}: invalid expression`
  }

  return null
}

interface TransactionFormProps {
  mode: "create" | "edit"
  initialData?: OperationWithEntries
}

export function TransactionForm({ mode, initialData }: TransactionFormProps) {
  const router = useRouter()

  // Derive initial state from OperationWithEntries
  const initKind: FormKind = useMemo(() => {
    if (!initialData) return "normal"
    const k = initialData.operation.kind
    if (k === "normal" || k === "adjustment") return "normal"
    return "transfer" // transfer, fx_transfer, liability_repayment, liability_drawdown
  }, [initialData])

  const sourceEntry = initialData?.entries.find((e) => e.role === "source")
  const targetEntry = initialData?.entries.find((e) => e.role === "target")

  const [kind, setKind] = useState<FormKind>(initKind)

  // Single-entry state
  const [accountId, setAccountId] = useState(sourceEntry?.accountId ?? "")
  const [effect, setEffect] = useState<EntryEffect>(sourceEntry?.effect ?? "decrease")
  const [amount, setAmount] = useState(sourceEntry?.amount ?? 0)
  const [amountStatus, setAmountStatus] = useState<AmountInputStatus | null>(null)

  // Transfer state
  const [fromAccountId, setFromAccountId] = useState(sourceEntry?.accountId ?? "")
  const [toAccountId, setToAccountId] = useState(targetEntry?.accountId ?? "")
  const [fromAmount, setFromAmount] = useState(sourceEntry?.amount ?? 0)
  const [toAmount, setToAmount] = useState(targetEntry?.amount ?? 0)
  const [fromAmountStatus, setFromAmountStatus] = useState<AmountInputStatus | null>(null)
  const [toAmountStatus, setToAmountStatus] = useState<AmountInputStatus | null>(null)
  const [hasFee, setHasFee] = useState(() => {
    // Auto-detect: if editing a same-currency transfer with different amounts, fee mode is on
    if (sourceEntry && targetEntry && sourceEntry.amount !== targetEntry.amount) return true
    return false
  })

  // Common
  const [description, setDescription] = useState(initialData?.operation.description ?? "")
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = initialData?.operation.occurredAt ? new Date(initialData.operation.occurredAt) : new Date()
    // Format as local datetime string for datetime-local input
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [loading, setLoading] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)

  // Look up selected accounts for currency info
  const singleAccount = useAccount(kind !== "transfer" ? accountId || undefined : undefined)
  const fromAccount = useAccount(kind === "transfer" ? fromAccountId || undefined : undefined)
  const toAccount = useAccount(kind === "transfer" ? toAccountId || undefined : undefined)

  // Check if single account is a liability type
  const singleCategory = useCategory(singleAccount?.categoryId)
  const isLiability = singleCategory?.type === "liability"

  // For edit mode: flip displayed effect once when category type loads
  const editEffectAdjusted = useRef(false)
  useEffect(() => {
    if (mode === "edit" && singleCategory && !editEffectAdjusted.current) {
      if (singleCategory.type === "liability") {
        setEffect((e) => (e === "increase" ? "decrease" : "increase"))
      }
      editEffectAdjusted.current = true
    }
  }, [mode, singleCategory])

  const singleCurrency = singleAccount?.currency ?? "CNY"
  const fromCurrency = fromAccount?.currency ?? "CNY"
  const toCurrency = toAccount?.currency ?? "CNY"
  const isCrossCurrency = kind === "transfer" && fromAccountId && toAccountId && fromCurrency !== toCurrency
  const showDualAmounts = isCrossCurrency || (kind === "transfer" && hasFee)

  // Compute display exchange rate (only for cross-currency)
  const fxDisplay = useMemo(() => {
    if (!isCrossCurrency || !fromAmount || !toAmount) return null
    const rate = Math.abs(toAmount / fromAmount).toFixed(4)
    return `1 ${fromCurrency} = ${rate} ${toCurrency}`
  }, [isCrossCurrency, fromAmount, toAmount, fromCurrency, toCurrency])

  const commitSingleAmount = (cents: number) => {
    if (cents >= 0) return
    const normalized = normalizeEntryAmount(cents, effect)
    setAmount(normalized.amount)
    setEffect(normalized.effect)
    setAmountStatus(null)
    toast.info(normalized.effect === "increase" ? "Changed to income" : "Changed to expense")
  }

  const commitTransferAmounts = () => {
    // Keep the source in place while choosing or creating the destination.
    if (!fromAccountId || !toAccountId) return
    if (fromAmount >= 0 && (!showDualAmounts || toAmount >= 0)) return
    // Wait for both fields to be complete before reversing an FX/fee transfer.
    if (getAmountError("Amount sent", fromAmount, fromAmountStatus) ||
      (showDualAmounts && getAmountError("Amount received", toAmount, toAmountStatus))) return
    const normalized = normalizeTransferAmounts({
      fromAccountId, toAccountId, fromAmount,
      toAmount: showDualAmounts ? toAmount : undefined,
    })
    setFromAccountId(normalized.fromAccountId)
    setToAccountId(normalized.toAccountId)
    setFromAmount(normalized.fromAmount)
    setToAmount(normalized.toAmount)
    setFromAmountStatus(null)
    setToAmountStatus(null)
    toast.info("Transfer direction reversed")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const timestamp = new Date(occurredAt).getTime()
    setLoading(true)

    try {
      if (kind === "transfer") {
        if (!fromAccountId || !toAccountId) {
          toast.error("Select the source and destination accounts")
          setLoading(false)
          return
        }
        const fromAmountError = getAmountError("Amount sent", fromAmount, fromAmountStatus)
        if (fromAmountError) {
          toast.error(fromAmountError)
          setLoading(false)
          return
        }
        const toAmountError = showDualAmounts
          ? getAmountError("Amount received", toAmount, toAmountStatus)
          : null
        if (toAmountError) {
          toast.error(toAmountError)
          setLoading(false)
          return
        }

        const normalized = normalizeTransferAmounts({
          fromAccountId, toAccountId, fromAmount,
          toAmount: showDualAmounts ? toAmount : undefined,
        })

        if (mode === "create") {
          await operationService.createTransfer({
            ...normalized,
            description,
            occurredAt: timestamp,
          })
        } else if (initialData) {
          await operationService.updateOperation(initialData.operation.id, {
            ...normalized,
            description,
            occurredAt: timestamp,
          })
        }
      } else {
        if (!accountId) {
          toast.error("Select an account")
          setLoading(false)
          return
        }
        const amountError = getAmountError("Amount", amount, amountStatus)
        if (amountError) {
          toast.error(amountError)
          setLoading(false)
          return
        }

        const normalized = normalizeEntryAmount(amount, effect)
        // For liability accounts, flip the effect:
        // User sees "Expense" (decrease) → store as "increase" (debt goes up)
        // User sees "Income" (increase) → store as "decrease" (debt goes down)
        const storageEffect: EntryEffect = isLiability
          ? (normalized.effect === "increase" ? "decrease" : "increase")
          : normalized.effect

        if (mode === "create") {
          await operationService.createNormal({
            accountId,
            effect: storageEffect,
            amount: normalized.amount,
            description,
            occurredAt: timestamp,
          })
        } else if (initialData) {
          await operationService.updateOperation(initialData.operation.id, {
            accountId,
            effect: storageEffect,
            amount: normalized.amount,
            description,
            occurredAt: timestamp,
          })
        }
      }
      toast.success(mode === "create" ? "Transaction saved" : "Changes saved")
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={creatingAccount} onOpenChange={(open) => { if (!savingAccount) setCreatingAccount(open) }}>
    <form onSubmit={handleSubmit} className="p-4 space-y-6">
      {/* Kind selector - only for create mode */}
      {mode === "create" && (
        <Tabs value={kind} onValueChange={(v) => setKind(v as FormKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="normal" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {kind === "transfer" ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">From account</label>
            <AccountPicker
              value={fromAccountId || null}
              onChange={setFromAccountId}
              label="Select source account"
              excludeId={toAccountId || undefined}
              sortMode="recentTransferSource"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">To account</label>
              <DialogTrigger render={<Button type="button" variant="ghost" size="sm" disabled={loading} />}>
                <Plus className="size-4" />
                New account
              </DialogTrigger>
            </div>
            <AccountPicker
              value={toAccountId || null}
              onChange={setToAccountId}
              label="Select destination account"
              excludeId={fromAccountId || undefined}
              sortMode="recentTransferTarget"
            />
          </div>

          {/* Amount section */}
          {showDualAmounts ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amount sent ({getCurrencySymbol(fromCurrency)})
                </label>
                <AmountInput
                  value={fromAmount}
                  onChange={setFromAmount}
                  currency={fromCurrency}
                  enableExpression
                  allowNegative
                  onCommit={commitTransferAmounts}
                  ariaLabel="Amount sent"
                  onStatusChange={setFromAmountStatus}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amount received ({getCurrencySymbol(toCurrency)})
                </label>
                <AmountInput
                  value={toAmount}
                  onChange={setToAmount}
                  currency={toCurrency}
                  enableExpression
                  allowNegative
                  onCommit={commitTransferAmounts}
                  ariaLabel="Amount received"
                  onStatusChange={setToAmountStatus}
                />
              </div>
              {fxDisplay && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  Exchange rate: {fxDisplay}
                </div>
              )}
              {!isCrossCurrency && hasFee && fromAmount > 0 && toAmount > 0 && fromAmount !== toAmount && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  {fromAmount > toAmount ? "Fee" : "Fee refund"}: {getCurrencySymbol(fromCurrency)}{(Math.abs(fromAmount - toAmount) / 100).toFixed(2)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <AmountInput
                  value={fromAmount}
                  onChange={(v) => { setFromAmount(v); setToAmount(v) }}
                  currency={fromCurrency}
                  enableExpression
                  allowNegative
                  onCommit={commitTransferAmounts}
                  onStatusChange={setFromAmountStatus}
                />
              </div>

            </>
          )}
          {/* Fee toggle for same-currency transfers */}
          {!isCrossCurrency && fromAccountId && toAccountId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasFee}
                onChange={(e) => {
                  setHasFee(e.target.checked)
                  if (!e.target.checked) {
                    setToAmount(fromAmount)
                    setToAmountStatus(null)
                  }
                }}
                className="rounded border-gray-300"
              />
              <span className="text-muted-foreground">Include a fee (sent and received amounts differ)</span>
            </label>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <AccountPicker
              value={accountId || null}
              onChange={setAccountId}
              sortMode={effect === "decrease" ? "recentExpense" : "recentIncome"}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Direction</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={effect === "decrease" ? "default" : "outline"}
                aria-pressed={effect === "decrease"}
                className="flex-1"
                onClick={() => setEffect("decrease")}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={effect === "increase" ? "default" : "outline"}
                aria-pressed={effect === "increase"}
                className="flex-1"
                onClick={() => setEffect("increase")}
              >
                Income
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <AmountInput
              value={amount}
              onChange={setAmount}
              currency={singleCurrency}
              enableExpression
              allowNegative
              onCommit={commitSingleAmount}
              onStatusChange={setAmountStatus}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Date and time</label>
        <Input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : mode === "create" ? "Add transaction" : "Save changes"}
      </Button>
    </form>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!savingAccount}>
        <DialogHeader>
          <DialogTitle>New destination account</DialogTitle>
          <DialogDescription>Create an account, then continue your transfer.</DialogDescription>
        </DialogHeader>
        {creatingAccount && (
          <div className="-mx-4">
            <AccountForm
              mode="create"
              defaultCurrency={fromCurrency}
              onCreated={(id) => {
                setToAccountId(id)
                setCreatingAccount(false)
              }}
              onCancel={() => setCreatingAccount(false)}
              onSavingChange={setSavingAccount}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
