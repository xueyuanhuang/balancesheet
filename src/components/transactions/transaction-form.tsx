"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AmountInput, type AmountInputStatus } from "@/components/shared/amount-input"
import { AccountPicker } from "@/components/shared/account-picker"
import { operationService } from "@/lib/services/operation-service"
import { useAccount } from "@/lib/hooks/use-accounts"
import { useCategory } from "@/lib/hooks/use-categories"
import { getCurrencySymbol } from "@/lib/utils/constants"
import { toast } from "sonner"
import type { OperationWithEntries, EntryEffect } from "@/types"

type FormKind = "normal" | "transfer" | "adjustment"

function getAmountError(label: string, cents: number, status: AmountInputStatus | null): string | null {
  if (!status) {
    return cents <= 0 ? `Enter ${label.toLowerCase()}` : null
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
    if (k === "normal") return "normal"
    if (k === "adjustment") return "adjustment"
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
    if (!isCrossCurrency || fromAmount <= 0 || toAmount <= 0) return null
    const rate = (toAmount / fromAmount).toFixed(4)
    return `1 ${fromCurrency} = ${rate} ${toCurrency}`
  }, [isCrossCurrency, fromAmount, toAmount, fromCurrency, toCurrency])

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

        const effectiveToAmount = showDualAmounts ? toAmount : undefined

        if (mode === "create") {
          await operationService.createTransfer({
            fromAccountId,
            toAccountId,
            fromAmount,
            toAmount: effectiveToAmount,
            description,
            occurredAt: timestamp,
          })
        } else if (initialData) {
          await operationService.updateOperation(initialData.operation.id, {
            fromAccountId,
            toAccountId,
            fromAmount,
            toAmount: effectiveToAmount ?? fromAmount,
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

        // For liability accounts, flip the effect:
        // User sees "Expense" (decrease) → store as "increase" (debt goes up)
        // User sees "Income" (increase) → store as "decrease" (debt goes down)
        const storageEffect: EntryEffect = isLiability
          ? (effect === "increase" ? "decrease" : "increase")
          : effect

        if (mode === "create") {
          if (kind === "normal") {
            await operationService.createNormal({
              accountId,
              effect: storageEffect,
              amount,
              description,
              occurredAt: timestamp,
            })
          } else {
            await operationService.createAdjustment({
              accountId,
              effect: storageEffect,
              amount,
              description,
              occurredAt: timestamp,
            })
          }
        } else if (initialData) {
          await operationService.updateOperation(initialData.operation.id, {
            accountId,
            effect: storageEffect,
            amount,
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
    <form onSubmit={handleSubmit} className="p-4 space-y-6">
      {/* Kind selector - only for create mode */}
      {mode === "create" && (
        <Tabs value={kind} onValueChange={(v) => setKind(v as FormKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="normal" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1">Transfer</TabsTrigger>
            <TabsTrigger value="adjustment" className="flex-1">Adjustment</TabsTrigger>
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
            <label className="text-sm font-medium">To account</label>
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
                  Fee: {getCurrencySymbol(fromCurrency)}{((fromAmount - toAmount) / 100).toFixed(2)}
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
                  onStatusChange={setFromAmountStatus}
                />
              </div>
              {/* Fee toggle for same-currency transfers */}
              {!isCrossCurrency && fromAccountId && toAccountId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasFee}
                    onChange={(e) => {
                      setHasFee(e.target.checked)
                      if (!e.target.checked) setToAmount(fromAmount)
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-muted-foreground">Include a fee (sent and received amounts differ)</span>
                </label>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <AccountPicker
              value={accountId || null}
              onChange={setAccountId}
              sortMode={
                kind === "adjustment"
                  ? "recentAdjustment"
                  : effect === "decrease"
                    ? "recentExpense"
                    : "recentIncome"
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Direction</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={effect === "decrease" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setEffect("decrease")}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={effect === "increase" ? "default" : "outline"}
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
  )
}
