# Net Worth — Personal Balance Sheet

A mobile-first app for tracking assets, liabilities, and net worth. The built-in interface is in English. No signup is required; your ledger is stored locally in your browser with IndexedDB.

[Public website](https://balancesheet-cnt.pages.dev) · [GitHub](https://github.com/xueyuanhuang/balancesheet)

## Features

- **Accounts and categories:** Organize assets and liabilities in a tree. Accounts can belong directly to parent categories as well as their subcategories.
- **Multiple currencies:** CNY, USD, HKD, and SGD, with exchange-rate conversion for combined totals.
- **Activity:** Income, expenses, transfers, currency exchanges, borrowing, repayments, and adjustments, with account links and running balances.
- **Opening records:** Accounts with a nonzero opening balance have an “Account opened” record, dated when the account was created. Existing accounts are included automatically; zero openings are omitted.
- **Monthly reporting:** Positive asset openings count as income and positive liability openings as expenses in the account creation month. Negative openings reverse the direction. These records are derived from accounts and do not add another ledger entry or change balances. Transfers and repayments remain excluded from monthly income/expense totals.
- **Overview charts:** Net-worth history and six months of net income, income, and expenses. Net income is income minus expenses. Historical net-worth snapshots use current exchange rates; snapshots are recorded during Overview use, grouped by hour.
- **Amount expressions:** Calculate amounts such as `1000 * 7.2 + 50` inside the transaction form.
- **Privacy mode:** Hide amounts while keeping chart shapes visible.
- **Portable data:** Full JSON backup and restore, plus CSV export of recorded transactions. JSON import replaces the destination ledger; it does not merge. Opening records are reconstructed from backed-up accounts. CSV contains recorded transactions only.
- **PWA and iOS:** Install the web app on a home screen or use the included Capacitor iOS project.

Saved account names, category names, and notes retain the text entered by the user. New suggested categories are in English.

## Development

Use pnpm 9 and Node.js 22 or later for both web and native tooling. This version was checked with Node.js 24 and pnpm 9.15.9.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use fictional data on localhost for development. Browser profiles and different origins have separate ledgers.

```sh
pnpm test
pnpm lint
pnpm build
```

Tests use Node's built-in test runner and the existing TypeScript dependency. They cover opening activity, filters, ordering, monthly reporting, currency conversion, and unchanged stored balances.

## Architecture and release

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui on Base UI, Dexie, Recharts, and Capacitor. The web app is a static export with no application backend. It fetches public exchange rates; ledger data stays local.

- `src/lib/db/`: Dexie schema and migrations, currently v13.
- `src/lib/services/`: Ledger writes, balance recalculation, backups, and snapshots.
- `src/lib/hooks/`: Reactive queries and reporting.
- `src/components/`: Shared UI and domain components.
- `src/app/`: Routes and pages.

`pnpm build` generates `out/`. The checked-in GitHub Actions workflow deploys pushes to `main` to Cloudflare Pages. For iOS packaging, see the [iOS release guide](docs/ios-app-store-release.md).

## Support and contact

Free, open source, and ad-free. Stars, feedback, and sharing the app are welcome.

EVM donation address (ETH / USDT / USDC on supported networks):

```text
0x9f14F10E511b2772cc63E5667a012cEA09CECf86
```

WeChat: `_xueyuanhuang`. Ask to join the AI Workshop group for new tools and feedback.
