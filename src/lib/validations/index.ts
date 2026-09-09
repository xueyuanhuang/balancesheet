import { z } from "zod/v4"

export const categorySchema = z.object({
  name: z.string().min(1, "Enter a category name").max(20, "Use no more than 20 characters for the category name"),
  type: z.enum(["asset", "liability"]),
  parentId: z.string().nullable(),
})

export const accountSchema = z.object({
  name: z.string().min(1, "Enter an account name").max(30, "Use no more than 30 characters for the account name"),
  categoryId: z.string().min(1, "Select a category"),
  openingBalance: z.number().int("The amount must be a whole number of cents"),
  currency: z.string().default("CNY"),
  note: z.string().default(""),
})

export const operationSchema = z.object({
  id: z.string(),
  kind: z.enum(["normal", "transfer", "fx_transfer", "liability_repayment", "liability_drawdown", "adjustment"]),
  description: z.string(),
  occurredAt: z.number(),
  fxRate: z.number().nullable(),
  fxBaseCurrency: z.string().nullable(),
  fxQuoteCurrency: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const entrySchema = z.object({
  id: z.string(),
  operationId: z.string(),
  accountId: z.string(),
  role: z.enum(["source", "target"]),
  effect: z.enum(["increase", "decrease"]),
  amount: z.number().int().nonnegative(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const exchangeRateSchema = z.object({
  currency: z.string(),
  rateToCNY: z.number().positive(),
  updatedAt: z.number(),
})

export const netWorthSnapshotSchema = z.object({
  date: z.string(),
  // v2: per-currency native cents
  assets: z.record(z.string(), z.number()).optional(),
  liabilities: z.record(z.string(), z.number()).optional(),
  // v1 legacy: pre-computed CNY cents
  netWorth: z.number().optional(),
  totalAssets: z.number().optional(),
  totalLiabilities: z.number().optional(),
  createdAt: z.number(),
})

export const backupSchema = z.object({
  version: z.number(),
  exportedAt: z.number(),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["asset", "liability"]),
    parentId: z.string().nullable(),
    sortOrder: z.number(),
    isArchived: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })),
  accounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    categoryId: z.string(),
    parentId: z.string().nullable().optional(),
    openingBalance: z.number(),
    balance: z.number(),
    currency: z.string(),
    note: z.string(),
    isArchived: z.boolean(),
    sortOrder: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })),
  operations: z.array(operationSchema),
  entries: z.array(entrySchema),
  exchangeRates: z.array(exchangeRateSchema).default([]),
  netWorthSnapshots: z.array(netWorthSnapshotSchema).default([]),
})

export type CategoryFormData = z.infer<typeof categorySchema>
export type AccountFormData = z.infer<typeof accountSchema>
export type BackupData = z.infer<typeof backupSchema>
