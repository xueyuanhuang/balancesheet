import "fake-indexeddb/auto"
import assert from "node:assert/strict"
import test from "node:test"
import { account, entry, moduleURL, operation, sourceURL } from "./helpers.mjs"

let fixtureId = 0

async function fixture(t, filename, hookName) {
  const id = ++fixtureId
  const databaseURL = moduleURL(`
    import { Dexie } from ${JSON.stringify(import.meta.resolve("dexie"))};
    export const db = new Dexie("live-record-hooks-${id}");
    db.version(1).stores({ accounts: "id,sortOrder", categories: "id", operations: "id", entries: "id,operationId,accountId" });
  `)
  // Match Dexie's retained-result behavior while letting the test control when
  // an asynchronous query finishes. The production queries still use IndexedDB.
  const harnessURL = moduleURL(`
    // Fixture ${id}
    let query;
    let result;
    let hasResult = false;
    export function useLiveQuery(nextQuery, deps, defaultResult) {
      query = nextQuery;
      return hasResult ? result : defaultResult;
    }
    export async function refresh() {
      result = await query();
      hasResult = true;
    }
  `)
  const activityURL = await sourceURL("src/lib/utils/activity.ts")
  const hookURL = await sourceURL(`src/lib/hooks/${filename}.ts`, {
    "dexie-react-hooks": harnessURL,
    "@/lib/db": databaseURL,
    "@/lib/utils/activity": activityURL,
  })
  const { db } = await import(databaseURL)
  const { refresh } = await import(harnessURL)
  const hook = (await import(hookURL))[hookName]
  await db.open()
  t.after(() => db.delete())
  return { db, hook, refresh }
}

for (const [filename, hookName, table, records] of [
  ["use-accounts", "useAccount", "accounts", [account({ id: "first", currency: "CNY" }), account({ id: "second", currency: "USD" })]],
  ["use-categories", "useCategory", "categories", [{ id: "first", type: "asset" }, { id: "second", type: "liability" }]],
]) {
  test(`${hookName} hides the old record while a different ID is loading`, async (t) => {
    const { db, hook, refresh } = await fixture(t, filename, hookName)
    await db[table].bulkAdd(records)
    assert.equal(hook("first"), undefined)
    await refresh()
    assert.equal(hook("first").id, "first")

    assert.equal(hook("second"), undefined, "the previous currency/category must not apply to the new selection")
    await refresh()
    assert.equal(hook("second").id, "second")
    assert.equal(hook(undefined), undefined, "clearing the selection must immediately clear the old record")
  })
}

test("useOperation never initializes another transfer's editor with a retained result", async (t) => {
  const { db, hook, refresh } = await fixture(t, "use-operations", "useOperation")
  await db.operations.bulkAdd([
    operation({ id: "first", kind: "transfer", description: "First transfer" }),
    operation({ id: "second", kind: "transfer", description: "Second transfer" }),
  ])
  await db.entries.bulkAdd([
    entry({ id: "first-source", operationId: "first", accountId: "cash", role: "source", amount: 1000 }),
    entry({ id: "first-target", operationId: "first", accountId: "savings", role: "target", amount: 1000 }),
    entry({ id: "second-source", operationId: "second", accountId: "savings", role: "source", amount: 2500 }),
    entry({ id: "second-target", operationId: "second", accountId: "card", role: "target", amount: 2500 }),
  ])
  assert.equal(hook("first"), undefined)
  await refresh()
  assert.equal(hook("first").operation.description, "First transfer")
  assert.equal(hook("second"), undefined)
  await refresh()
  const loaded = hook("second")
  assert.equal(loaded.operation.description, "Second transfer")
  assert.deepEqual(loaded.entries.map(({ accountId, amount }) => [accountId, amount]), [["savings", 2500], ["card", 2500]])
  assert.equal(hook("missing"), undefined)
  await refresh()
  assert.equal(hook("missing"), null, "a completed missing-record query is different from loading")
  assert.equal(hook("first"), undefined, "a retained missing result cannot hide a saved transfer")
  await refresh()
  assert.equal(hook("first").operation.id, "first")
})

test("activity publishes opening balances and complete saved transfers together, without stale filtered rows", async (t) => {
  const { db, hook, refresh } = await fixture(t, "use-activity", "useActivity")
  await db.accounts.bulkAdd([
    account({ id: "cash", openingBalance: 10000 }),
    account({ id: "savings" }),
  ])
  await db.operations.add(operation({ id: "transfer", kind: "transfer", description: "Saved transfer" }))
  await db.entries.bulkAdd([
    entry({ id: "source", operationId: "transfer", accountId: "cash", role: "source", amount: 1000 }),
    entry({ id: "target", operationId: "transfer", accountId: "savings", role: "target", amount: 1000 }),
  ])

  assert.deepEqual(hook(), [])
  const loading = refresh()
  assert.deepEqual(hook(), [], "do not expose opening rows while the transfer is still loading")
  await loading
  const complete = hook()
  assert.deepEqual(complete.map(({ type }) => type), ["operation", "opening_balance"])
  assert.equal(complete[0].data.entries.length, 2)

  assert.deepEqual(hook({ accountId: "savings" }), [], "do not show the previous account's opening row")
  await refresh()
  assert.deepEqual(hook({ accountId: "savings" }).map(({ id }) => id), ["operation:transfer"])
  assert.deepEqual(hook({ accountId: "savings", kind: "opening_balance" }), [], "do not show a retained transfer after the filter changes")
  await refresh()
  assert.deepEqual(hook({ accountId: "savings", kind: "opening_balance" }), [])
})
