import { z } from "zod/v4"

export const categorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(20, "分类名称不超过20个字符"),
  type: z.enum(["asset", "liability"]),
  parentId: z.string().nullable(),
})

export const accountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空").max(30, "账户名称不超过30个字符"),
  categoryId: z.string().min(1, "请选择分类"),
  openingBalance: z.number().int("金额必须为整数（分）"),
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
})

export type CategoryFormData = z.infer<typeof categorySchema>
export type AccountFormData = z.infer<typeof accountSchema>
export type BackupData = z.infer<typeof backupSchema>
