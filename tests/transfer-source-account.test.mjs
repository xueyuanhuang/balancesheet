import "fake-indexeddb/auto"
import assert from "node:assert/strict"
import test from "node:test"
import { account, moduleURL, sourceURL } from "./helpers.mjs"

const normalizationURL = await sourceURL("src/lib/utils/transaction-amount.ts")
const idURL = moduleURL("let sourceTransferId = 0; export const generateId = () => `source-transfer-${++sourceTransferId}`")
let fixtureId = 0

async function fixture(t) {
  const databaseURL = moduleURL(`
    import { Dexie } from ${JSON.stringify(import.meta.resolve("dexie"))};
    export const db = new Dexie("new-source-account-test-${++fixtureId}");
    db.version(1).stores({ accounts: "id,categoryId", categories: "id", operations: "id,occurredAt", entries: "id,accountId,operationId" });
  `)
  const accountURL = await sourceURL("src/lib/services/account-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
  })
  const operationURL = await sourceURL("src/lib/services/operation-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
    "./account-service": accountURL, "@/lib/utils/transaction-amount": normalizationURL,
  })
  const { db } = await import(databaseURL)
  const { operationService: service } = await import(operationURL)
  const { accountService: accounts } = await import(accountURL)
  await db.open()
  t.after(() => db.delete())
  await db.categories.bulkAdd([
    { id: "assets", type: "asset", usageCount: 0 },
    { id: "debts", type: "liability", usageCount: 0 },
  ])
  await db.accounts.add(account({ id: "bank", openingBalance: 100000, balance: 100000 }))
  return { db, service, accounts, balance: async (id) => (await db.accounts.get(id)).balance }
}

function lender(overrides = {}) {
  return { id: "lender", name: "Loan from Alex", categoryId: "debts", currency: "CNY", ...overrides }
}

async function ledgerSnapshot(db) {
  return Promise.all([db.accounts, db.categories, db.operations, db.entries].map((table) => table.orderBy("id").toArray()))
}

test("a new liability source records borrowed cash and debt together without an opening balance", async (t) => {
  const { db, service, balance } = await fixture(t)
  const draft = lender()
  const id = await service.createTransfer({
    fromAccountId: draft.id, toAccountId: "bank", fromAmount: 25000,
    description: "Borrowed from Alex", occurredAt: 300, newAccounts: [draft],
  })

  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "liability_drawdown")
  assert.deepEqual(saved.operation.createdAccountIds, [draft.id])
  assert.deepEqual(saved.entries.map((e) => [e.accountId, e.role, e.effect, e.amount]), [
    [draft.id, "source", "increase", 25000], ["bank", "target", "increase", 25000],
  ])
  assert.equal((await db.accounts.get(draft.id)).openingBalance, 0)
  assert.equal(await balance(draft.id), 25000)
  assert.equal(await balance("bank"), 125000)
  assert.equal(await balance("bank") - await balance(draft.id), 100000, "borrowing must not increase net worth")

  await service.updateOperation(id, { fromAccountId: draft.id, toAccountId: "bank", fromAmount: 25000 })
  assert.equal(await balance("bank"), 125000, "re-saving the existing transfer must not credit the deposit twice")
  assert.equal(await balance(draft.id), 25000)
})

test("borrowing can create both endpoints and deleting it removes both unused drafts", async (t) => {
  const { db, service, balance } = await fixture(t)
  const from = lender()
  const to = { id: "new-bank", name: "New bank", categoryId: "assets", currency: "CNY" }
  const id = await service.createTransfer({
    fromAccountId: from.id, toAccountId: to.id, fromAmount: 50000,
    occurredAt: 300, newAccounts: [from, to],
  })
  assert.equal(await balance(from.id), 50000)
  assert.equal(await balance(to.id), 50000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [from.id, to.id])
  assert.equal((await db.accounts.get(from.id)).openingBalance, 0)
  assert.equal((await db.accounts.get(to.id)).openingBalance, 0)

  assert.deepEqual((await service.deleteOperation(id)).sort(), [from.id, to.id].sort())
  assert.equal(await db.accounts.get(from.id), undefined)
  assert.equal(await db.accounts.get(to.id), undefined)
  assert.equal(await db.entries.count(), 0)
  assert.equal(await service.getById(id), undefined)
  assert.equal(await balance("bank"), 100000)
})

test("correcting borrowing to a new lender replaces only that loan and deletes the unused original source", async (t) => {
  const { db, service, balance } = await fixture(t)
  const first = lender()
  const second = lender({ id: "correct-lender", name: "Loan from Sam" })
  const id = await service.createTransfer({
    fromAccountId: first.id, toAccountId: "bank", fromAmount: 25000,
    occurredAt: 300, newAccounts: [first],
  })
  await service.updateOperation(id, {
    fromAccountId: second.id, toAccountId: "bank", fromAmount: 20000, newAccounts: [second],
  })

  assert.equal(await db.accounts.get(first.id), undefined)
  assert.equal(await balance(second.id), 20000)
  assert.equal(await balance("bank"), 120000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [second.id])
  assert.equal((await service.getWithEntries(id)).entries.find((e) => e.role === "source").accountId, second.id)

  assert.deepEqual(await service.deleteOperation(id), [second.id])
  assert.equal(await db.accounts.get(second.id), undefined)
  assert.equal(await balance("bank"), 100000, "deleting a loan must also reverse its deposited cash")
})

test("changing lenders preserves a source reused by another loan and relinquishes cleanup ownership", async (t) => {
  const { db, service, balance } = await fixture(t)
  const first = lender()
  const second = lender({ id: "correct-lender" })
  const id = await service.createTransfer({
    fromAccountId: first.id, toAccountId: "bank", fromAmount: 25000,
    occurredAt: 300, newAccounts: [first],
  })
  const otherLoan = await service.createTransfer({ fromAccountId: first.id, toAccountId: "bank", fromAmount: 8000, occurredAt: 400 })
  await service.updateOperation(id, {
    fromAccountId: second.id, toAccountId: "bank", fromAmount: 20000, newAccounts: [second],
  })
  assert.equal(await balance(first.id), 8000)
  assert.equal(await balance(second.id), 20000)
  assert.equal(await balance("bank"), 128000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [second.id])

  await service.deleteOperation(otherLoan)
  await service.updateOperation(id, { fromAccountId: first.id, toAccountId: "bank", fromAmount: 20000 })
  assert.equal(await db.accounts.get(second.id), undefined)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [])
  assert.deepEqual(await service.deleteOperation(id), [])
  assert.ok(await db.accounts.get(first.id), "selecting the reused lender again must not restore authority to delete it")
  assert.equal(await balance(first.id), 0)
  assert.equal(await balance("bank"), 100000)
})

test("replacing a source preserves an opening debt balance added after the transfer", async (t) => {
  const { db, service, accounts, balance } = await fixture(t)
  const first = lender()
  const second = lender({ id: "correct-lender" })
  const id = await service.createTransfer({
    fromAccountId: first.id, toAccountId: "bank", fromAmount: 25000,
    occurredAt: 300, newAccounts: [first],
  })
  await accounts.update(first.id, { openingBalance: 6000 })
  await service.updateOperation(id, {
    fromAccountId: second.id, toAccountId: "bank", fromAmount: 20000, newAccounts: [second],
  })

  assert.ok(await db.accounts.get(first.id), "editing this transfer must not erase independently recorded opening debt")
  assert.equal((await db.accounts.get(first.id)).openingBalance, 6000)
  assert.equal(await balance(first.id), 6000)
  assert.equal(await balance(second.id), 20000)
  assert.equal(await balance("bank"), 120000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [second.id])
})

test("a foreign-currency new lender retains debt currency and rate and rolls back incomplete edits", async (t) => {
  const { db, service, balance } = await fixture(t)
  const draft = lender({ currency: "USD" })
  const before = await ledgerSnapshot(db)
  await assert.rejects(service.createTransfer({
    fromAccountId: draft.id, toAccountId: "bank", fromAmount: 10000, occurredAt: 300, newAccounts: [draft],
  }), /received amount/)
  assert.deepEqual(await ledgerSnapshot(db), before, "missing received amount must not leave a lender account behind")

  const id = await service.createTransfer({
    fromAccountId: draft.id, toAccountId: "bank", fromAmount: 10000, toAmount: 70000,
    occurredAt: 300, newAccounts: [draft],
  })
  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "liability_drawdown")
  assert.equal(saved.operation.fxBaseCurrency, "USD")
  assert.equal(saved.operation.fxQuoteCurrency, "CNY")
  assert.equal(saved.operation.fxRate, 7)
  assert.equal(await balance(draft.id), 10000)
  assert.equal(await balance("bank"), 170000)

  const originalLoan = await ledgerSnapshot(db)
  const replacement = lender({ id: "replacement", currency: "HKD" })
  await assert.rejects(service.updateOperation(id, {
    fromAccountId: replacement.id, toAccountId: "bank", fromAmount: 80000, newAccounts: [replacement],
  }), /received amount/)
  assert.deepEqual(await ledgerSnapshot(db), originalLoan, "a failed source edit must preserve both entries and the original lender")

  await service.deleteOperation(id)
  assert.equal(await db.accounts.get(draft.id), undefined)
  assert.equal(await balance("bank"), 100000)
})
