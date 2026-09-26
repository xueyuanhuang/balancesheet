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
    export const db = new Dexie("activity-deletion-test-${++fixtureId}");
    db.version(1).stores({ accounts: "id,categoryId", categories: "id", operations: "id,occurredAt", entries: "id,accountId,operationId" });
  `)
  const accountURL = await sourceURL("src/lib/services/account-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
  })
  const operationURL = await sourceURL("src/lib/services/operation-service.ts", {
    "@/lib/db": databaseURL, "@/lib/utils/id": idURL,
    "./account-service": accountURL, "@/lib/utils/transaction-amount": normalizationURL,
  })
  const activityURL = await sourceURL("src/lib/services/activity-service.ts", {
    "@/lib/db": databaseURL, "./account-service": accountURL, "./operation-service": operationURL,
  })
  const { db } = await import(databaseURL)
  const { activityService: service } = await import(activityURL)
  const { operationService: operations } = await import(operationURL)
  const { accountService: accounts } = await import(accountURL)
  await db.open()
  t.after(() => db.delete())
  await db.categories.bulkAdd([{ id: "assets", type: "asset" }, { id: "debts", type: "liability" }])
  return { db, service, operations, accounts }
}

async function snapshot(db) {
  return {
    accounts: await db.accounts.toArray(), operations: await db.operations.toArray(), entries: await db.entries.toArray(),
  }
}

for (const openingBalance of [12345, -23456]) {
  test(`deleting an opening-only account removes its ${openingBalance} opening balance and account together`, async (t) => {
    const { db, service } = await fixture(t)
    await db.accounts.bulkAdd([
      account({ id: "opening-only", name: "Mistaken account", currency: "USD", openingBalance, balance: openingBalance }),
      account({ id: "unrelated", openingBalance: 90000, balance: 90000 }),
    ])
    const beforeUnrelated = await db.accounts.get("unrelated")
    const preview = await service.getDeletePreview({ type: "opening_balance", id: "opening-only" })
    assert.equal(preview.title, "Delete account and opening balance?")
    assert.match(preview.description, /Mistaken account/)
    assert.match(preview.description, new RegExp(`USD ${openingBalance / 100}`.replace(".", "\\.")))
    assert.match(preview.description, /no other transactions/)

    assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: ["opening-only"] })

    assert.equal(await db.accounts.get("opening-only"), undefined)
    assert.deepEqual(await db.accounts.get("unrelated"), beforeUnrelated)
    assert.equal(await db.entries.count(), 0)
    await assert.rejects(service.deleteRecord(preview), /not found/, "repeated deletion cannot affect another record")
  })
}

for (const openingBalance of [10000, -10000]) {
  test(`deleting a ${openingBalance} opening balance with later transactions preserves the account and history`, async (t) => {
    const { db, service } = await fixture(t)
    await db.accounts.add(account({ openingBalance, balance: openingBalance - 500 }))
    await db.operations.add(operation())
    await db.entries.add(entry())
    const history = { operations: await db.operations.toArray(), entries: await db.entries.toArray() }
    const preview = await service.getDeletePreview({ type: "opening_balance", id: "cash" })
    assert.equal(preview.title, "Delete opening balance?")
    assert.match(preview.description, /account and all its transactions will be kept/)

    assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: [] })

    const kept = await db.accounts.get("cash")
    assert.equal(kept.openingBalance, 0)
    assert.equal(kept.balance, -500)
    assert.deepEqual(await db.operations.toArray(), history.operations)
    assert.deepEqual(await db.entries.toArray(), history.entries)
  })
}

test("an entry added after the opening-only confirmation prevents account deletion without changing any data", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.add(account({ openingBalance: 10000, balance: 10000 }))
  const preview = await service.getDeletePreview({ type: "opening_balance", id: "cash" })
  await operations.createNormal({ accountId: "cash", effect: "decrease", amount: 1200, occurredAt: 300 })
  const before = await snapshot(db)

  await assert.rejects(service.deleteRecord(preview), /record changed/)

  assert.deepEqual(await snapshot(db), before)
})

test("renaming or editing the opening balance after confirmation prevents deletion of an outdated record", async (t) => {
  const { db, service } = await fixture(t)
  await db.accounts.add(account({ openingBalance: 10000, balance: 10000 }))
  for (const change of [{ name: "Renamed" }, { currency: "USD" }, { openingBalance: 40000, balance: 40000 }, { createdAt: 900 }]) {
    const preview = await service.getDeletePreview({ type: "opening_balance", id: "cash" })
    await db.accounts.update("cash", change)
    const before = await snapshot(db)
    await assert.rejects(service.deleteRecord(preview), /record changed/)
    assert.deepEqual(await snapshot(db), before)
  }
})

test("a failed balance recalculation rolls back an opening-balance deletion", async (t) => {
  const { db, service, accounts } = await fixture(t)
  await db.accounts.add(account({ openingBalance: 10000, balance: 9500 }))
  await db.operations.add(operation())
  await db.entries.add(entry())
  const preview = await service.getDeletePreview({ type: "opening_balance", id: "cash" })
  const before = await snapshot(db)
  accounts.recalculateBalance = async () => { throw new Error("Simulated write failure") }

  await assert.rejects(service.deleteRecord(preview), /Simulated write failure/)

  assert.deepEqual(await snapshot(db), before)
})

test("deleting an ordinary transfer reverses both sides and keeps existing accounts", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.bulkAdd([
    account({ id: "source", openingBalance: 100000, balance: 100000 }),
    account({ id: "target", openingBalance: 20000, balance: 20000 }),
  ])
  const id = await operations.createTransfer({ fromAccountId: "source", toAccountId: "target", fromAmount: 5000, occurredAt: 300 })
  const preview = await service.getDeletePreview({ type: "operation", id })
  assert.match(preview.description, /reverse its effect on account balances/)

  assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: [] })

  assert.equal((await db.accounts.get("source")).balance, 100000)
  assert.equal((await db.accounts.get("target")).balance, 20000)
  assert.equal(await db.operations.count(), 0)
  assert.equal(await db.entries.count(), 0)
})

test("deleting a transfer removes only its unused owned account, discloses it, and restores the source", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.bulkAdd([
    account({ id: "source", openingBalance: 100000, balance: 100000 }),
    account({ id: "unrelated" }),
  ])
  const newAccount = { id: "new-target", name: "New savings", currency: "CNY", categoryId: "assets" }
  const id = await operations.createTransfer({ fromAccountId: "source", toAccountId: newAccount.id, fromAmount: 5000, occurredAt: 300, newAccount })
  // Stray metadata is never authority to delete an account outside this transfer.
  await db.operations.update(id, { createdAccountIds: [newAccount.id, "unrelated"] })
  const preview = await service.getDeletePreview({ type: "operation", id })
  assert.match(preview.description, /“New savings”.*will also be deleted/)

  assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: [newAccount.id] })

  assert.equal((await db.accounts.get("source")).balance, 100000)
  assert.equal(await db.accounts.get(newAccount.id), undefined)
  assert.ok(await db.accounts.get("unrelated"))
  assert.equal(await db.operations.count(), 0)
  assert.equal(await db.entries.count(), 0)
})

test("owned accounts with another transaction or independently added opening money survive transfer deletion", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.add(account({ id: "source", openingBalance: 100000, balance: 100000 }))
  for (const reason of ["transaction", "opening"]) {
    const newAccount = { id: reason, name: reason, currency: "CNY", categoryId: "assets" }
    const id = await operations.createTransfer({ fromAccountId: "source", toAccountId: newAccount.id, fromAmount: 5000, occurredAt: 300, newAccount })
    if (reason === "transaction") {
      await operations.createNormal({ accountId: newAccount.id, effect: "decrease", amount: 700, occurredAt: 400 })
    } else {
      await db.accounts.update(newAccount.id, { openingBalance: 3000, balance: 8000 })
    }
    const preview = await service.getDeletePreview({ type: "operation", id })
    assert.doesNotMatch(preview.description, /will also be deleted/)

    assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: [] })

    assert.equal((await db.accounts.get(newAccount.id)).balance, reason === "transaction" ? -700 : 3000)
    assert.equal((await db.accounts.get("source")).balance, 100000)
  }
  assert.equal(await db.operations.count(), 1, "the independently recorded expense remains")
})

test("changed transfer entries or newly reused accounts invalidate a deletion preview", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.add(account({ id: "source", openingBalance: 100000, balance: 100000 }))
  const newAccount = { id: "target", name: "New savings", currency: "CNY", categoryId: "assets" }
  const id = await operations.createTransfer({ fromAccountId: "source", toAccountId: newAccount.id, fromAmount: 5000, occurredAt: 300, newAccount })
  const preview = await service.getDeletePreview({ type: "operation", id })
  await operations.updateOperation(id, { fromAccountId: "source", toAccountId: newAccount.id, fromAmount: 6000 })
  let before = await snapshot(db)
  await assert.rejects(service.deleteRecord(preview), /record changed/)
  assert.deepEqual(await snapshot(db), before)

  const updatedPreview = await service.getDeletePreview({ type: "operation", id })
  await operations.createNormal({ accountId: newAccount.id, effect: "increase", amount: 800, occurredAt: 400 })
  before = await snapshot(db)
  await assert.rejects(service.deleteRecord(updatedPreview), /record changed/)
  assert.deepEqual(await snapshot(db), before)
})

test("a missing or zero opening record cannot be deleted", async (t) => {
  const { db, service } = await fixture(t)
  await db.accounts.add(account())
  await assert.rejects(service.getDeletePreview({ type: "opening_balance", id: "cash" }), /not found/)
  await assert.rejects(service.getDeletePreview({ type: "opening_balance", id: "missing" }), /not found/)
  await assert.rejects(service.getDeletePreview({ type: "operation", id: "missing" }), /not found/)
  assert.equal(await db.accounts.count(), 1)
})

test("normal transactions cannot delete an account through stray transfer ownership metadata", async (t) => {
  const { db, service, operations } = await fixture(t)
  await db.accounts.add(account())
  const id = await operations.createNormal({ accountId: "cash", effect: "increase", amount: 500, occurredAt: 300 })
  await db.operations.update(id, { createdAccountIds: ["cash"] })
  const preview = await service.getDeletePreview({ type: "operation", id })
  assert.doesNotMatch(preview.description, /will also be deleted/)

  assert.deepEqual(await service.deleteRecord(preview), { deletedAccountIds: [] })

  assert.equal((await db.accounts.get("cash")).balance, 0)
})

test("a failed transfer reversal rolls back the operation, entries, and account balances", async (t) => {
  const { db, service, operations, accounts } = await fixture(t)
  await db.accounts.bulkAdd([
    account({ id: "source", openingBalance: 100000, balance: 100000 }),
    account({ id: "target" }),
  ])
  const id = await operations.createTransfer({ fromAccountId: "source", toAccountId: "target", fromAmount: 5000, occurredAt: 300 })
  const preview = await service.getDeletePreview({ type: "operation", id })
  const before = await snapshot(db)
  const recalculate = accounts.recalculateBalance
  let calls = 0
  accounts.recalculateBalance = async (accountId) => {
    if (++calls === 2) throw new Error("Simulated second-account failure")
    await recalculate(accountId)
  }

  await assert.rejects(service.deleteRecord(preview), /Simulated second-account failure/)

  assert.equal(calls, 2, "the first balance reversal happened inside the rolled-back transaction")
  assert.deepEqual(await snapshot(db), before)
})
