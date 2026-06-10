# 净值 — 个人资产负债表 | Net Worth Tracker

> 隐私优先的个人资产负债表 PWA：多币种、多账户，实时追踪净资产变化。数据 100% 留在你自己的设备上。

**在线使用（免注册、免安装）：** [https://balancesheet-cnt.pages.dev](https://balancesheet-cnt.pages.dev)

[English](#english) | [打赏支持](#支持作者)

## 为什么做这个

市面上的记账 App 要么强制注册、数据上云，要么专注流水记账而不是资产全貌。「净值」只回答一个问题：**我现在的净资产是多少，它在怎么变化？**

- 不需要账号，打开就能用
- 数据只存在你的浏览器里（IndexedDB），没有服务器，没人看得到你的钱
- 关注存量（资产/负债）而非流水，几分钟录完所有账户，之后每次只需更新余额

## 主要特性

- **资产/负债分类管理** — 树形分类，自由组织现金、投资、房产、贷款等
- **多币种支持** — CNY/USD/HKD/SGD，自定义汇率，一键折算汇总
- **净资产趋势图** — 每小时快照，统一用当前汇率渲染历史点位，消除汇率噪音
- **完整操作类型** — 转账、跨币种转账、借款、还款、余额调整，复式记账保证账目平衡
- **金额表达式** — 输入框直接算 `1000*7.2+50`
- **隐私模式** — 一键隐藏所有金额，图表趋势保留
- **PWA + iOS** — 添加到主屏幕即原生体验，支持离线使用
- **数据自由** — JSON 全量备份/恢复，CSV 流水导出，随时带走你的数据

## 技术栈

Next.js 16 (App Router, 静态导出) · TypeScript · Tailwind CSS · shadcn/ui (@base-ui) · Dexie.js (IndexedDB) · Recharts · Capacitor (iOS)

纯客户端架构，无后端、无埋点、无第三方数据收集。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 发布

- [iOS 上架操作手册](docs/ios-app-store-release.md)

## 支持作者

这个项目完全免费、开源、无广告。如果它帮你理清了自己的财务全貌，欢迎请作者喝杯咖啡 ☕：

**EVM 地址（ETH / USDT / USDC，支持以太坊、Base、Arbitrum 等主流链）：**

```
0x9f14F10E511b2772cc63E5667a012cEA09CECf86
```

也欢迎点个 ⭐ Star，或把它分享给需要的朋友 —— 这同样是巨大的支持。

## 联系作者

微信：`_xueyuanhuang`（备注「小作坊」进 AI 小作坊群）

用 AI 做的小工具都在这，新品尝鲜、反馈直达、一起共创。

---

## English

**Net Worth** is a privacy-first personal balance sheet PWA. Track assets, liabilities, and net worth across multiple currencies — with all data stored locally in your browser.

**Try it now (no signup):** [https://balancesheet-cnt.pages.dev](https://balancesheet-cnt.pages.dev)

### Why

Most finance apps force accounts and cloud sync, or focus on expense tracking instead of the big picture. Net Worth answers one question: **what am I worth, and how is that changing?**

- **Local-only** — data lives in IndexedDB on your device; no server, no analytics, no tracking
- **Stock, not flow** — track account balances instead of every coffee purchase; set up in minutes
- **Multi-currency** — CNY/USD/HKD/SGD with custom exchange rates and one-tap conversion
- **Double-entry operations** — transfers, FX transfers, loan drawdowns/repayments, adjustments
- **Hourly net worth snapshots** — trend chart rendered at current rates to eliminate FX noise
- **Privacy mode** — hide all amounts with one tap, keep the trends
- **Your data, portable** — full JSON backup/restore, CSV export
- **PWA + iOS** — installable, offline-capable

> UI is currently in Chinese (zh-CN). English localization is on the roadmap — star the repo to follow along.

### Support

Free, open-source, ad-free. If it helped you, consider buying me a coffee ☕

**EVM address (ETH / USDT / USDC on Ethereum, Base, Arbitrum, etc.):**

```
0x9f14F10E511b2772cc63E5667a012cEA09CECf86
```

Starring the repo and sharing it with a friend helps just as much.
