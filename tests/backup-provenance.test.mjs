import assert from "node:assert/strict"
import test from "node:test"
import { account, operation, sourceURL } from "./helpers.mjs"

const validationURL = await sourceURL("src/lib/validations/index.ts", {
  "zod/v4": import.meta.resolve("zod/v4"),
})
const { backupSchema } = await import(validationURL)

function backup(operations) {
  return {
    version: 4, exportedAt: 300,
    categories: [{ id: "assets", name: "Assets", type: "asset", parentId: null, sortOrder: 0, isArchived: false, createdAt: 100, updatedAt: 100 }],
    accounts: [account({ id: "new-destination" })],
    operations,
    entries: [], exchangeRates: [], netWorthSnapshots: [],
  }
}

test("backup validation preserves transfer-created account ownership through a JSON round trip", () => {
  const original = backup([operation({ kind: "transfer", createdAccountIds: ["new-destination"] })])

  const restored = backupSchema.parse(JSON.parse(JSON.stringify(original)))

  assert.deepEqual(restored.operations[0].createdAccountIds, ["new-destination"], "restored transfers must still support safe automatic account cleanup")
})

test("backups made before transfer account linking remain valid without acquiring ownership", () => {
  const restored = backupSchema.parse(backup([operation({ kind: "transfer" })]))

  assert.equal(restored.operations[0].createdAccountIds, undefined, "legacy backups must never infer permission to delete a preexisting account")
})

test("backup validation rejects malformed account ownership metadata", () => {
  for (const createdAccountIds of ["new-destination", [123], null]) {
    assert.equal(backupSchema.safeParse(backup([operation({ kind: "transfer", createdAccountIds })])).success, false)
  }
})
