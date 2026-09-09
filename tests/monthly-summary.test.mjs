import assert from "node:assert/strict"
import test from "node:test"
import { account, deepFreeze, entry, moduleURL, operation, sourceURL } from "./helpers.mjs"

const currencyURL = await sourceURL("src/lib/utils/currency.ts")
const openingBalanceURL = await sourceURL("src/lib/utils/opening-balance.ts")
const liveQueryURL = moduleURL("export function useLiveQuery(query) { return query() }")
const timestamp = (month, day = 1) => new Date(2026, month - 1, day).getTime()

// Only external I/O is replaced: the production hook and currency conversion execute unchanged.
// The fixture rejects writes, and frozen stored records detect accidental mutation.
async function monthlySummary(fixture) {
  const data = {
    operations: [], entries: [], accounts: [], exchangeRates: [],
    categories: [{ id: "assets", type: "asset" }, { id: "debts", type: "liability" }],
    ...fixture,
  }
  const databaseURL = moduleURL(`
    ${deepFreeze.toString()}
    export const records = deepFreeze(${JSON.stringify(data)});
    const collection = (rows) => ({ toArray: async () => rows.slice() });
    const table = (rows) => new Proxy({
      ...collection(rows),
      where: (field) => ({
        between: (lower, upper, includeLower, includeUpper) => collection(rows.filter((row) =>
          (includeLower ? row[field] >= lower : row[field] > lower) &&
          (includeUpper ? row[field] <= upper : row[field] < upper))),
        anyOf: (values) => collection(rows.filter((row) => values.includes(row[field]))),
      }),
    }, {
      get(target, key) {
        if (!(key in target)) throw new Error("Unexpected database write or unsupported access: " + String(key));
        return target[key];
      },
    });
    export const db = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, table(rows)]));
  `)
  const hookURL = await sourceURL("src/lib/hooks/use-monthly-summary.ts", {
    "dexie-react-hooks": liveQueryURL,
    "@/lib/db": databaseURL,
    "@/lib/utils/currency": currencyURL,
    "@/lib/utils/opening-balance": openingBalanceURL,
  })
  const { useMonthlySummary } = await import(hookURL)
  const { records } = await import(databaseURL)
  return {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- useLiveQuery is replaced with a direct callback runner above.
    summarize: (month = 9) => useMonthlySummary(2026, month - 1),
    assertUnchanged: () => assert.deepEqual(records, data),
  }
}

test("a month with only account openings reports nonzero balances within local month boundaries", async () => {
  const { summarize, assertUnchanged } = await monthlySummary({
    accounts: [
      account({ id: "start", openingBalance: 10000, createdAt: timestamp(9) }),
      account({ id: "end", categoryId: "debts", openingBalance: 5000, createdAt: timestamp(10) - 1 }),
      account({ id: "previous", openingBalance: 20000, createdAt: timestamp(9) - 1 }),
      account({ id: "next", openingBalance: 30000, createdAt: timestamp(10) }),
      account({ id: "zero", openingBalance: 0, balance: 90000, createdAt: timestamp(9, 15) }),
    ],
  })

  const summary = await summarize()
  assert.equal(summary.totalIncome, 10000)
  assert.equal(summary.totalExpense, 5000)
  assert.equal(summary.net, 5000)
  assert.deepEqual(summary.items.map((item) => item.accountId).sort(), ["end", "start"])
  assert.ok(summary.items.every((item) => item.operationId === null && item.description === "Opening balance"))
  assert.deepEqual(await summarize(11), { totalIncome: 0, totalExpense: 0, net: 0, items: [] })
  assertUnchanged()
})

test("monthly totals combine real entries with opening balances exactly once, including FX and negative openings", async () => {
  const occurredAt = timestamp(9, 15)
  const kinds = ["normal", "normal", "normal", "adjustment", "transfer", "fx_transfer", "liability_repayment", "liability_drawdown"]
  const operations = kinds.map((kind, index) => operation({ id: `op-${index}`, kind, occurredAt, description: `Transaction ${index}` }))
  operations.push(operation({ id: "outside-month", occurredAt: timestamp(10) }))
  const { summarize, assertUnchanged } = await monthlySummary({
    accounts: [
      account({ id: "usd", name: "Dollar savings", openingBalance: 10000, balance: 99999999, currency: "USD", createdAt: timestamp(9, 2) }),
      account({ id: "debt", name: "Credit card", categoryId: "debts", openingBalance: 20000, createdAt: timestamp(9, 3) }),
      account({ id: "overdraft", openingBalance: -5000, createdAt: timestamp(9, 4) }),
      account({ id: "credit", categoryId: "debts", openingBalance: -1000, currency: "USD", createdAt: timestamp(9, 5) }),
    ],
    operations,
    entries: [
      entry({ id: "income", operationId: "op-0", accountId: "usd", effect: "increase", amount: 2000 }),
      entry({ id: "expense", operationId: "op-1", accountId: "usd", effect: "decrease", amount: 333 }),
      entry({ id: "card-spend", operationId: "op-2", accountId: "debt", effect: "increase", amount: 1500 }),
      entry({ id: "card-adjustment", operationId: "op-3", accountId: "debt", effect: "decrease", amount: 500 }),
      ...[4, 5, 6, 7].map((index) => entry({ id: `excluded-${index}`, operationId: `op-${index}`, accountId: "usd", amount: 900000 })),
      entry({ id: "outside-month", operationId: "outside-month", accountId: "usd", amount: 900000 }),
    ],
    exchangeRates: [{ currency: "USD", rateToCNY: 7.25, updatedAt: occurredAt }],
  })

  const summary = await summarize()
  assert.equal(summary.totalIncome, 94750)
  assert.equal(summary.totalExpense, 28914)
  assert.equal(summary.net, 65836)
  assert.equal(summary.items.length, 8)
  assert.equal(new Set(summary.items.map((item) => item.id)).size, 8)

  const openings = summary.items.filter((item) => item.operationId === null)
  assert.equal(openings.length, 4)
  assert.deepEqual(openings.map((item) => [item.accountId, item.type, item.amount, item.amountCNY]), [
    ["usd", "income", 10000, 72500],
    ["debt", "expense", 20000, 20000],
    ["credit", "income", 1000, 7250],
    ["overdraft", "expense", 5000, 5000],
  ])
  assert.equal(openings[0].accountName, "Dollar savings")
  assert.equal(openings[0].currency, "USD")
  assert.equal(openings[0].occurredAt, timestamp(9, 2))

  const realItems = summary.items.filter((item) => item.operationId !== null)
  assert.deepEqual(realItems.map((item) => item.operationId).sort(), ["op-0", "op-1", "op-2", "op-3"])
  assert.equal(realItems.find((item) => item.operationId === "op-1").amountCNY, 2414)
  assert.ok(realItems.every((item) => item.accountId && item.accountName))
  assert.deepEqual(await summarize(), summary)
  assertUnchanged()
})

test("changing an existing account opening changes the report without adding a second entry", async () => {
  const baseAccount = account({ openingBalance: 10000, createdAt: timestamp(9, 1) })
  const original = await monthlySummary({ accounts: [baseAccount] })
  const edited = await monthlySummary({ accounts: [{ ...baseAccount, openingBalance: 15000, updatedAt: timestamp(10, 1) }] })
  const cleared = await monthlySummary({ accounts: [{ ...baseAccount, openingBalance: 0 }] })

  const before = await original.summarize()
  const after = await edited.summarize()
  assert.equal(after.totalIncome, 15000)
  assert.equal(after.items.length, 1)
  assert.equal(after.items[0].id, before.items[0].id)
  assert.equal((await edited.summarize(10)).items.length, 0)
  assert.deepEqual(await cleared.summarize(), { totalIncome: 0, totalExpense: 0, net: 0, items: [] })
  original.assertUnchanged()
  edited.assertUnchanged()
  cleared.assertUnchanged()
})
