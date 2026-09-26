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

async function ledgerSnapshot(db) {
  return {
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    operations: await db.operations.toArray(),
    entries: await db.entries.toArray(),
  }
}

test("changing a transfer destination preserves the old account unless removal is explicitly requested", async (t) => {
  const { db, service, balance } = await fixture(t)
  // Legacy accounts and transfers have no creation-link metadata.
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "savings", fromAmount: 12000, occurredAt: 100 })

  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "card", fromAmount: 8000 })

  assert.equal((await service.getById(id)).kind, "liability_repayment")
  assert.equal(await balance("cash"), 92000)
  assert.equal(await balance("savings"), 100000, "the previous destination is restored to its opening balance")
  assert.equal(await balance("card"), 42000)
  assert.equal(await db.accounts.count(), 4)
  assert.deepEqual((await service.getWithEntries(id)).entries.map((e) => [e.accountId, e.effect, e.amount]), [
    ["cash", "decrease", 8000], ["card", "decrease", 8000],
  ])
})

test("correcting a transfer can remove its unused old destination and that account's opening balance", async (t) => {
  const { db, service, balance } = await fixture(t)
  await db.accounts.add(account({ id: "mistake", openingBalance: 12300, balance: 12300 }))
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "mistake", fromAmount: 12000, occurredAt: 100 })
  const correction = { fromAccountId: "cash", toAccountId: "savings", fromAmount: 8000, description: "Correct destination", occurredAt: 200 }

  await service.updateOperation(id, { ...correction, removeAccountIds: ["mistake"] })

  assert.equal(await db.accounts.get("mistake"), undefined)
  assert.equal(await db.entries.where("accountId").equals("mistake").count(), 0)
  assert.equal(await balance("cash"), 92000)
  assert.equal(await balance("savings"), 108000)
  assert.equal((await db.accounts.toArray()).reduce((sum, a) => sum + a.balance, 0), 350000, "the removed opening balance no longer contributes to account totals")
  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.description, correction.description)
  assert.equal(saved.operation.occurredAt, 200)

  await service.updateOperation(id, correction)
  assert.equal(await balance("cash"), 92000, "saving the corrected transfer again does not apply its effect twice")
  assert.equal(await balance("savings"), 108000)
  assert.equal(await db.operations.count(), 1)
  assert.equal(await db.entries.count(), 2)
})

test("unsafe account removal rolls back the entire transfer edit", async (t) => {
  const { db, service } = await fixture(t)
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "savings", fromAmount: 12000, occurredAt: 100 })
  await service.createNormal({ accountId: "savings", effect: "increase", amount: 500, occurredAt: 150 })
  const before = await ledgerSnapshot(db)
  for (const data of [
    { fromAccountId: "cash", toAccountId: "card", fromAmount: 8000, removeAccountIds: ["savings"] },
    // The first removal succeeds inside the transaction before the second is rejected.
    { fromAccountId: "usd", toAccountId: "card", fromAmount: 1000, toAmount: 7000, removeAccountIds: ["cash", "savings"] },
    { fromAccountId: "cash", toAccountId: "savings", fromAmount: 8000, removeAccountIds: ["usd"] },
    { fromAccountId: "cash", toAccountId: "card", fromAmount: -8000, removeAccountIds: ["cash"] },
  ]) {
    await assert.rejects(service.updateOperation(id, { ...data, description: "Must roll back", occurredAt: 300 }))
    assert.deepEqual(await ledgerSnapshot(db), before, "failed cleanup must preserve accounts, balances, entries, and operation metadata")
  }
})

test("normal transactions cannot remove accounts during an edit", async (t) => {
  const { db, service } = await fixture(t)
  const id = await service.createNormal({ accountId: "cash", effect: "decrease", amount: 1000, occurredAt: 100 })
  const before = await ledgerSnapshot(db)

  await assert.rejects(service.updateOperation(id, { accountId: "savings", amount: 2000, removeAccountIds: ["cash"] }))

  assert.deepEqual(await ledgerSnapshot(db), before)
})

test("FX destination correction with a negative amount swaps currencies and safely removes the old account", async (t) => {
  const { db, service, balance } = await fixture(t)
  await db.accounts.add(account({ id: "mistake" }))
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "mistake", fromAmount: 12000, occurredAt: 100 })
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "usd", fromAmount: -70000, toAmount: 10000, removeAccountIds: ["mistake"] })

  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "fx_transfer")
  assert.equal(saved.operation.fxBaseCurrency, "USD")
  assert.equal(saved.operation.fxQuoteCurrency, "CNY")
  assert.equal(saved.operation.fxRate, 7)
  assert.deepEqual(saved.entries.map((e) => [e.accountId, e.role, e.effect, e.amount]), [
    ["usd", "source", "decrease", 10000], ["cash", "target", "increase", 70000],
  ])
  assert.equal(await balance("cash"), 170000)
  assert.equal(await balance("usd"), 90000)
  assert.equal(await db.accounts.get("mistake"), undefined)

  await service.updateOperation(id, { fromAccountId: "usd", toAccountId: "cash", fromAmount: 10000, toAmount: 70000 })
  assert.equal(await balance("cash"), 170000)
  assert.equal(await balance("usd"), 90000)
})

test("correcting a transfer to a negative liability transfer restores the old effects and records borrowing", async (t) => {
  const { db, service, balance } = await fixture(t)
  await db.accounts.add(account({ id: "mistake", openingBalance: 3000, balance: 3000 }))
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: "mistake", fromAmount: 12000, occurredAt: 100 })
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "card", fromAmount: -20000, removeAccountIds: ["mistake"] })

  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "liability_drawdown")
  assert.equal(saved.operation.fxRate, null)
  assert.deepEqual(saved.entries.map((e) => [e.accountId, e.role, e.effect, e.amount]), [
    ["card", "source", "increase", 20000], ["cash", "target", "increase", 20000],
  ])
  assert.equal(await balance("cash"), 120000)
  assert.equal(await balance("card"), 70000)
  assert.equal(await db.accounts.get("mistake"), undefined)
})

function destinationDraft(overrides = {}) {
  return { id: "draft-destination", name: "New destination", categoryId: "assets", currency: "CNY", note: "Created with this transfer", ...overrides }
}

test("saving an inline destination creates its account and transfer together with zero opening balance", async (t) => {
  const { db, service, balance } = await fixture(t)
  const newAccount = destinationDraft()
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: 12345,
    description: "Move savings", occurredAt: 250, newAccount,
  })

  const savedAccount = await db.accounts.get(newAccount.id)
  assert.equal(savedAccount.name, newAccount.name)
  assert.equal(savedAccount.categoryId, newAccount.categoryId)
  assert.equal(savedAccount.currency, newAccount.currency)
  assert.equal(savedAccount.note, newAccount.note)
  assert.equal(savedAccount.openingBalance, 0, "the transfer amount must never become additional opening income")
  assert.equal(savedAccount.balance, 12345)
  assert.equal(await balance("cash"), 87655)
  const saved = await service.getWithEntries(id)
  assert.deepEqual(saved.operation.createdAccountIds, [newAccount.id])
  assert.deepEqual(saved.entries.map((e) => [e.accountId, e.role, e.amount]), [
    ["cash", "source", 12345], [newAccount.id, "target", 12345],
  ])
  assert.equal(await db.accounts.count(), 5)
  assert.equal(await db.operations.count(), 1)
  assert.equal(await db.entries.count(), 2)
})

test("changing a linked transfer destination automatically removes its unused created account", async (t) => {
  const { db, service, balance } = await fixture(t)
  const newAccount = destinationDraft()
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: 12345, occurredAt: 250, newAccount,
  })

  const correction = { fromAccountId: "cash", toAccountId: "savings", fromAmount: 8000, description: "Corrected", occurredAt: 300 }
  await service.updateOperation(id, correction)

  assert.equal(await db.accounts.get(newAccount.id), undefined, "cleanup must not require a removal checkbox or explicit account id")
  assert.equal(await db.entries.where("accountId").equals(newAccount.id).count(), 0)
  assert.equal(await balance("cash"), 92000)
  assert.equal(await balance("savings"), 108000)
  assert.deepEqual((await service.getById(id)).createdAccountIds ?? [], [])
  await service.updateOperation(id, correction)
  assert.equal(await balance("cash"), 92000, "saving again must not debit the source twice")
  assert.equal(await balance("savings"), 108000)
  assert.equal(await db.operations.count(), 1)
  assert.equal(await db.entries.count(), 2)
})

test("an inline account used elsewhere is preserved and relinquished when its creating transfer changes", async (t) => {
  const { db, service, balance } = await fixture(t)
  const newAccount = destinationDraft()
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: 10000, occurredAt: 250, newAccount,
  })
  const purchase = await service.createNormal({ accountId: newAccount.id, effect: "decrease", amount: 2000, occurredAt: 260 })

  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "savings", fromAmount: 10000 })

  assert.equal(await balance(newAccount.id), -2000, "only this transfer's effect is removed; the other transaction remains")
  assert.equal((await service.getWithEntries(purchase)).entries[0].accountId, newAccount.id)
  assert.ok(!(await service.getById(id)).createdAccountIds?.includes(newAccount.id), "a retained account is no longer owned by the corrected transfer")
  await service.deleteOperation(purchase)
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: 10000 })
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "savings", fromAmount: 10000 })
  assert.ok(await db.accounts.get(newAccount.id), "later reuse must not restore authority to delete an independently used account")
  assert.equal(await balance(newAccount.id), 0)
})

test("replacing one newly created destination with another commits the new account and cleans up the old one", async (t) => {
  const { db, service, balance } = await fixture(t)
  const first = destinationDraft({ id: "first-draft" })
  const second = destinationDraft({ id: "second-draft", name: "Correct savings" })
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: first.id, fromAmount: 10000, occurredAt: 250, newAccount: first,
  })

  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: second.id, fromAmount: 15000, newAccount: second })

  assert.equal(await db.accounts.get(first.id), undefined)
  assert.equal((await db.accounts.get(second.id)).openingBalance, 0)
  assert.equal(await balance(second.id), 15000)
  assert.equal(await balance("cash"), 85000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [second.id])
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "savings", fromAmount: 15000 })
  assert.equal(await db.accounts.get(second.id), undefined, "ownership follows the replacement draft")
  assert.equal(await balance("cash"), 85000)
  assert.equal(await balance("savings"), 115000)
})

test("invalid inline account transfers never leave an account, operation, or partial balance change", async (t) => {
  const { db, service } = await fixture(t)
  const before = await ledgerSnapshot(db)
  const base = { fromAccountId: "cash", toAccountId: "draft-destination", fromAmount: 1000, occurredAt: 250 }
  for (const data of [
    { ...base, newAccount: destinationDraft(), fromAmount: 0 },
    { ...base, newAccount: destinationDraft(), fromAccountId: "missing-source" },
    { ...base, newAccount: destinationDraft({ categoryId: "missing-category" }) },
    { ...base, newAccount: destinationDraft({ currency: "USD" }) },
    { ...base, newAccount: destinationDraft({ id: "savings" }), toAccountId: "savings" },
    { ...base, newAccount: destinationDraft({ id: "unused-draft" }), toAccountId: "savings" },
    { ...base, newAccount: destinationDraft(), occurredAt: NaN },
  ]) {
    await assert.rejects(service.createTransfer(data))
    assert.deepEqual(await ledgerSnapshot(db), before, "account creation must roll back with a rejected transfer")
  }
})

test("two draft endpoints survive direction reversal and are independently cleaned up when replaced", async (t) => {
  const { db, service, balance } = await fixture(t)
  const source = destinationDraft({ id: "new-source", name: "New source" })
  const target = destinationDraft({ id: "new-target", name: "New target" })
  const id = await service.createTransfer({
    fromAccountId: source.id, toAccountId: target.id, fromAmount: -10000,
    occurredAt: 250, newAccounts: [source, target],
  })

  assert.deepEqual((await service.getById(id)).createdAccountIds, [source.id, target.id])
  assert.equal(await balance(source.id), 10000)
  assert.equal(await balance(target.id), -10000)
  await service.updateOperation(id, { fromAccountId: target.id, toAccountId: "savings", fromAmount: 10000 })
  assert.equal(await db.accounts.get(source.id), undefined)
  assert.equal(await balance(target.id), -10000)
  assert.deepEqual((await service.getById(id)).createdAccountIds, [target.id])
  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "savings", fromAmount: 10000 })
  assert.equal(await db.accounts.get(target.id), undefined)
  assert.equal(await balance("cash"), 90000)
  assert.equal(await balance("savings"), 110000)
})

test("failure in the second draft rolls back both accounts and their category usage updates", async (t) => {
  const { db, service } = await fixture(t)
  const source = destinationDraft({ id: "new-source" })
  const target = destinationDraft({ id: "new-target", categoryId: "missing-category" })
  const before = await ledgerSnapshot(db)

  await assert.rejects(service.createTransfer({
    fromAccountId: source.id, toAccountId: target.id, fromAmount: 10000,
    occurredAt: 250, newAccounts: [source, target],
  }))

  assert.deepEqual(await ledgerSnapshot(db), before)
  await assert.rejects(service.createTransfer({
    fromAccountId: "cash", toAccountId: source.id, fromAmount: 10000,
    occurredAt: 250, newAccounts: [source], newAccount: source,
  }))
  assert.deepEqual(await ledgerSnapshot(db), before, "duplicate draft IDs must not partially persist the first account")
})

test("an invalid edit to a newly drafted destination preserves the original linked transfer and account", async (t) => {
  const { db, service } = await fixture(t)
  const first = destinationDraft()
  const id = await service.createTransfer({ fromAccountId: "cash", toAccountId: first.id, fromAmount: 10000, occurredAt: 250, newAccount: first })
  const before = await ledgerSnapshot(db)
  const second = destinationDraft({ id: "second-draft", currency: "USD" })

  await assert.rejects(service.updateOperation(id, { fromAccountId: "cash", toAccountId: second.id, fromAmount: 70000, newAccount: second }))

  assert.deepEqual(await ledgerSnapshot(db), before, "neither replacing entries nor inserting the draft may survive the missing FX amount")
})

test("negative FX transfers track the created account after direction reversal and remove it only when detached", async (t) => {
  const { db, service, balance } = await fixture(t)
  const newAccount = destinationDraft({ currency: "USD" })
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: -70000, toAmount: 10000, occurredAt: 250, newAccount,
  })
  let saved = await service.getWithEntries(id)
  assert.deepEqual(saved.operation.createdAccountIds, [newAccount.id])
  assert.equal(saved.operation.fxBaseCurrency, "USD")
  assert.equal(saved.operation.fxQuoteCurrency, "CNY")
  assert.equal(saved.operation.fxRate, 7)
  assert.equal(await balance(newAccount.id), -10000)
  assert.equal(await balance("cash"), 170000)

  await service.updateOperation(id, { fromAccountId: newAccount.id, toAccountId: "savings", fromAmount: 10000, toAmount: 70000 })
  assert.ok(await db.accounts.get(newAccount.id), "a created account still used as source must remain")
  assert.equal(await balance("cash"), 100000)
  assert.equal(await balance("savings"), 170000)
  await service.updateOperation(id, { fromAccountId: "usd", toAccountId: "savings", fromAmount: 10000, toAmount: 70000 })
  assert.equal(await db.accounts.get(newAccount.id), undefined)
  assert.equal(await balance("usd"), 90000)
  assert.equal(await balance("savings"), 170000)
  saved = await service.getWithEntries(id)
  assert.deepEqual(saved.entries.map((e) => [e.accountId, e.role, e.amount]), [["usd", "source", 10000], ["savings", "target", 70000]])
})

test("a negative transfer to a newly drafted debt account records borrowing and cleans up on correction", async (t) => {
  const { db, service, balance } = await fixture(t)
  const newAccount = destinationDraft({ categoryId: "debts" })
  const id = await service.createTransfer({
    fromAccountId: "cash", toAccountId: newAccount.id, fromAmount: -10000, occurredAt: 250, newAccount,
  })
  assert.equal((await service.getById(id)).kind, "liability_drawdown")
  assert.equal(await balance(newAccount.id), 10000)
  assert.equal(await balance("cash"), 110000)

  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "card", fromAmount: -10000 })

  assert.equal(await db.accounts.get(newAccount.id), undefined)
  assert.equal((await service.getById(id)).kind, "liability_drawdown")
  assert.equal(await balance("cash"), 110000)
  assert.equal(await balance("card"), 60000)
})

test("recovering an orphan opening balance creates a transfer without counting the opening amount twice", async (t) => {
  const { db, service, balance } = await fixture(t)
  await db.accounts.add(account({ id: "orphan", currency: "USD", openingBalance: 32141, balance: 32141 }))
  const id = await service.convertOpeningToTransfer("orphan", {
    expectedOpeningBalance: 32141, fromAccountId: "cash", toAccountId: "orphan",
    fromAmount: 215988, toAmount: 32141, description: "Recovered transfer", occurredAt: 250,
  })

  const saved = await service.getWithEntries(id)
  assert.equal(saved.operation.kind, "fx_transfer")
  assert.equal(saved.operation.description, "Recovered transfer")
  assert.deepEqual(saved.operation.createdAccountIds, ["orphan"])
  assert.equal((await db.accounts.get("orphan")).openingBalance, 0)
  assert.equal(await balance("orphan"), 32141)
  assert.equal(await balance("cash"), -115988)
  assert.equal(await db.operations.count(), 1)
  assert.equal(await db.entries.count(), 2)

  await service.updateOperation(id, { fromAccountId: "cash", toAccountId: "usd", fromAmount: 215988, toAmount: 32141 })
  assert.equal(await db.accounts.get("orphan"), undefined, "a recovered account is linked for subsequent destination corrections")
  assert.equal(await balance("usd"), 132141)
  assert.equal(await balance("cash"), -115988)
})

test("recovering to another destination automatically removes the mistaken orphan account", async (t) => {
  const { db, service, balance } = await fixture(t)
  await db.accounts.add(account({ id: "orphan", openingBalance: 32141, balance: 32141 }))

  const id = await service.convertOpeningToTransfer("orphan", {
    expectedOpeningBalance: 32141, fromAccountId: "cash", toAccountId: "savings", fromAmount: 32141, occurredAt: 250,
  })

  assert.equal(await db.accounts.get("orphan"), undefined)
  assert.equal(await balance("cash"), 67859)
  assert.equal(await balance("savings"), 132141)
  assert.deepEqual((await service.getById(id)).createdAccountIds ?? [], [], "the preexisting destination must not become eligible for automatic deletion")
})

test("recovery refuses stale or used opening records and leaves all ledger data unchanged", async (t) => {
  const { db, service } = await fixture(t)
  await db.accounts.add(account({ id: "orphan", openingBalance: 32141, balance: 32141 }))
  const base = { expectedOpeningBalance: 32141, fromAccountId: "cash", toAccountId: "orphan", fromAmount: 32141, occurredAt: 250 }
  const before = await ledgerSnapshot(db)
  for (const data of [
    { ...base, expectedOpeningBalance: 32140 },
    { ...base, fromAccountId: "orphan", toAccountId: "savings" },
    { ...base, fromAmount: -32141 },
    { ...base, fromAccountId: "missing-source" },
    { ...base, toAccountId: "usd" },
  ]) {
    await assert.rejects(service.convertOpeningToTransfer("orphan", data))
    assert.deepEqual(await ledgerSnapshot(db), before)
  }
  await service.createNormal({ accountId: "orphan", effect: "increase", amount: 100, occurredAt: 200 })
  const used = await ledgerSnapshot(db)
  await assert.rejects(service.convertOpeningToTransfer("orphan", base))
  assert.deepEqual(await ledgerSnapshot(db), used, "recovery cannot delete or rewrite an account already used by another transaction")
})

test("opening recovery rejects asset deficits, debt balances, and zero openings instead of changing their financial meaning", async (t) => {
  const { db, service } = await fixture(t)
  for (const [id, openingBalance, categoryId] of [
    ["negative-asset", -32141, "assets"],
    ["positive-debt", 32141, "debts"],
    ["negative-debt", -32141, "debts"],
    ["empty-opening", 0, "assets"],
  ]) {
    await db.accounts.add(account({ id, categoryId, openingBalance, balance: openingBalance }))
    const before = await ledgerSnapshot(db)
    await assert.rejects(service.convertOpeningToTransfer(id, {
      expectedOpeningBalance: openingBalance, fromAccountId: "cash", toAccountId: id,
      fromAmount: Math.abs(openingBalance) || 100, occurredAt: 250,
    }))
    assert.deepEqual(await ledgerSnapshot(db), before)
  }
})
