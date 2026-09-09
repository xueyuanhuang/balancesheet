import type { CategoryType } from "@/types"

/** Classify the opening balance for reporting without creating another ledger entry. */
export function getOpeningBalanceType(
  openingBalance: number,
  categoryType: CategoryType
): "income" | "expense" {
  const increasesNetWorth = categoryType === "asset" ? openingBalance > 0 : openingBalance < 0
  return increasesNetWorth ? "income" : "expense"
}
