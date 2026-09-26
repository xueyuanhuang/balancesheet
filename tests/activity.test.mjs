import assert from "node:assert/strict"
import test from "node:test"
import { account, deepFreeze, entry, operation, sourceURL } from "./helpers.mjs"

const { buildActivity, findAccountCreationTransfer } = await import(await sourceURL("src/lib/utils/activity.ts"))
const { getOpeningBalanceType } = await import(await sourceURL("src/lib/utils/opening-balance.ts"))

test("existing nonzero account openings appear at creation time; zero balances stay hidden", () => {
  const accounts = [
    account({ id: "savings", openingBalance: 12500, balance: 15000, createdAt: 100, updatedAt: 900 }),
    account({ id: "overdraft", openingBalance: -2000, createdAt: 200 }),
    account({ id: "empty", openingBalance: 0, balance: 8000, createdAt: 300 }),
  ]
  const items = buildActivity([], accounts)

  assert.equal(items.length, 2)
  assert.deepEqual(items.map((item) => [item.type, item.account.id, item.account.openingBalance, item.occurredAt]), [
    ["opening_balance", "overdraft", -2000, 200],
    ["opening_balance", "savings", 12500, 100],
  ])
})

test("opening records and unchanged real transactions form one newest-first timeline without mutating inputs", () => {
  const operations = [
    { operation: operation({ id: "older", occurredAt: 150 }), entries: [entry({ operationId: "older" })] },
    { operation: operation({ id: "newer", kind: "transfer", occurredAt: 350 }), entries: [entry({ operationId: "newer" })] },
  ]
  const accounts = [account({ openingBalance: 5000, createdAt: 200 })]
  const before = structuredClone({ operations, accounts })
  deepFreeze(operations)
  deepFreeze(accounts)

  const items = buildActivity(operations, accounts)

  assert.deepEqual(items.map((item) => item.occurredAt), [350, 200, 150])
  assert.strictEqual(items[0].data, operations[1])
  assert.strictEqual(items[2].data, operations[0])
  assert.strictEqual(items[1].account, accounts[0])
  assert.deepEqual({ operations, accounts }, before)
})

test("activity filters include matching opening records and retain transaction filtering", () => {
  const accounts = [
    account({ id: "savings", name: "Travel Savings", openingBalance: 10000, createdAt: 100 }),
    account({ id: "card", name: "Credit Card", categoryId: "debts", openingBalance: 3000, createdAt: 300 }),
  ]
  const operations = [
    { operation: operation({ id: "flight", description: "Flight booking", occurredAt: 200 }), entries: [entry({ accountId: "savings", operationId: "flight" })] },
    { operation: operation({ id: "move", kind: "transfer", description: "Move to savings", occurredAt: 400 }), entries: [entry({ accountId: "card", operationId: "move" })] },
  ]
  const ids = (filters) => buildActivity(operations, accounts, filters).map((item) =>
    item.type === "opening_balance" ? item.account.id : item.data.operation.id)

  assert.deepEqual(ids({ kind: "opening_balance" }), ["card", "savings"])
  assert.deepEqual(ids({ kind: "normal" }), ["flight"])
  assert.deepEqual(ids({ kind: "transfer" }), ["move"])
  assert.deepEqual(ids({ accountId: "savings" }), ["flight", "savings"])
  assert.deepEqual(ids({ keyword: "  sAvInGs  " }), ["move", "savings"])
  assert.deepEqual(ids({ keyword: "Opening balance" }), ["card", "savings"])
  assert.deepEqual(ids({ startDate: 100, endDate: 300 }), ["card", "flight", "savings"])
  assert.deepEqual(ids({ accountId: "savings", kind: "opening_balance", startDate: 101 }), [])
})

test("editing an account updates its single opening record and setting it to zero removes it", () => {
  const original = account({ openingBalance: 10000 })
  const initial = buildActivity([], [original])
  const edited = { ...original, name: "Savings", openingBalance: 25000, updatedAt: 800 }
  const updated = buildActivity([], [edited])

  assert.equal(updated.length, 1)
  assert.equal(updated[0].id, initial[0].id)
  assert.equal(updated[0].account.openingBalance, 25000)
  assert.equal(updated[0].account.name, "Savings")
  assert.equal(updated[0].occurredAt, original.createdAt)
  assert.deepEqual(buildActivity([], [edited]), updated)
  assert.deepEqual(buildActivity([], [{ ...edited, openingBalance: 0 }]), [])
  assert.equal(initial[0].account.openingBalance, 10000)
})

for (const [category, amount, expected] of [
  ["asset", 10000, "income"],
  ["liability", 10000, "expense"],
  ["asset", -10000, "expense"],
  ["liability", -10000, "income"],
]) {
  test(`${category} opening of ${amount} cents is reported as ${expected}`, () => {
    assert.equal(getOpeningBalanceType(amount, category), expected)
  })
}

function savedTransfer(id, createdAccountIds) {
  return {
    operation: operation({ id, kind: "fx_transfer", description: "Original transfer", createdAccountIds }),
    entries: [
      entry({ id: `${id}-from`, operationId: id, accountId: "bank", role: "source", amount: 230000 }),
      entry({ id: `${id}-to`, operationId: id, accountId: "others", role: "target", effect: "increase", amount: 32141 }),
    ],
  }
}

test("an account opening linked to a saved transfer opens that exact transfer with its original entries", () => {
  const original = savedTransfer("saved-transfer", ["others"])
  const later = savedTransfer("later-transfer", undefined)
  const opening = account({ id: "others", openingBalance: 32141, currency: "USD" })
  deepFreeze(original)
  const resolved = findAccountCreationTransfer("others", [later, original])
  assert.strictEqual(resolved, original)
  assert.equal(resolved.entries.find((entry) => entry.role === "source").accountId, "bank")
  assert.equal(resolved.entries.find((entry) => entry.role === "target").amount, 32141)
  const row = buildActivity([later, original], [opening]).find((item) => item.type === "opening_balance")
  assert.equal(row.transferOperationId, "saved-transfer")
})

test("an opening without a saved transfer never acquires a guessed source from similar history", () => {
  const legacy = savedTransfer("legacy-transfer", undefined)
  assert.equal(findAccountCreationTransfer("others", [legacy]), undefined)
  const row = buildActivity([], [account({ id: "others", openingBalance: 32141 })])[0]
  assert.equal(row.transferOperationId, undefined)
})

test("incomplete, conflicting, or unrelated ownership cannot resolve a transfer", () => {
  const first = savedTransfer("first", ["others"])
  const second = savedTransfer("second", ["others"])
  assert.equal(findAccountCreationTransfer("others", [first, second]), undefined)
  assert.equal(findAccountCreationTransfer("others", [{ ...first, entries: [first.entries[1]] }]), undefined)
  assert.equal(findAccountCreationTransfer("unrelated", [first]), undefined)
  assert.equal(findAccountCreationTransfer("others", [{ ...first, entries: first.entries.map((entry) => ({ ...entry, operationId: "wrong" })) }]), undefined)
})
