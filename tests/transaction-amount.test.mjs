import assert from "node:assert/strict"
import test from "node:test"
import { sourceURL } from "./helpers.mjs"

const { evaluateAmountExpression } = await import(await sourceURL("src/lib/utils/amount-expression.ts"))
const { normalizeEntryAmount, normalizeTransferAmounts } = await import(await sourceURL("src/lib/utils/transaction-amount.ts"))

test("signed expressions accept negative results without accepting zero or unfinished input", () => {
  for (const [raw, expected] of [["-100", -10000], ["50-100", -5000], ["−（２０＋３０）", -5000], ["-(4*25)", -10000]]) {
    const status = evaluateAmountExpression(raw, true)
    assert.equal(status.isValid, true, raw)
    assert.equal(status.cents, expected, raw)
  }
  for (const raw of ["", "-", "100-", "0", "10-10", "-0.004", "1/0", "999999999999999999999"]) {
    assert.equal(evaluateAmountExpression(raw, true).isValid, false, raw)
  }
  assert.equal(evaluateAmountExpression("-10").isValid, false, "other amount fields retain positive-only validation")
  assert.equal(evaluateAmountExpression("-0.005", true).cents, -1)
  assert.equal(evaluateAmountExpression("0.005", true).cents, 1)
})

test("negative income and expense flip once; normalized values are stable", () => {
  for (const [selected, expected] of [["increase", "decrease"], ["decrease", "increase"]]) {
    const normalized = normalizeEntryAmount(-12345, selected)
    assert.deepEqual(normalized, { amount: 12345, effect: expected })
    assert.deepEqual(normalizeEntryAmount(normalized.amount, normalized.effect), normalized)
    assert.deepEqual(normalizeEntryAmount(12345, selected), { amount: 12345, effect: selected })
  }
})

test("either transfer amount can reverse direction once, preserving each account's native amount", () => {
  for (const [fromAmount, toAmount] of [[-70000, 10000], [70000, -10000], [-70000, -10000]]) {
    const normalized = normalizeTransferAmounts({ fromAccountId: "cny", toAccountId: "usd", fromAmount, toAmount })
    assert.deepEqual(normalized, { fromAccountId: "usd", toAccountId: "cny", fromAmount: 10000, toAmount: 70000 })
    assert.deepEqual(normalizeTransferAmounts(normalized), normalized)
  }
  assert.deepEqual(normalizeTransferAmounts({ fromAccountId: "a", toAccountId: "b", fromAmount: -100 }), {
    fromAccountId: "b", toAccountId: "a", fromAmount: 100, toAmount: 100,
  })
})

test("invalid monetary values cannot be normalized into ledger entries", () => {
  for (const amount of [0, -0, NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => normalizeEntryAmount(amount, "increase"))
    assert.throws(() => normalizeTransferAmounts({ fromAccountId: "a", toAccountId: "b", fromAmount: 100, toAmount: amount }))
  }
})
