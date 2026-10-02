import { db } from "@/lib/db"
import { generateId } from "@/lib/utils/id"
import { accountService } from "./account-service"
import { normalizeEntryAmount, normalizeTransferAmounts } from "@/lib/utils/transaction-amount"
import type { Operation, Entry, EntryEffect, OperationKind, OperationWithEntries } from "@/types"

export interface TransferAccountDraft {
  id: string
  name: string
  categoryId: string
  currency: string
  note?: string
}

export interface TransferData {
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  toAmount?: number
  description?: string
  occurredAt: number
  newAccount?: TransferAccountDraft
  newAccounts?: TransferAccountDraft[]
}

export const operationService = {
  // ─── Queries ───

  async getAll(): Promise<Operation[]> {
    return db.operations.orderBy("occurredAt").reverse().toArray()
  },

  async getById(id: string): Promise<Operation | undefined> {
    return db.operations.get(id)
  },

  async getByAccountId(accountId: string): Promise<Operation[]> {
    const entries = await db.entries.where("accountId").equals(accountId).toArray()
    const opIds = [...new Set(entries.map((e) => e.operationId))]
    if (opIds.length === 0) return []
    const ops = await db.operations.where("id").anyOf(opIds).toArray()
    return ops.sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
  },

  async getWithEntries(operationId: string): Promise<OperationWithEntries | undefined> {
    const operation = await db.operations.get(operationId)
    if (!operation) return undefined
    const entries = await db.entries.where("operationId").equals(operationId).toArray()
    return { operation, entries }
  },

  async getAllWithEntries(): Promise<OperationWithEntries[]> {
    const operations = await db.operations.orderBy("occurredAt").reverse().toArray()
    const entries = await db.entries.toArray()
    const entryMap = new Map<string, Entry[]>()
    for (const entry of entries) {
      const list = entryMap.get(entry.operationId) ?? []
      list.push(entry)
      entryMap.set(entry.operationId, list)
    }
    return operations.map((op) => ({
      operation: op,
      entries: entryMap.get(op.id) ?? [],
    }))
  },

  async getWithEntriesByAccountId(accountId: string): Promise<OperationWithEntries[]> {
    const accountEntries = await db.entries.where("accountId").equals(accountId).toArray()
    const opIds = [...new Set(accountEntries.map((e) => e.operationId))]
    if (opIds.length === 0) return []

    const operations = await db.operations.where("id").anyOf(opIds).toArray()
    const allEntries = await db.entries.where("operationId").anyOf(opIds).toArray()
    const entryMap = new Map<string, Entry[]>()
    for (const entry of allEntries) {
      const list = entryMap.get(entry.operationId) ?? []
      list.push(entry)
      entryMap.set(entry.operationId, list)
    }

    return operations
      .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt)
      .map((op) => ({
        operation: op,
        entries: entryMap.get(op.id) ?? [],
      }))
  },

  // ─── Creates ───

  async createNormal(data: {
    accountId: string
    effect: EntryEffect
    amount: number
    description?: string
    occurredAt: number
  }): Promise<string> {
    data = { ...data, ...normalizeEntryAmount(data.amount, data.effect) }
    const now = Date.now()
    const opId = generateId()
    const entryId = generateId()

    await db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      await db.operations.add({
        id: opId,
        kind: "normal",
        description: data.description ?? "",
        occurredAt: data.occurredAt,
        fxRate: null,
        fxBaseCurrency: null,
        fxQuoteCurrency: null,
        createdAt: now,
        updatedAt: now,
      })
      await db.entries.add({
        id: entryId,
        operationId: opId,
        accountId: data.accountId,
        role: "source",
        effect: data.effect,
        amount: data.amount,
        createdAt: now,
        updatedAt: now,
      })
      await accountService.recalculateBalance(data.accountId)
    })

    return opId
  },

  async createTransfer(data: TransferData): Promise<string> {
    const receivedAmountProvided = data.toAmount !== undefined
    const normalized = normalizeTransferAmounts(data)
    if (normalized.fromAccountId === normalized.toAccountId) {
      throw new Error("Choose different source and destination accounts")
    }
    requireDate(data.occurredAt)

    const now = Date.now()
    const opId = generateId()
    await db.transaction("rw", [db.operations, db.entries, db.accounts, db.categories], async () => {
      const createdAccountIds = await createTransferAccounts(data, normalized, now)
      const fromAccount = await db.accounts.get(normalized.fromAccountId)
      const toAccount = await db.accounts.get(normalized.toAccountId)
      if (!fromAccount) throw new Error("Source account not found")
      if (!toAccount) throw new Error("Destination account not found")
      const sameCurrency = fromAccount.currency === toAccount.currency
      if (!sameCurrency && !receivedAmountProvided) {
        throw new Error("Enter the received amount for a cross-currency transfer")
      }
      const fromCategory = await db.categories.get(fromAccount.categoryId)
      const toCategory = await db.categories.get(toAccount.categoryId)
      if (!fromCategory || !toCategory) throw new Error("Account category not found")
      const { kind, fromEffect, toEffect } = determineKindAndEffects(
        fromCategory.type, toCategory.type, sameCurrency
      )

      await db.operations.add({
        id: opId,
        kind,
        description: data.description ?? "",
        occurredAt: data.occurredAt,
        fxRate: sameCurrency ? null : normalized.toAmount / normalized.fromAmount,
        fxBaseCurrency: sameCurrency ? null : fromAccount.currency,
        fxQuoteCurrency: sameCurrency ? null : toAccount.currency,
        ...(createdAccountIds.length > 0 ? { createdAccountIds } : {}),
        createdAt: now,
        updatedAt: now,
      })
      await db.entries.bulkAdd([
        {
          id: generateId(), operationId: opId, accountId: normalized.fromAccountId,
          role: "source" as const, effect: fromEffect, amount: normalized.fromAmount,
          createdAt: now, updatedAt: now,
        },
        {
          id: generateId(), operationId: opId, accountId: normalized.toAccountId,
          role: "target" as const, effect: toEffect, amount: normalized.toAmount,
          createdAt: now, updatedAt: now,
        },
      ])
      await accountService.recalculateBalance(normalized.fromAccountId)
      await accountService.recalculateBalance(normalized.toAccountId)
    })
    return opId
  },

  // ─── Update ───

  async updateOperation(
    operationId: string,
    data: {
      accountId?: string
      effect?: EntryEffect
      fromAccountId?: string
      toAccountId?: string
      fromAmount?: number
      toAmount?: number
      amount?: number
      description?: string
      occurredAt?: number
      removeAccountIds?: string[]
      newAccount?: TransferAccountDraft
      newAccounts?: TransferAccountDraft[]
    }
  ): Promise<void> {
    await db.transaction("rw", [db.operations, db.entries, db.accounts, db.categories], async () => {
      const existing = await db.operations.get(operationId)
      if (!existing) throw new Error("Transaction not found")
      const oldEntries = await db.entries.where("operationId").equals(operationId).toArray()
      const oldAccountIds = [...new Set(oldEntries.map((e) => e.accountId))]
      const removeAccountIds = [...new Set(data.removeAccountIds ?? [])]
      const isMultiEntry = existing.kind !== "normal" && existing.kind !== "adjustment"
      if (data.occurredAt !== undefined) requireDate(data.occurredAt)

      if (removeAccountIds.length > 0 && !isMultiEntry) {
        throw new Error("Accounts can only be removed when correcting a transfer")
      }
      if (!isMultiEntry && (data.newAccount || data.newAccounts?.length)) {
        throw new Error("Accounts can only be created as part of a transfer")
      }
      for (const accountId of removeAccountIds) {
        if (!oldAccountIds.includes(accountId)) {
          throw new Error("Only a previous account in this transfer can be removed")
        }
        if (accountId === data.fromAccountId || accountId === data.toAccountId) {
          throw new Error("Choose a different account before removing the previous account")
        }
      }
      const now = Date.now()

      // Delete old entries
      await db.entries.where("operationId").equals(operationId).delete()

      if (isMultiEntry) {
        // Transfer-like operation
        const { fromAccountId, toAccountId, fromAmount, toAmount } = normalizeTransferAmounts({
          fromAccountId: data.fromAccountId!,
          toAccountId: data.toAccountId!,
          fromAmount: data.fromAmount!,
          toAmount: data.toAmount,
        })
        if (fromAccountId === toAccountId) {
          throw new Error("Choose different source and destination accounts")
        }
        const newAccountIds = await createTransferAccounts(data, { fromAccountId, toAccountId }, now)
        // Only provenance that still belongs to an actual previous endpoint
        // may authorize automatic cleanup. Existing accounts are never inferred.
        const ownedAccountIds = [...new Set(existing.createdAccountIds ?? [])]
          .filter((id) => oldAccountIds.includes(id))
        const createdAccountIds = [...new Set([
          ...ownedAccountIds.filter((id) => id === fromAccountId || id === toAccountId),
          ...newAccountIds,
        ])]

        const fromAccount = await db.accounts.get(fromAccountId)
        const toAccount = await db.accounts.get(toAccountId)
        if (!fromAccount || !toAccount) throw new Error("Account not found")

        const sameCurrency = fromAccount.currency === toAccount.currency
        if (!sameCurrency && data.toAmount === undefined) {
          throw new Error("Enter the received amount for a cross-currency transfer")
        }
        const fromCategory = await db.categories.get(fromAccount.categoryId)
        const toCategory = await db.categories.get(toAccount.categoryId)
        if (!fromCategory || !toCategory) throw new Error("Account category not found")

        const { kind, fromEffect, toEffect } = determineKindAndEffects(
          fromCategory.type,
          toCategory.type,
          sameCurrency
        )

        const fxRate = sameCurrency ? null : toAmount / fromAmount
        const fxBaseCurrency = sameCurrency ? null : fromAccount.currency
        const fxQuoteCurrency = sameCurrency ? null : toAccount.currency

        await db.operations.update(operationId, {
          kind,
          description: data.description ?? existing.description,
          occurredAt: data.occurredAt ?? existing.occurredAt,
          fxRate,
          fxBaseCurrency,
          fxQuoteCurrency,
          createdAccountIds,
          updatedAt: now,
        })

        await db.entries.bulkAdd([
          {
            id: generateId(),
            operationId,
            accountId: fromAccountId,
            role: "source" as const,
            effect: fromEffect,
            amount: fromAmount,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: generateId(),
            operationId,
            accountId: toAccountId,
            role: "target" as const,
            effect: toEffect,
            amount: toAmount,
            createdAt: now,
            updatedAt: now,
          },
        ])

        // Recalculate all affected accounts
        const allAccountIds = [...new Set([...oldAccountIds, fromAccountId, toAccountId])]
        for (const accId of allAccountIds) {
          await accountService.recalculateBalance(accId)
        }

        // All-or-nothing: a concurrent/new transaction must prevent cleanup,
        // and roll back the transfer correction rather than leave a partial save.
        for (const accountId of removeAccountIds) {
          const account = await db.accounts.get(accountId)
          if (!account) throw new Error("The previous account no longer exists")
          const entryCount = await db.entries.where("accountId").equals(accountId).count()
          if (entryCount > 0) {
            throw new Error(`"${account.name}" has other transactions. Keep the account to save this transfer.`)
          }
          await db.accounts.delete(accountId)
        }
        // Replacing an account created for this transfer also undoes its
        // creation. Reused accounts or accounts with an opening balance survive
        // and relinquish ownership so a
        // later edit cannot remove them after their other activity is deleted.
        for (const accountId of ownedAccountIds) {
          if (accountId === fromAccountId || accountId === toAccountId) continue
          const account = await db.accounts.get(accountId)
          if (account?.openingBalance === 0 && await db.entries.where("accountId").equals(accountId).count() === 0) {
            await db.accounts.delete(accountId)
          }
        }
      } else {
        // Single-entry operation (normal/adjustment)
        const accountId = data.accountId ?? oldEntries[0]?.accountId
        const { effect, amount } = normalizeEntryAmount(
          data.amount ?? oldEntries[0]?.amount ?? 0,
          data.effect ?? oldEntries[0]?.effect ?? "decrease"
        )

        await db.operations.update(operationId, {
          description: data.description ?? existing.description,
          occurredAt: data.occurredAt ?? existing.occurredAt,
          updatedAt: now,
        })

        await db.entries.add({
          id: generateId(),
          operationId,
          accountId,
          role: "source",
          effect,
          amount,
          createdAt: now,
          updatedAt: now,
        })

        // Recalculate all affected accounts
        const allAccountIds = [...new Set([...oldAccountIds, accountId])]
        for (const accId of allAccountIds) {
          await accountService.recalculateBalance(accId)
        }
      }
    })
  },

  // ─── Delete ───

  async deleteOperation(operationId: string): Promise<string[]> {
    return db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      const operation = await db.operations.get(operationId)
      if (!operation) throw new Error("Transaction not found")
      const entries = await db.entries.where("operationId").equals(operationId).toArray()
      const accountIds = [...new Set(entries.map((e) => e.accountId))]
      await db.entries.where("operationId").equals(operationId).delete()
      await db.operations.delete(operationId)
      const deletedAccountIds: string[] = []
      const isTransfer = operation.kind !== "normal" && operation.kind !== "adjustment"
      for (const accId of accountIds) {
        const account = await db.accounts.get(accId)
        if (isTransfer && operation.createdAccountIds?.includes(accId) && account?.openingBalance === 0 &&
          await db.entries.where("accountId").equals(accId).count() === 0) {
          await db.accounts.delete(accId)
          deletedAccountIds.push(accId)
          continue
        }
        await accountService.recalculateBalance(accId)
      }
      return deletedAccountIds
    })
  },
}

// ─── Helpers ───

function requireDate(occurredAt: number) {
  if (!Number.isFinite(occurredAt) || !Number.isFinite(new Date(occurredAt).getTime())) {
    throw new Error("Enter a valid transaction date")
  }
}

async function createTransferAccounts(
  data: { newAccount?: TransferAccountDraft; newAccounts?: TransferAccountDraft[] },
  endpoints: { fromAccountId: string; toAccountId: string },
  now: number
): Promise<string[]> {
  const drafts = [...(data.newAccounts ?? []), ...(data.newAccount ? [data.newAccount] : [])]
  const ids = new Set<string>()
  for (const draft of drafts) {
    if (typeof draft.id !== "string" || !draft.id.trim() || ids.has(draft.id)) {
      throw new Error("Each new account must have a unique ID")
    }
    ids.add(draft.id)
    if (draft.id !== endpoints.fromAccountId && draft.id !== endpoints.toAccountId) {
      throw new Error("A new account must be selected in this transfer")
    }
    if (typeof draft.name !== "string" || !draft.name.trim() || draft.name.trim().length > 30) {
      throw new Error("Enter an account name of 1 to 30 characters")
    }
    if (typeof draft.currency !== "string" || !/^[A-Z]{3}$/.test(draft.currency)) {
      throw new Error("Select a valid account currency")
    }
    if (draft.note !== undefined && typeof draft.note !== "string") {
      throw new Error("Enter a valid account note")
    }
    if (await db.accounts.get(draft.id)) {
      throw new Error("This account already exists. Select it from your accounts instead.")
    }
    if (typeof draft.categoryId !== "string" || !draft.categoryId) {
      throw new Error("Select an account category")
    }
    const category = await db.categories.get(draft.categoryId)
    if (!category || category.isArchived) throw new Error("Account category not found")
    const siblings = await db.accounts.where("categoryId").equals(draft.categoryId).toArray()
    const sortOrder = siblings.length ? Math.max(...siblings.map((account) => account.sortOrder)) + 1 : 0
    await db.accounts.add({
      id: draft.id,
      name: draft.name.trim(),
      categoryId: draft.categoryId,
      currency: draft.currency,
      note: draft.note ?? "",
      openingBalance: 0,
      balance: 0,
      isArchived: false,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    await db.categories.update(draft.categoryId, { usageCount: (category.usageCount ?? 0) + 1 })
  }
  return [...ids]
}

function determineKindAndEffects(
  fromType: "asset" | "liability",
  toType: "asset" | "liability",
  sameCurrency: boolean
): { kind: OperationKind; fromEffect: EntryEffect; toEffect: EntryEffect } {
  if (fromType === "asset" && toType === "liability") {
    // Asset → Liability = repayment: asset decreases, liability decreases
    return {
      kind: "liability_repayment",
      fromEffect: "decrease",
      toEffect: "decrease",
    }
  }
  if (fromType === "liability" && toType === "asset") {
    // Liability → Asset = drawdown: liability increases, asset increases
    return {
      kind: "liability_drawdown",
      fromEffect: "increase",
      toEffect: "increase",
    }
  }
  // Same type: standard transfer
  return {
    kind: sameCurrency ? "transfer" : "fx_transfer",
    fromEffect: "decrease",
    toEffect: "increase",
  }
}
