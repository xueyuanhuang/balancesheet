import { db } from "@/lib/db"
import { generateId } from "@/lib/utils/id"
import { accountService } from "./account-service"
import type { Operation, Entry, EntryEffect, OperationKind, OperationWithEntries } from "@/types"

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

  async createAdjustment(data: {
    accountId: string
    effect: EntryEffect
    amount: number
    description?: string
    occurredAt: number
  }): Promise<string> {
    const now = Date.now()
    const opId = generateId()
    const entryId = generateId()

    await db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      await db.operations.add({
        id: opId,
        kind: "adjustment",
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

  async createTransfer(data: {
    fromAccountId: string
    toAccountId: string
    fromAmount: number
    toAmount?: number
    description?: string
    occurredAt: number
  }): Promise<string> {
    if (data.fromAccountId === data.toAccountId) {
      throw new Error("转出和转入账户不能相同")
    }

    const fromAccount = await db.accounts.get(data.fromAccountId)
    const toAccount = await db.accounts.get(data.toAccountId)
    if (!fromAccount) throw new Error("转出账户不存在")
    if (!toAccount) throw new Error("转入账户不存在")

    const sameCurrency = fromAccount.currency === toAccount.currency
    const toAmount = data.toAmount ?? data.fromAmount

    if (!sameCurrency) {
      if (!data.toAmount || data.toAmount <= 0) {
        throw new Error("跨币种转账必须指定转入金额")
      }
    }

    // Determine kind and effects based on account types
    const fromCategory = await db.categories.get(fromAccount.categoryId)
    const toCategory = await db.categories.get(toAccount.categoryId)
    if (!fromCategory || !toCategory) throw new Error("账户分类不存在")

    const { kind, fromEffect, toEffect } = determineKindAndEffects(
      fromCategory.type,
      toCategory.type,
      sameCurrency
    )

    const now = Date.now()
    const opId = generateId()

    await db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      const fxRate = sameCurrency ? null : toAmount / data.fromAmount
      const fxBaseCurrency = sameCurrency ? null : fromAccount.currency
      const fxQuoteCurrency = sameCurrency ? null : toAccount.currency

      await db.operations.add({
        id: opId,
        kind,
        description: data.description ?? "",
        occurredAt: data.occurredAt,
        fxRate,
        fxBaseCurrency,
        fxQuoteCurrency,
        createdAt: now,
        updatedAt: now,
      })

      await db.entries.bulkAdd([
        {
          id: generateId(),
          operationId: opId,
          accountId: data.fromAccountId,
          role: "source" as const,
          effect: fromEffect,
          amount: data.fromAmount,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: generateId(),
          operationId: opId,
          accountId: data.toAccountId,
          role: "target" as const,
          effect: toEffect,
          amount: toAmount,
          createdAt: now,
          updatedAt: now,
        },
      ])

      await accountService.recalculateBalance(data.fromAccountId)
      await accountService.recalculateBalance(data.toAccountId)
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
    }
  ): Promise<void> {
    const existing = await db.operations.get(operationId)
    if (!existing) throw new Error("操作不存在")

    const oldEntries = await db.entries.where("operationId").equals(operationId).toArray()
    const oldAccountIds = [...new Set(oldEntries.map((e) => e.accountId))]

    await db.transaction("rw", [db.operations, db.entries, db.accounts, db.categories], async () => {
      const now = Date.now()

      // Delete old entries
      await db.entries.where("operationId").equals(operationId).delete()

      const isMultiEntry = existing.kind !== "normal" && existing.kind !== "adjustment"

      if (isMultiEntry) {
        // Transfer-like operation
        const fromAccountId = data.fromAccountId!
        const toAccountId = data.toAccountId!
        const fromAmount = data.fromAmount!
        const toAmount = data.toAmount ?? fromAmount

        const fromAccount = await db.accounts.get(fromAccountId)
        const toAccount = await db.accounts.get(toAccountId)
        if (!fromAccount || !toAccount) throw new Error("账户不存在")

        const sameCurrency = fromAccount.currency === toAccount.currency
        const fromCategory = await db.categories.get(fromAccount.categoryId)
        const toCategory = await db.categories.get(toAccount.categoryId)
        if (!fromCategory || !toCategory) throw new Error("账户分类不存在")

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
      } else {
        // Single-entry operation (normal/adjustment)
        const accountId = data.accountId ?? oldEntries[0]?.accountId
        const effect = data.effect ?? oldEntries[0]?.effect ?? "decrease"
        const amount = data.amount ?? oldEntries[0]?.amount ?? 0

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

  async deleteOperation(operationId: string): Promise<void> {
    const entries = await db.entries.where("operationId").equals(operationId).toArray()
    const accountIds = [...new Set(entries.map((e) => e.accountId))]

    await db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      await db.entries.where("operationId").equals(operationId).delete()
      await db.operations.delete(operationId)
      for (const accId of accountIds) {
        await accountService.recalculateBalance(accId)
      }
    })
  },
}

// ─── Helpers ───

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
