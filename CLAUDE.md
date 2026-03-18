# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow
- **【强制】需求确认优先**：收到任何功能需求或修改请求后，必须先用中文复述理解（改什么、怎么改、数据影响），然后等用户明确确认后才能写代码。未经确认不得动手。
- Prefer using sub-agents (Task tool) for parallel execution whenever possible, maximize parallelism

## Commands
- `pnpm dev` — Start dev server (port 3000)
- `pnpm dev --hostname 0.0.0.0` — Start dev server accessible on LAN (for mobile testing)
- `pnpm build` — Production build (also runs TypeScript checks)
- `pnpm lint` — Run ESLint
- `git push` — Auto-deploys to Vercel (https://balancesheet-sigma.vercel.app)

## Architecture

Personal balance sheet PWA — mobile-first, fully client-side (no backend). Data lives in IndexedDB via Dexie.js. Supports multi-currency (CNY/USD/HKD).

### Layer Structure
1. **DB** (`lib/db/`) — Dexie schema currently at v11 (IDB v110 after ×10 multiplier). 5 active tables: categories, accounts, operations, entries, exchangeRates. The `transactions` table from v1 was deleted in v2. v11 was added to force-upgrade databases stuck at IDB v10.
2. **Services** (`lib/services/`) — Business logic, all writes go through here. Services handle validation, cascade operations, and balance recalculation
3. **Hooks** (`lib/hooks/`) — Reactive queries via `dexie-react-hooks` (`useLiveQuery`). All marked `"use client"`
4. **Components** — shadcn/ui on `@base-ui/react` (NOT Radix), plus domain components
5. **Pages** (`app/`) — Next.js 16 App Router. Root layout is Server Component; all pages are `"use client"`

### Domain Model
- **Category** — hierarchical (parentId adjacency list), typed as `"asset" | "liability"`
- **Account** — belongs to a category, has a `currency` (CNY/USD/HKD). `balance` is cached field recalculated from entries. One account = one currency; same-name accounts with different currencies are grouped in the UI
- **Operation** — a logical financial event with `kind`: normal, transfer, fx_transfer, liability_repayment, liability_drawdown, adjustment. Stores optional FX rate snapshot for cross-currency operations
- **Entry** — one or two per operation. Has `role` (source/target), `effect` (increase/decrease), and `amount` in the account's native currency cents
- **ExchangeRate** — per-currency rate to CNY (e.g., 1 USD = 7.25 CNY)

### Operation Kind Rules
| from type | to type | same currency | Kind | from effect | to effect |
|---|---|---|---|---|---|
| asset | asset | yes | transfer | decrease | increase |
| asset | asset | no | fx_transfer | decrease | increase |
| asset | liability | any | liability_repayment | decrease | decrease |
| liability | asset | any | liability_drawdown | increase | increase |
| — | — | — | normal/adjustment | user-chosen | — |

### Key Conventions
- **All money in cents (分)** — stored as positive integers, avoids floating-point issues. Use `formatAmount(cents, currency?)` for display, `parseToCents()` for input
- **Multi-currency** — accounts store balance in native currency. Use `convertToCNY()` from `lib/utils/currency.ts` for aggregation. `getCurrencySymbol()` from `lib/utils/constants.ts` for display
- **shadcn uses `@base-ui/react`** — SheetTrigger/DialogTrigger use `render` prop, NOT `asChild`
- **Dynamic Lucide icons** — use `getIcon(name)` from `lib/utils/icons.ts`, never cast `* as LucideIcons` directly (causes TS errors)
- **Zod v4** — import from `zod/v4`
- **Balance formula** — `account.balance = openingBalance + sum(increase entries) - sum(decrease entries)`. Recalculated by `accountService.recalculateBalance()` after every operation write
- **Account protection** — accounts with entries cannot be deleted (only archived) and cannot change currency
- **Cascade delete** — deleting a category removes all descendants
- **ID generation** — `generateId()` from `lib/utils/id.ts` (wraps nanoid)
- **Chinese locale** — all UI text in zh-CN, date-fns uses `zhCN` locale
- **Dexie transaction scope** — when calling `db.transaction("rw", [...], ...)`, ALL tables accessed inside the callback must be declared in the scope array. Accessing `db.categories` inside a transaction scoped to only `[db.operations, db.entries, db.accounts]` throws `IDBTransaction objectStore not found`
- **Currency display** — `lib/hooks/use-currency-display.ts` persists display mode (auto/CNY/USD/HKD) in localStorage. `convertFromCNY()` in `lib/utils/currency.ts` handles reverse conversion with null fallback when rate is missing

### Navigation
Bottom nav: 4 tabs (总览/账户/流水/设置) + center FAB (记账). Categories page and exchange rate settings are accessed from Settings.
