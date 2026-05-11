# iOS 上架操作手册

本文档用于把「净值」从当前 Capacitor iOS 工程上传到 TestFlight，并最终提交 App Store 审核。涉及 Apple Developer 账号、App Store Connect 协议、签名证书和审核提交的步骤，必须由账号持有人或被授权成员在自己的账号下完成。

## 当前项目配置

| 项目 | 当前值 |
| --- | --- |
| App 名称 | 净值 |
| Bundle ID | `com.xueyuanhuang.balancesheet` |
| Capacitor webDir | `out` |
| iOS 最低版本 | iOS 15.0 |
| 初始版本号 | `1.0` |
| 初始 Build 号 | `1` |
| 当前设备类型 | iPhone |

> 当前 Xcode 工程已按首版 iPhone-only 配置。若后续改为 Universal App，需要在 Xcode 里重新开启 iPad 支持，并补充 iPad 截图。

## 1. 准备 Apple Developer 账号

1. 加入 Apple Developer Program，并确认 Apple ID 已开启双重认证。
2. 登录 [App Store Connect](https://appstoreconnect.apple.com/)，确认右上角账号是准备用来发布「净值」的团队。
3. 在 App Store Connect 的 Business/Agreements 里确认协议状态正常。
   - 免费 App：通常只需要 Apple Developer Program License Agreement 可用。
   - 付费 App 或含内购：需要账号持有人签 Paid Apps Agreement，并补税务/银行信息。
4. 如果不是账号持有人，确认自己至少有以下权限：
   - App Store Connect：Admin、App Manager 或 Developer。
   - Developer 账号签名相关：能使用该团队的证书、Identifier、Provisioning Profile。

## 2. 本地准备

1. 安装当前稳定版 Xcode，并在 Xcode 里登录 Apple ID：
   - Xcode -> Settings -> Accounts -> 添加 Apple ID。
   - Capacitor 8 的 iOS 工程需要 Xcode 26.0+。
   - 安装后执行：

     ```bash
     sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
     ```

2. 安装依赖：

   ```bash
   pnpm install
   ```

3. 构建 Web 静态产物：

   ```bash
   pnpm build
   ```

4. 同步 Web 产物和 Capacitor 配置到 iOS 工程：

   ```bash
   pnpm ios:sync
   ```

5. 如果图标或启动图变更过，重新生成 iOS 资源：

   ```bash
   pnpm ios:assets
   pnpm ios:sync
   ```

6. 打开 Xcode 工程：

   ```bash
   pnpm ios:open
   ```

## 3. 配置 Xcode 签名

1. 在 Xcode 左侧选择 `App` project，再选择 `App` target。
2. 打开 `Signing & Capabilities`。
3. 确认 `Bundle Identifier` 是：

   ```text
   com.xueyuanhuang.balancesheet
   ```

4. 勾选 `Automatically manage signing`。
5. 在 `Team` 里选择你的 Apple Developer 团队。
6. 如果 Xcode 提示无法创建签名资源：
   - 登录 [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)。
   - 新建 Explicit App ID，Bundle ID 填 `com.xueyuanhuang.balancesheet`。
   - 回到 Xcode 重新选择 Team 或刷新账号。
7. 在 `General` 里确认：
   - Display Name：`净值`
   - Version：首版为 `1.0`
   - Build：首个上传包为 `1`

每次重新上传同一个 Version 的 TestFlight build，都必须递增 Build 号，例如 `1` -> `2`。发布新版本时递增 Version，例如 `1.0` -> `1.1`。

## 4. 真机冒烟测试

1. 用数据线连接 iPhone。
2. Xcode 顶部设备选择你的 iPhone。
3. 点击 Run。
4. 在手机上检查：
   - App 能正常启动，不是白屏。
   - 总览、账户、流水、设置能打开。
   - 新增一笔记录后，净值和账户余额能更新。
   - 关闭再打开 App 后，本地数据仍存在。
   - 导出/导入备份入口可用。

如果真机运行白屏，通常是忘了先执行 `pnpm build` 和 `pnpm exec cap sync ios`。

## 5. 在 App Store Connect 创建 App

1. 打开 [App Store Connect](https://appstoreconnect.apple.com/) -> Apps。
2. 点击左上角 `+` -> `New App`。
3. 填写：
   - Platforms：iOS
   - Name：`净值`（如果名称被占用，需要换成可用名称）
   - Primary Language：简体中文
   - Bundle ID：选择 `com.xueyuanhuang.balancesheet`
   - SKU：建议 `balancesheet-ios`
   - User Access：按需选择 Full Access 或 Limited Access
4. 创建后，进入 App 页面补齐基础信息：
   - Category：Finance
   - Content Rights：按实际选择；本 App 如无第三方受版权保护内容，通常选择不包含。
   - Age Rating：按问卷如实回答。
   - Pricing and Availability：首版若免费，价格选 Free。

## 6. 准备 App Store 元数据

建议首版文案如下，可在 App Store Connect 里按需调整：

```text
名称：净值
副标题：个人资产负债表
关键词：资产,负债,净值,记账,多币种,资产负债表
简介：
净值是一款纯本地的个人资产负债表工具，帮助你按账户和币种记录资产、负债与净资产变化。支持多币种、转账、还款、外汇换算、净值趋势和本地备份导入导出。
```

审核备注建议填写：

```text
本 App 是纯本地个人资产负债表工具，无登录、无后台服务。用户录入的资产、负债和流水数据保存在设备本地的 WebView/IndexedDB 中，App 不上传用户财务数据。审核人员打开 App 后即可直接体验核心功能。
```

App Review 联系方式需要填写真实姓名、电话和邮箱。

## 7. 隐私信息

App Store Connect 要求填写隐私政策 URL 和 App Privacy 信息。

1. Privacy Policy URL：需要先准备一个可公开访问的隐私政策页面。
2. App Privacy：
   - 如果当前版本没有登录、后台、统计、广告、崩溃上报，也不会把用户数据发送给开发者或第三方，通常可选择 `No, we do not collect data from this app`。
   - 如果之后加入统计、Crash SDK、云同步、登录或任何外部服务，需要重新按实际情况披露收集的数据类型。
3. 隐私政策建议明确写清楚：
   - 财务数据默认只保存在用户设备本地。
   - 导出备份文件由用户自行保管。
   - 卸载 App 或清除本地数据可能导致数据丢失，除非用户提前导出备份。
   - 如未来加入云同步或分析服务，会更新隐私政策和 App Store 隐私声明。

## 8. 准备截图

App Store Connect 要求上传 1 到 10 张截图。当前工程是 iPhone-only，所以首版优先准备：

1. iPhone 截图：优先准备 6.9 英寸规格截图。
2. iPad 截图：仅当后续改为 Universal App 时再准备。

建议截图内容：

1. 总览页：展示净资产、资产/负债概览。
2. 账户页：展示多账户和多币种。
3. 流水页：展示交易记录。
4. 记账页：展示新增资产/负债变动。
5. 设置页：展示备份、汇率、隐私模式。

截图不要出现真实个人财务数据。可以用演示数据或隐私模式截图。

## 9. Archive 并上传 TestFlight

1. 在 Xcode 顶部选择 `App` scheme。
2. 设备选择 `Any iOS Device (arm64)` 或已连接真机，不要选择普通模拟器作为首选发布归档目标。
3. 菜单选择 `Product` -> `Archive`。
4. Archive 完成后会打开 Organizer。
5. 可先点击 `Validate App` 做一次上传前校验。
6. 点击 `Distribute App`。
7. 选择 `TestFlight & App Store`。
8. 选择上传到 App Store Connect。
9. 保持默认推荐选项：
   - Upload symbols
   - Automatically manage signing
   - Manage version and build number（如 Xcode 提供该选项）
10. 上传完成后，等待 App Store Connect 处理 build。通常需要几分钟到几十分钟。

## 10. TestFlight 测试

1. App Store Connect -> Apps -> 净值 -> TestFlight。
2. 等 build 状态从 Processing 变为可测试。
3. Internal Testing：
   - 创建内部测试组。
   - 添加团队成员。
   - 选择刚上传的 build。
   - 内部测试人员通过 TestFlight 安装。
4. External Testing：
   - 如需外部测试，创建外部测试组。
   - 填写 Beta App Review 所需信息。
   - 提交 Beta App Review。
   - 通过后邀请外部测试者或开启公开链接。
5. 测试重点：
   - 首次安装启动。
   - 新增、编辑、删除流水。
   - 转账、还款、多币种换算。
   - 本地数据持久化。
   - 导出/导入备份。
   - 断网情况下核心功能是否可用。

## 11. 提交 App Store 审核

1. App Store Connect -> Apps -> 净值 -> App Store。
2. 进入当前版本，例如 `1.0`。
3. 补齐所有必填项：
   - App 信息
   - 截图
   - 描述、关键词、支持 URL、隐私政策 URL
   - 年龄分级
   - 价格和可用地区
   - App Privacy
   - App Review 联系方式和审核备注
   - Export Compliance（按实际情况回答；本 App 如未使用自定义加密或专门加密功能，按 Apple 表单提示选择对应豁免项）
4. 在 Build 区域选择已通过处理的 TestFlight build。
5. 点击 `Add for Review`。
6. 进入 Draft Submission 后点击 `Submit for Review`。
7. 审核通过后，按发布设置自动发布或手动发布。

## 12. 常见问题

| 问题 | 处理 |
| --- | --- |
| Bundle ID 选不到 | 先在 Developer 账号里注册 Explicit App ID，或确认 App Store Connect 当前团队和 Xcode Team 是同一个团队。 |
| Xcode 报 No profiles for bundle identifier | 检查 Team、Bundle ID 和 Automatically manage signing；必要时删除旧 profile 后让 Xcode 重新生成。 |
| 上传失败提示 Build 已存在 | 增加 Build 号后重新 Archive。 |
| TestFlight 打开白屏 | 重新执行 `pnpm build` 和 `pnpm exec cap sync ios`，再 Archive。 |
| App Store Connect 要求 iPad 截图 | 检查 Xcode target 是否又切回 Universal App。若首版只发 iPhone，保持 iPhone-only 后重新上传。 |
| 隐私问题不知道怎么填 | 按当前版本真实数据流回答。只存在设备本地且不传给开发者/第三方的数据，通常不算开发者收集；加入云同步、统计、广告后必须更新披露。 |
| 审核问为什么需要财务数据 | 说明用户手动录入数据用于本地资产负债管理，App 不要求真实身份、不上传数据。 |

## 发布前最终清单

- [ ] `pnpm build` 通过。
- [ ] `pnpm exec cap sync ios` 已执行。
- [ ] Xcode Team、Bundle ID、Version、Build 正确。
- [ ] 真机冒烟测试通过。
- [ ] App Store Connect App 记录已创建。
- [ ] 隐私政策 URL 可访问。
- [ ] App Privacy 已按当前版本真实情况填写。
- [ ] iPhone 截图已上传。
- [ ] 如果后续切换为 Universal App，iPad 截图已上传。
- [ ] Archive 已 Validate。
- [ ] Build 已上传并通过 TestFlight 处理。
- [ ] TestFlight 安装测试通过。
- [ ] 审核备注已说明无登录、无后台、数据本地存储。
- [ ] 已提交 App Review。

## 官方参考

- [Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/)
- [Create an App Store Connect provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
