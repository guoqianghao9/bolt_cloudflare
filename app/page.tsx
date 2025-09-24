'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import TokenTable from '@/components/TokenTable';
import { useAccessControl } from '@/hooks/useAccessControl';

const DynamicLogin = dynamic(() => import('@/components/DynamicLogin'), { ssr: false });
const BillingPortal = dynamic(() => import('@/components/BillingPortal'), { ssr: false });
const PremiumInsights = dynamic(() => import('@/components/PremiumInsights'), { ssr: false });
const AlphaStreamPanel = dynamic(() => import('@/components/AlphaStreamPanel'), { ssr: false });

export default function HomePage() {
  const { accessLevel } = useAccessControl();

  return (
    <main>
      <section>
        <h1>Alpha Volatility Radar</h1>
        <p>
          基于 Binance Alpha 数据的 Web3 SaaS 服务：实时筛选上市 30 天内的代币、计算波动率并给出交易信号。
          结合 Dynamic.xyz、Supabase 与 Stripe，让你可以无缝完成登录、数据同步与订阅计费。
        </p>
        <p>
          开放访客模式让潜在用户预览核心数据；登录后解锁完整表格，订阅后再访问高级洞察与自动化策略页面，遵循标准的 SaaS
          转化漏斗。
        </p>
        <DynamicLogin />
      </section>

      <section>
        <h2>Stripe 订阅与权限升级</h2>
        <p>
          通过 Stripe Checkout 完成订阅后，将在 Supabase 中记录订阅状态，配合 Dynamic 的身份信息自动识别用户权限。
          你可以在 Stripe Webhook 中写回数据库，使权限实时生效。
        </p>
        <BillingPortal />
      </section>

      <section>
        <h2>新上市代币波动率面板</h2>
        <p>
          我们实时调用 Binance Alpha API，筛选上市 30 天内的代币并按波动率排序。访客可预览部分数据，登录后立即解锁全部字段。
        </p>
        <TokenTable accessLevel={accessLevel} />
      </section>

      <section>
        <h2>高级洞察（Premium）</h2>
        <p>
          订阅用户可以在此快速查看波动率 Top、稳健资产以及最新上架的重点代币，并在独立页面配置自动化通知与团队协作。
        </p>
        {accessLevel === 'premium' ? (
          <>
            <PremiumInsights />
            <p className="card-footer inline">
              <Link href="/premium" className="button ghost">
                前往高级洞察页面
              </Link>
            </p>
          </>
        ) : accessLevel === 'member' ? (
          <div className="locked-callout premium">
            已登录但尚未订阅。完成 Stripe 支付后即可在此查看实时分析，并访问专属的“高级洞察”页面。
          </div>
        ) : (
          <div className="locked-callout">
            登录即可了解高级功能包含哪些指标，再订阅升级以访问完整的策略与自动化工具。
          </div>
        )}
      </section>

      <section>
        <h2>WebSocket 实时波动率</h2>
        <p>
          结合 Binance Alpha 的 aggTrade 频道，实时抓取 tick 数据并计算 50 tick 标准差，可作为自动化策略的触发条件。
          在 Cloudflare 或 Vercel 上部署时，该 API 会在服务端连接 Binance 的 WebSocket，再把快照返回给前端组件。
        </p>
        <AlphaStreamPanel />
      </section>
    </main>
  );
}
