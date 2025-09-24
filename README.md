# Alpha Volatility Radar

一个可以部署到 Vercel 或 Cloudflare Pages/Workers 的 SaaS 仪表盘，围绕 Binance Alpha 的最新上线代币数据构建。项目基于 **Next.js 15 App Router**，结合 Dynamic.xyz 的 Web3 登录、Supabase 数据库存储以及 Stripe 订阅计费，让你可以快速验证产品思路并上线收费服务。

> 2024 Q4 已完成依赖升级：Next.js 15.0.3、Stripe Node 16.x、Supabase JS 2.48、Dynamic SDK 3.x、TypeScript 5.6、ESLint 9，并通过 `overrides` 强制提升 WalletConnect、glob、rimraf 等传递依赖版本，以消除常见的 npm WARN。

## 功能亮点

- **Binance Alpha 数据处理**：通过服务器端 API 请求官方接口，筛选出 30 天内上市的代币，并计算 24 小时波动率后按稳定性排序。
- **实时前端展示**：使用 Next.js App Router 构建的响应式页面，可在桌面或移动端查看代币列表与关键指标。
- **Dynamic.xyz 登录**：集成 Dynamic Widget，支持钱包一键登录；登录后的核心信息会自动写入 Supabase。
- **Supabase 存储**：使用 service role key 在服务端执行 upsert 操作，方便统计用户来源与活跃度。
- **Stripe 订阅**：内置 Checkout API，配置价格 ID 后即可引导用户完成订阅付款。
- **WebSocket 波动率快照**：新增 `/api/alpha-stream` API，会在服务端连接 Binance 的 aggTrade 频道，计算 50 tick 标准差并在前端以图形化面板展示。
- **离线演示模式**：当运行环境无法访问 Binance 域名时，`/api/tokens` 会自动使用 `config/sample-alpha-tokens.json` 中的示例数据，界面仍能正常渲染并给出提示，方便在受限网络中调试。

## 快速开始

### 1. 克隆并安装依赖

确保你的本地 Node.js 版本满足 Next.js 15 的最低要求（>= 18.18 或 20.x/22.x LTS）。建议在升级依赖前移除旧的 `node_modules` 与 `package-lock.json`：

```bash
rm -rf node_modules package-lock.json
npm install
npm audit fix
```

> 如遇到企业代理或动态私有源，可使用 `npm config set registry <mirror>` 或启用 `.npmrc` 的 token；我们已经在 `package.json` 中加入 `overrides`，绝大多数 npm WARN 与高危漏洞会在安装时自动处理。

### 2. 配置环境变量

复制 `.env.example` 并填入你自己的密钥。

```bash
cp .env.example .env.local
```

需要的参数说明：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | Dynamic 控制台中的 Environment ID，用于前端初始化 Widget |
| `SUPABASE_URL` | Supabase 项目的 REST URL，例如 `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 密钥，仅应保存在服务器端 |
| `STRIPE_SECRET_KEY` | Stripe Secret Key（可使用测试 key） |
| `STRIPE_PRICE_ID` | Stripe 中的订阅产品 ID（必须以 `prod_` 开头，例如 `prod_RytGhHNHaATKG5`）。后端会自动解析该产品启用的按月订阅价格 |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | Stripe Checkout 完成或取消时跳转的页面 |
| `BINANCE_WS_URL` | Binance Alpha WebSocket 入口，默认 `wss://nbstream.binance.com/w3w/wsa/stream` |
| `BINANCE_WS_BASE_STREAMS` | 额外订阅的公共频道列表（逗号分隔），默认 `came@allTokens@ticker24` |
| `BINANCE_WS_HEADERS` | （可选）自定义 WebSocket 请求头，JSON 字符串形式 |

WebSocket 频道的默认值与手动覆盖项现在收敛到 `config/binance-streams.json`，无需再通过环境变量传入。

### 3. 初始化 Supabase 表

在 Supabase SQL 编辑器中执行以下脚本，创建登录记录与订阅状态表：

```sql
create table if not exists public.user_logins (
  user_id text primary key,
  wallet_address text not null,
  email text,
  username text,
  metadata jsonb,
  last_login_at timestamptz default now()
);

create table if not exists public.user_subscriptions (
  user_id text references public.user_logins(user_id) on delete cascade,
  wallet_address text not null,
  status text default 'inactive',
  tier text default 'member',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_subscriptions_pkey primary key (user_id)
);

create trigger if not exists set_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute procedure trigger_set_updated_at();
```

> 若项目中尚未提供 `trigger_set_updated_at`，可以在数据库中使用 `CREATE EXTENSION IF NOT EXISTS moddatetime;` 并创建 `moddatetime(updated_at)` trigger 以自动维护更新时间。

如果开启了 RLS，请至少为 `service_role` 保留插入与更新权限，或创建适合的策略。Stripe Webhook 可在订阅激活或取消时更新 `user_subscriptions` 的 `status` 与 `tier` 字段。

### 4. Stripe 价格与回调

1. 在 Stripe Dashboard 中创建订阅产品（得到 `prod_` ID），并为其添加 interval = `month`、interval_count = `1` 的 recurring price（建议设为 Default price）。
2. 在 Dashboard → 开发者 → Webhooks 中添加回调地址（例如 `/api/stripe/webhook`，可按需扩展本项目）。Webhook 处理程序应在支付成功后 upsert `user_subscriptions`，使 `/api/subscription-status` 能返回 `tier = 'premium'`。
3. 将成功/取消跳转地址配置为你的站点 URL，并可带上 `session_id` 以便在成功页调用 Stripe API 确认订阅。我们在 `app/api/checkout/route.ts` 中使用 `2024-06-20` 的 API 版本，如需更旧版本请在 Stripe 后台调整默认 API 版本或在代码中修改常量。

### 5. 配置 WebSocket 快照

1. 打开 Binance Alpha 详情页，按 `F12` → Network → WS，可以看到实际订阅的频道名称（形如 `alpha_185usdt@aggTrade`）。
2. 在 `config/binance-streams.json` 中设置 `defaultStream`，并可根据需要在 `overrides` 节点为特定代币写入固定频道；请求 `/api/tokens` 后你也可以基于列表动态匹配。
3. 如果遇到握手被拒绝，可在 `BINANCE_WS_HEADERS` 中提供 `Origin`、`User-Agent` 等字段以模拟官方站点。

> `/api/alpha-stream` 默认在 8 秒内等待 50 条 tick，少于窗口会返回部分数据并给出警告。部署到 Cloudflare Pages 时请选择“Node.js 兼容”模式，或在 Workers 中复用此逻辑。

### 6. 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:3000` 查看仪表盘。首次登录需要使用 Dynamic 环境中允许的钱包或身份方式。

## 代码结构

```
app/
  page.tsx             # 页面入口
  premium/page.tsx     # 订阅用户可访问的高级洞察
  api/
    alpha-stream/route.ts # Binance WebSocket 快照 API
    tokens/route.ts    # Binance 数据处理 API
    users/route.ts     # 登录用户写入 Supabase
    checkout/route.ts  # Stripe Checkout 会话
    subscription-status/route.ts # 查询订阅权限
components/
  AlphaStreamPanel.tsx # WebSocket 波动率可视化
  DynamicLogin.tsx     # Dynamic Widget 封装
  BillingPortal.tsx    # Stripe 订阅按钮
  PremiumInsights.tsx  # 订阅用户的额外分析面板
  DynamicAuthProvider.tsx # 全局注入 Dynamic Provider
  TokenTable.tsx       # 前端数据展示
hooks/
  useAccessControl.ts  # 登录与订阅状态判定
lib/
  binance-wss.ts       # WebSocket 快照采集逻辑
  binance.ts           # Binance 抓取与过滤逻辑
  supabase.ts          # service role 客户端初始化
config/
  binance-streams.json # 默认订阅频道与手动覆盖
  sample-alpha-tokens.json # Binance API 不可达时返回的示例数据
public/
  favicon.svg
```

## 部署建议

### Vercel

1. 在 Vercel 新建项目并导入本仓库。
2. 在 Project Settings → Environment Variables 中写入 `.env` 中的配置。
3. 直接部署即可，Next.js API Route 会在 Edge Functions/Serverless 中运行。

### Cloudflare Pages + Functions

1. 将仓库连接到 Cloudflare Pages，框架选择 **Next.js**。
2. 在 Pages → Settings → Environment variables 中添加环境变量。
3. 如果需要定制缓存或更高性能，可将 `app/api` 内的逻辑迁移到 Cloudflare Workers，结构完全兼容。

## 常见问题

- **Dynamic 登录后看不到成功提示？** 确认浏览器控制台无跨域错误，并检查 `NEXT_PUBLIC_DYNAMIC_ENV_ID` 是否填写正确。
- **Supabase 未写入数据？** 检查 `user_logins` 表是否存在、`service_role` 是否拥有 upsert 权限，以及环境变量是否正确传递到服务端。
- **Stripe 跳转报错？** 确认 `STRIPE_PRICE_ID` 指向启用的订阅产品（`prod_` 前缀），且该产品至少包含一个按月收费（interval = month、interval_count = 1）的 recurring price 并保持启用或设为默认。若仍报错，请在 Stripe Dashboard 中确认成功/取消地址可用，必要时借助 Stripe CLI 进行本地调试。
- **Binance API 访问失败？** 我们会自动切换到本地示例数据并在界面显示黄色提示。为恢复实时数据，请检查服务器的网络出口或在 Cloudflare Worker/代理中转请求。
- **是否需要前后端分离？** 本仓库利用 Next.js 的 App Router，同一套代码即可提供页面与 API。实时 WebSocket、Supabase 与 Stripe 都在 `app/api` 中实现，只有当你需要常驻进程或多语言脚本时才需要单独部署服务。
- **WebSocket 如何集成？** `/api/alpha-stream` 在请求到达时即时连接 Binance aggTrade 频道，返回 50 tick 的统计结果。若需持续监听并写入数据库，可将 `lib/binance-wss.ts` 的逻辑抽取到 Cloudflare Workers、Durable Object 或独立 Node 进程中运行。

## 依赖升级排查建议

- 我们通过 `overrides` 强制提升 WalletConnect、glob、rimraf 等传递依赖版本，可以显著减少 `npm WARN deprecated`。若你仍看到旧版本，可删除 `package-lock.json` 后重新 `npm install`。
- `lodash.isequal` 等少量警告来源于第三方 SDK，目前官方尚未发布替代版本，属信息性提醒，不影响运行。可关注 Dynamic 官方的后续版本并执行 `npm update`。
- 执行 `npm audit` 时，如仍存在高危依赖，可尝试 `npm audit fix --force`，或使用 `npm install <package>@latest --depth 10` 手动升级冲突包。
- 升级 ESLint 9 后若遇到配置错误，请使用 `npx next lint --reset` 生成新的 `eslint.config.mjs` 或 `eslintrc` 参考样例。

## 后续扩展

- 将 `fetchAlphaTokens` 的结果缓存在数据库或 KV 中，减少 Binance API 请求频次。
- 集成 webhook，将 Stripe 订阅状态写回 Supabase，形成完整的用户画像。
- 借助 Dynamic 的事件回调推送 Discord/Telegram，构建自动化通知链路。

## 版本信息

- 2024-10：项目已升级至 Next.js 15，使用最新的 `create-next-app@latest` 初始化配置（TypeScript `moduleResolution: "bundler"`、新的 ESLint preset 等）。

欢迎根据业务需求继续扩展，祝构建顺利！
