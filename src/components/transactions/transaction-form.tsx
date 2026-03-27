"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AmountInput } from "@/components/shared/amount-input"
import { AccountPicker } from "@/components/shared/account-picker"
import { operationService } from "@/lib/services/operation-service"
import { useAccount } from "@/lib/hooks/use-accounts"
import { useCategory } from "@/lib/hooks/use-categories"
import { getCurrencySymbol } from "@/lib/utils/constants"
import { toast } from "sonner"
import type { OperationWithEntries, EntryEffect } from "@/types"

type FormKind = "normal" | "transfer" | "adjustment"

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

  // Transfer state
  const [fromAccountId, setFromAccountId] = useState(sourceEntry?.accountId ?? "")
  const [toAccountId, setToAccountId] = useState(targetEntry?.accountId ?? "")
  const [fromAmount, setFromAmount] = useState(sourceEntry?.amount ?? 0)
  const [toAmount, setToAmount] = useState(targetEntry?.amount ?? 0)
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
          toast.error("请选择转出和转入账户")
          setLoading(false)
          return
        }
        if (fromAmount <= 0) {
          toast.error("请输入转出金额")
          setLoading(false)
          return
        }
        if (showDualAmounts && toAmount <= 0) {
          toast.error("请输入转入金额")
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
          toast.error("请选择账户")
          setLoading(false)
          return
        }
        if (amount <= 0) {
          toast.error("请输入金额")
          setLoading(false)
          return
        }

        // For liability accounts, flip the effect:
        // User sees "支出" (decrease) → store as "increase" (debt goes up)
        // User sees "收入" (increase) → store as "decrease" (debt goes down)
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
      toast.success(mode === "create" ? "记账成功" : "修改成功")
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
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
            <TabsTrigger value="normal" className="flex-1">普通</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1">转账</TabsTrigger>
            <TabsTrigger value="adjustment" className="flex-1">调整</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {kind === "transfer" ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">转出账户</label>
            <AccountPicker
              value={fromAccountId || null}
              onChange={setFromAccountId}
              label="选择转出账户"
              excludeId={toAccountId || undefined}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">转入账户</label>
            <AccountPicker
              value={toAccountId || null}
              onChange={setToAccountId}
              label="选择转入账户"
              excludeId={fromAccountId || undefined}
            />
          </div>

          {/* Amount section */}
          {showDualAmounts ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  转出金额 ({getCurrencySymbol(fromCurrency)})
                </label>
                <AmountInput value={fromAmount} onChange={setFromAmount} currency={fromCurrency} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  转入金额 ({getCurrencySymbol(toCurrency)})
                </label>
                <AmountInput value={toAmount} onChange={setToAmount} currency={toCurrency} />
              </div>
              {fxDisplay && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  汇率: {fxDisplay}
                </div>
              )}
              {!isCrossCurrency && hasFee && fromAmount > 0 && toAmount > 0 && fromAmount !== toAmount && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  手续费: {getCurrencySymbol(fromCurrency)}{((fromAmount - toAmount) / 100).toFixed(2)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">金额</label>
                <AmountInput
                  value={fromAmount}
                  onChange={(v) => { setFromAmount(v); setToAmount(v) }}
                  currency={fromCurrency}
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
                  <span className="text-muted-foreground">含手续费（转出与到账金额不同）</span>
                </label>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">账户</label>
            <AccountPicker value={accountId || null} onChange={setAccountId} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">方向</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={effect === "decrease" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setEffect("decrease")}
              >
                支出
              </Button>
              <Button
                type="button"
                variant={effect === "increase" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setEffect("increase")}
              >
                收入
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">金额</label>
            <AmountInput value={amount} onChange={setAmount} currency={singleCurrency} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">时间</label>
        <Input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">描述</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="可选描述"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "保存中..." : mode === "create" ? "记账" : "保存修改"}
      </Button>
    </form>
  )
}
