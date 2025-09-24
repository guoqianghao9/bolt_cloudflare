# Alpha Volatility Radar

一个可以部署到 Vercel 或 Cloudflare Pages/Workers 的 SaaS 仪表盘，围绕 Binance Alpha 的最新上线代币数据构建。它结合了 Dynamic.xyz 的 Web3 登录、Supabase 数据库存储以及 Stripe 订阅计费，让你可以快速验证产品思路并上线收费服务。

## 功能亮点

- **Binance Alpha 数据处理**：通过服务器端 API 请求官方接口，筛选出 30 天内上市的代币，并计算 24 小时波动率后按稳定性排序。
- **实时前端展示**：使用 Next.js App Router 构建的响应式页面，可在桌面或移动端查看代币列表与关键指标。
- **Dynamic.xyz 登录**：集成 Dynamic Widget，支持钱包一键登录；登录后的核心信息会自动写入 Supabase。
- **Supabase 存储**：使用 service role key 在服务端执行 upsert 操作，方便统计用户来源与活跃度。
- **Stripe 订阅**：内置 Checkout API，配置价格 ID 后即可引导用户完成订阅付款。

## 快速开始

### 1. 克隆并安装依赖

```bash
npm install
```

> 由于本仓库在构建时无法访问 npm 官方源，如果你也遇到 403，可切换公司代理或使用私有镜像。

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
| `STRIPE_PRICE_ID` | Stripe 中的价格 ID（订阅模式） |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | Stripe Checkout 完成或取消时跳转的页面 |

### 3. 初始化 Supabase 表

在 Supabase SQL 编辑器中执行以下脚本创建存储登录信息的数据表：

```sql
create table if not exists public.user_logins (
  user_id text primary key,
  wallet_address text not null,
  email text,
  username text,
  metadata jsonb,
  last_login_at timestamptz default now()
);
```

如果开启了 RLS，请至少为 `service_role` 保留插入与更新权限，或创建适合的策略。

### 4. Stripe 价格与回调

1. 在 Stripe Dashboard 中创建订阅产品与价格，记下 `price_xxx`。
2. 在 Dashboard → 开发者 → Webhooks 中添加回调地址（例如 `/api/stripe/webhook`，可按需扩展本项目）。
3. 将成功/取消跳转地址配置为你的站点 URL。

### 5. 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:3000` 查看仪表盘。首次登录需要使用 Dynamic 环境中允许的钱包或身份方式。

## 代码结构

```
app/
  page.tsx             # 页面入口
  api/
    tokens/route.ts    # Binance 数据处理 API
    users/route.ts     # 登录用户写入 Supabase
    checkout/route.ts  # Stripe Checkout 会话
components/
  DynamicLogin.tsx     # Dynamic Widget 封装
  BillingPortal.tsx    # Stripe 订阅按钮
  TokenTable.tsx       # 前端数据展示
lib/
  binance.ts           # Binance 抓取与过滤逻辑
  supabase.ts          # service role 客户端初始化
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
- **Stripe 跳转报错？** 确认 `STRIPE_PRICE_ID` 与成功/取消地址可用，若在本地开发需要使用 Stripe CLI 转发回调。

## 后续扩展

- 将 `fetchAlphaTokens` 的结果缓存在数据库或 KV 中，减少 Binance API 请求频次。
- 集成 webhook，将 Stripe 订阅状态写回 Supabase，形成完整的用户画像。
- 借助 Dynamic 的事件回调推送 Discord/Telegram，构建自动化通知链路。

欢迎根据业务需求继续扩展，祝构建顺利！
