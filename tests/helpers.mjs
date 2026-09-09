import { readFile } from "node:fs/promises"
import ts from "typescript"

export function moduleURL(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

// Run the production TypeScript with Node's built-in runner and existing TypeScript dependency.
export async function sourceURL(path, imports = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8")
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  for (const [specifier, url] of Object.entries(imports)) {
    outputText = outputText.replaceAll(JSON.stringify(specifier), JSON.stringify(url))
  }
  return moduleURL(outputText)
}

export function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export function account(overrides = {}) {
  return {
    id: "cash", name: "Cash", categoryId: "assets", openingBalance: 0,
    balance: 0, currency: "CNY", note: "", isArchived: false, sortOrder: 0,
    createdAt: 100, updatedAt: 100, ...overrides,
  }
}

export function operation(overrides = {}) {
  return {
    id: "purchase", kind: "normal", description: "Groceries", occurredAt: 200,
    fxRate: null, fxBaseCurrency: null, fxQuoteCurrency: null,
    createdAt: 200, updatedAt: 200, ...overrides,
  }
}

export function entry(overrides = {}) {
  return {
    id: "purchase-entry", operationId: "purchase", accountId: "cash", role: "source",
    effect: "decrease", amount: 500, createdAt: 200, updatedAt: 200, ...overrides,
  }
}
