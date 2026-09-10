import type { EntryEffect } from "@/types"

function requireAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error("Enter a nonzero amount within the supported range")
  }
}

export function normalizeEntryAmount(amount: number, effect: EntryEffect) {
  requireAmount(amount)
  return {
    amount: Math.abs(amount),
    effect: amount < 0 ? (effect === "increase" ? "decrease" : "increase") as EntryEffect : effect,
  }
}

export function normalizeTransferAmounts(data: {
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  toAmount?: number
}) {
  const received = data.toAmount ?? data.fromAmount
  requireAmount(data.fromAmount)
  requireAmount(received)
  const reversed = data.fromAmount < 0 || received < 0

  // A minus sign on either side reverses the whole transfer once. Each
  // amount stays with its account, including for FX and unequal amounts.
  return reversed ? {
    fromAccountId: data.toAccountId,
    toAccountId: data.fromAccountId,
    fromAmount: Math.abs(received),
    toAmount: Math.abs(data.fromAmount),
  } : { ...data, toAmount: received }
}
