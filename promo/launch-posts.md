# 推广发布文案包

各平台可直接复制发布的文案。发布顺序建议：V2EX → 即刻/小红书 → Show HN → Reddit → X。
每个平台发布后，把链接记录到本文件底部的「发布记录」，方便追踪效果。

链接：
- 在线版：https://balancesheet-cnt.pages.dev
- 源码：https://github.com/xueyuanhuang/balancesheet

---

## 1. V2EX（分享创造节点 /go/create）

**标题：**

做了一个纯本地的个人资产负债表 PWA：多币种记净值，数据不出浏览器

**正文：**

市面上的记账 App 要么强制注册、数据上云，要么只关注流水（今天花了多少钱），而我真正想知道的是：**我现在的净资产到底是多少，趋势怎么样？**

于是做了「净值」—— 一个隐私优先的个人资产负债表工具：

- 纯前端，数据只存在浏览器 IndexedDB 里，没有后端、没有埋点，没人看得到你的钱
- 不记流水记存量：录入各账户余额（现金/券商/房贷/信用卡…），自动算净资产
- 多币种（CNY/USD/HKD/SGD），自定义汇率折算；趋势图统一按当前汇率渲染，消除汇率波动噪音
- 转账/还款/借款/跨币种转账都是复式记账，账目永远平衡
- 隐私模式一键隐藏金额（在公司摸鱼看盘必备）
- PWA 添加到主屏即原生体验，支持离线；JSON 备份随时导出走人

在线用（免注册）：https://balancesheet-cnt.pages.dev
源码：https://github.com/xueyuanhuang/balancesheet

技术栈：Next.js 16 静态导出 + Dexie.js + shadcn/ui，部署在 Cloudflare Pages。

欢迎拍砖，有什么想要的功能直接提。

---

## 2. Show HN（news.ycombinator.com/submit）

**Title:**

Show HN: A local-only net worth tracker PWA – no signup, no server, no tracking

**URL:** https://github.com/xueyuanhuang/balancesheet

**First comment (post immediately after submitting):**

I built this because every net worth app I tried wanted my email, my bank credentials, or both. This one is a static Next.js export — all data lives in IndexedDB in your browser. There is literally no backend to leak your finances.

Design choices that might be interesting:

- It tracks *stock* (account balances) rather than *flow* (transactions). Setting up takes minutes; maintenance is just updating balances occasionally.
- Operations are double-entry: transfers, FX transfers, loan drawdowns/repayments all produce balanced entries, so the books always reconcile.
- Multi-currency with a twist: hourly net worth snapshots store per-currency breakdowns, and the trend chart renders *all* historical points at current exchange rates — so the chart shows your actual wealth trend, not FX noise.
- Money is stored as integer cents end-to-end. No floating point.

Live demo (UI is Chinese for now, English on the roadmap — the layout is simple enough to navigate): https://balancesheet-cnt.pages.dev

Stack: Next.js 16 (static export), Dexie.js/IndexedDB, shadcn/ui, Recharts, Capacitor for iOS. Happy to answer anything about the local-first approach.

---

## 3. 小红书

**标题：**

终于不用 Excel 记净资产了！自己写了个隐私优先的资产看板

**正文：**

一直用 Excel 记每月净资产，麻烦还容易忘。市面上的 App 都要注册上传数据，看自己的钱还要先把家底交给别人？？

干脆自己写了一个：

✅ 打开网页就能用，不用注册不用下载
✅ 数据只存在你手机/电脑本地，开发者都看不到
✅ 支持人民币/美元/港币/新币，自动折算
✅ 净资产趋势图，资产负债一目了然
✅ 隐私模式：一键隐藏金额，地铁上也能放心看
✅ 加到主屏幕就是个 App，还能离线用

完全免费无广告，链接放评论区 👇

#记账 #理财 #净资产 #资产配置 #效率工具 #程序员

（评论区第一条放链接：https://balancesheet-cnt.pages.dev）

---

## 4. 即刻（效率工具/搞钱圈子）

刚上线了一个小工具：「净值」—— 纯本地的个人资产负债表。

起因是想每月看一眼净资产趋势，但所有 App 都要注册+上云。我对「记账软件拿走我全部财务数据」这件事过敏，所以做了个纯前端版本：数据只在浏览器 IndexedDB，没有服务器。

多币种、复式记账、隐私模式、PWA 离线可用。免费开源。

https://balancesheet-cnt.pages.dev

---

## 5. Reddit（r/SideProject 或 r/selfhosted）

**Title (r/SideProject):**

I built a net worth tracker that never sends your data anywhere — it's a static page + IndexedDB

**Body:**

Every personal finance app wants signup + cloud sync. For *net worth tracking* that's overkill — you don't need bank integrations, you just need to update a dozen balances once in a while.

So: a PWA where everything lives in your browser's IndexedDB. No backend exists. Features: multi-currency with custom FX rates, double-entry transfers/loans, hourly net-worth snapshots with an FX-noise-free trend chart, privacy mode, JSON backup/export.

Live: https://balancesheet-cnt.pages.dev (UI is Chinese for now — English planned; layout is simple)
Code: https://github.com/xueyuanhuang/balancesheet

Stack: Next.js static export, Dexie.js, shadcn/ui. Feedback very welcome, especially on the local-first data model.

> r/selfhosted 版本开头可加一句：Technically nothing to self-host — it's local-first, which is even more private than self-hosting. Deploy the static export anywhere (it's just files).

---

## 6. X / Twitter（thread）

**Tweet 1:**

Every net worth app: "Sign up! Link your bank! Trust us with everything!"

Me: built one where the data physically cannot leave your browser.

No server. No analytics. Just IndexedDB.

https://balancesheet-cnt.pages.dev

**Tweet 2:**

Design choice I'm happy with: track stock, not flow.

Expense trackers die because logging every coffee is a chore. Balance sheets survive — update 10 numbers monthly, get your true net worth + trend.

**Tweet 3:**

Fun technical bit: hourly snapshots store per-currency breakdowns, and the chart renders ALL history at today's FX rates.

Your net worth chart shows wealth changes — not USD/CNY wiggle.

Open source: https://github.com/xueyuanhuang/balancesheet

---

## 发布注意事项

- **V2EX**：工作日上午 10 点或下午 3 点发，发完头几条回复要快，被顶上首页全靠前 2 小时互动
- **HN**：美西时间早上 6–9 点（北京时间 21:00–24:00）提交最佳；标题别用感叹号；提交后立刻发 first comment
- **小红书**：链接放评论区而非正文（正文带链接会被限流）；配 3–4 张 App 截图，现成的在 `promo/screenshots/`（演示数据已填好，净资产 180 万的曲线图很出片）
- **Reddit**：先看各 sub 的 self-promo 规则；r/SideProject 最宽松；不要同一天发多个 sub
- **共同原则**：打赏地址不放正文（会被当广告/乞讨），让感兴趣的人自己在 README / App 设置页里发现

## 发布记录

| 日期 | 平台 | 链接 | 备注 |
|---|---|---|---|
| | | | |
