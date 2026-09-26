import { db } from "@/lib/db"
import { accountService } from "./account-service"
import { operationService } from "./operation-service"

export interface ActivityDeleteTarget {
  type: "operation" | "opening_balance"
  id: string
}

export interface ActivityDeletePreview {
  target: ActivityDeleteTarget
  title: string
  description: string
  confirmLabel: string
  // The exact state described by the confirmation. Rechecked before any write.
  expectedState: string
}

export const activityService = {
  async getDeletePreview(target: ActivityDeleteTarget): Promise<ActivityDeletePreview> {
    return db.transaction("r", [db.operations, db.entries, db.accounts], () => buildDeletePreview(target))
  },

  async deleteRecord(preview: ActivityDeletePreview): Promise<{ deletedAccountIds: string[] }> {
    return db.transaction("rw", [db.operations, db.entries, db.accounts], async () => {
      const current = await buildDeletePreview(preview.target)
      if (current.expectedState !== preview.expectedState) {
        throw new Error("This record changed. Close this confirmation and try deleting it again.")
      }
      if (preview.target.type === "operation") {
        return { deletedAccountIds: await operationService.deleteOperation(preview.target.id) }
      }
      const accountId = preview.target.id
      const entryCount = await db.entries.where("accountId").equals(accountId).count()
      if (entryCount === 0) {
        await db.accounts.delete(accountId)
        return { deletedAccountIds: [accountId] }
      }
      await db.accounts.update(accountId, { openingBalance: 0, updatedAt: Date.now() })
      await accountService.recalculateBalance(accountId)
      return { deletedAccountIds: [] }
    })
  },
}

async function buildDeletePreview(target: ActivityDeleteTarget): Promise<ActivityDeletePreview> {
  if (target.type === "opening_balance") {
    const account = await db.accounts.get(target.id)
    if (!account || account.openingBalance === 0) throw new Error("Opening balance record not found")
    const entries = await db.entries.where("accountId").equals(account.id).sortBy("id")
    const amount = `${account.currency} ${(account.openingBalance / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`
    const deletesAccount = entries.length === 0
    return {
      target: { ...target },
      title: deletesAccount ? "Delete account and opening balance?" : "Delete opening balance?",
      description: deletesAccount
        ? `Delete “${account.name}” and its ${amount} opening balance. This account has no other transactions. This cannot be undone.`
        : `Remove the ${amount} opening balance from “${account.name}” and update its balance. The account and all its transactions will be kept. This cannot be undone.`,
      confirmLabel: deletesAccount ? "Delete account and record" : "Delete opening balance",
      expectedState: JSON.stringify({ mode: deletesAccount ? "delete_account" : "clear_opening", account, entries }),
    }
  }

  const operation = await db.operations.get(target.id)
  if (!operation) throw new Error("Transaction not found")
  const entries = await db.entries.where("operationId").equals(operation.id).sortBy("id")
  const accountIds = [...new Set(entries.map((entry) => entry.accountId))].sort()
  const accounts = []
  const removedAccountNames: string[] = []
  const isTransfer = operation.kind !== "normal" && operation.kind !== "adjustment"
  for (const accountId of accountIds) {
    const account = await db.accounts.get(accountId)
    const accountEntries = await db.entries.where("accountId").equals(accountId).sortBy("id")
    accounts.push({ account, entries: accountEntries })
    if (isTransfer && operation.createdAccountIds?.includes(accountId) && account?.openingBalance === 0 &&
      accountEntries.every((entry) => entry.operationId === operation.id)) {
      removedAccountNames.push(`“${account.name}”`)
    }
  }
  const accountCleanup = removedAccountNames.length > 0
    ? ` ${removedAccountNames.join(", ")} ${removedAccountNames.length === 1 ? "was" : "were"} created for this transfer and ${removedAccountNames.length === 1 ? "has" : "have"} no other transactions or opening balance, so ${removedAccountNames.length === 1 ? "it" : "they"} will also be deleted.`
    : ""
  return {
    target: { ...target },
    title: "Delete transaction?",
    description: `Delete this transaction and reverse its effect on account balances.${accountCleanup} This cannot be undone.`,
    confirmLabel: "Delete transaction",
    expectedState: JSON.stringify({ operation, entries, accounts }),
  }
}
