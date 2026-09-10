import "fake-indexeddb/auto"
import assert from "node:assert/strict"
import test from "node:test"
import { account, entry, moduleURL, operation, sourceURL } from "./helpers.mjs"

const normalizationURL = await sourceURL("src/lib/utils/transaction-amount.ts")
const idURL = moduleURL("let id = 0; export const generateId = () => String(++id)")
let fixtureId = 0

async function fixture(t) {
  const databaseURL = moduleURL(`
    import { Dexie } from ${JSON.stringify(import.meta.resolve("dexie"))};
    export const db = new Dexie("signed-transactions-test-${++fixtureId}");
    db.version(1).stores({ accounts: "id,categoryId", categories: "id", operations: "id,occurredAt", entries: "id,accountId,operationId" });
  `)
  const accountURL = await sourceURL("src/lib/services/account-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
  })
  const serviceURL = await sourceURL("src/lib/services/operation-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
    "./account-service": accountURL, "@/lib/utils/transaction-amount": normalizationURL,
  })
  const { db } = await import(databaseURL)
  const { operationService: service } = await import(serviceURL)
  await db.open()
  t.after(() => db.delete())
  await db.categories.bulkAdd([{ id: "assets", type: "asset" }, { id: "debts", type: "liability" }])
  await db.accounts.bulkAdd([
    account({ id: "cash", openingBalance: 100000, balance: 100000 }),
    account({ id: "savings", openingBalance: 100000, balance: 100000 }),
    account({ id: "usd", currency: "USD", openingBalance: 100000, balance: 100000 }),
    account({ id: "card", categoryId: "debts", openingBalance: 50000, balance: 50000 }),
  ])
  return { db, service, balance: async (id) => (await db.accounts.get(id)).balance }
}

for (const [accountId, effect, expectedEffect, expectedBalance] of [
  ["cash", "decrease", "increase", 110000],
  ["cash", "increase", "decrease", 90000],
  ["card", "increase", "decrease", 40000],
  ["card", "decrease", "increase", 60000],
]) {
  test(`negative ${effect} on ${accountId} stores positive cents and reverses its balance effect`, async (t) => {
    const { service, balance } = await fixture(t)
    const id = await service.createNormal({ accountId, effect, amount: -10000, occurredAt: 100 })
    const saved = await service.getWithEntries(id)
    assert.equal(saved.entries.length, 1)
    assert.equal(saved.entries[0].effect, expectedEffect)
    assert.equal(saved.entries[0].amount, 10000)
    assert.equal(await balance(accountId), expectedBalance)
    await service.deleteOperation(id)
    assert.equal(await balance(accountId), accountId === "card" ? 50000 : 100000)
  })
}

test("negative same-currency transfer swaps source and target and keeps unequal amounts attached to accounts", async (t) => {
  const { service, balance } = await fixture(t)
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "savings", fromAmount: -10000, toAmount: 9000, occurredAt: 100 })
  const { operation, entries } = await service.getWithEntries(id)
  assert.equal(operation.kind, "transfer")
  assert.deepEqual(entries.map((e) => [e.accountId, e.role, e.effect, e.amount]), [
    ["savings", "source", "decrease", 9000], ["cash", "target", "increase", 10000],
  ])
  assert.equal(await balance("cash"), 110000)
  assert.equal(await balance("savings"), 91000)
})

test("negative received FX amount reverses currencies, rate, entries, and balances", async (t) => {
  const { service, balance } = await fixture(t)
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "usd", fromAmount: 70000, toAmount: -10000, occurredAt: 100 })
  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "fx_transfer")
  assert.equal(saved.operation.fxBaseCurrency, "USD")
  assert.equal(saved.operation.fxQuoteCurrency, "CNY")
  assert.equal(saved.operation.fxRate, 7)
  assert.equal(await balance("usd"), 90000)
  assert.equal(await balance("cash"), 170000)
  const from = saved.entries.find((e) => e.role === "source")
  const to = saved.entries.find((e) => e.role === "target")
  await service.updateOperation(id, { fromAccountId: from.accountId, toAccountId: to.accountId, fromAmount: from.amount, toAmount: to.amount })
  assert.equal(await balance("usd"), 90000, "saving again must not reverse or apply twice")
  assert.equal(await balance("cash"), 170000)
  await service.deleteOperation(id)
  assert.equal(await balance("cash"), 100000)
  assert.equal(await balance("usd"), 100000)
})

test("negative borrowing becomes repayment, and negative repayment becomes borrowing", async (t) => {
  const { service, balance } = await fixture(t)
  const borrow = await service.createTransfer({ fromAccountId: "cash", toAccountId: "card", fromAmount: -10000, occurredAt: 100 })
  assert.equal((await service.getById(borrow)).kind, "liability_drawdown")
  assert.equal(await balance("cash"), 110000)
  assert.equal(await balance("card"), 60000)
  const repay = await service.createTransfer({ fromAccountId: "card", toAccountId: "cash", fromAmount: -10000, occurredAt: 200 })
  assert.equal((await service.getById(repay)).kind, "liability_repayment")
  assert.equal(await balance("cash"), 100000)
  assert.equal(await balance("card"), 50000)
})

test("editing with a negative amount replaces the old effect exactly once", async (t) => {
  const { service, balance } = await fixture(t)
  const normal = await service.createNormal({ accountId: "cash", effect: "decrease", amount: 10000, occurredAt: 100 })
  await service.updateOperation(normal, { amount: -2500 })
  assert.equal(await balance("cash"), 102500)
  assert.equal((await service.getWithEntries(normal)).entries[0].amount, 2500)
  const transfer = await service.createTransfer({ fromAccountId: "cash", toAccountId: "savings", fromAmount: 5000, occurredAt: 200 })
  await service.updateOperation(transfer, { fromAccountId: "cash", toAccountId: "savings", fromAmount: -2000 })
  assert.equal(await balance("cash"), 104500)
  assert.equal(await balance("savings"), 98000)
})

test("invalid amounts and invalid transfer edits leave existing ledger data intact", async (t) => {
  const { db, service, balance } = await fixture(t)
  for (const amount of [0, NaN, Infinity, 0.5]) {
    await assert.rejects(service.createNormal({ accountId: "cash", effect: "decrease", amount, occurredAt: 100 }))
  }
  await assert.rejects(service.createTransfer({ fromAccountId: "cash", toAccountId: "usd", fromAmount: -10000, occurredAt: 100 }))
  assert.equal(await db.operations.count(), 0)
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "savings", fromAmount: 1000, occurredAt: 100 })
  const before = await service.getWithEntries(id)
  for (const data of [
    { fromAccountId: "cash", toAccountId: "savings", fromAmount: 0 },
    { fromAccountId: "cash", toAccountId: "cash", fromAmount: -1000 },
    { fromAccountId: "cash", toAccountId: "usd", fromAmount: -1000 },
  ]) {
    await assert.rejects(service.updateOperation(id, data))
    assert.deepEqual(await service.getWithEntries(id), before, "Dexie rolls back replaced entries on invalid input")
  }
  assert.equal(await balance("cash"), 99000)
  assert.equal(await balance("savings"), 101000)
})

test("legacy adjustment history stays editable while the creation API is removed", async (t) => {
  const { db, service, balance } = await fixture(t)
  assert.equal(service.createAdjustment, undefined)
  await db.operations.add(operation({ id: "legacy", kind: "adjustment" }))
  await db.entries.add(entry({ id: "legacy-entry", operationId: "legacy", amount: 1000 }))
  await service.updateOperation("legacy", { amount: -2000 })
  const saved = await service.getWithEntries("legacy")
  assert.equal(saved.operation.kind, "adjustment")
  assert.equal(saved.entries[0].effect, "increase")
  assert.equal(await balance("cash"), 102000)
})
