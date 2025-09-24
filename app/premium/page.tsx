'use client';

import Link from 'next/link';

import PremiumInsights from '@/components/PremiumInsights';
import AlphaStreamPanel from '@/components/AlphaStreamPanel';
import { useAccessControl } from '@/hooks/useAccessControl';

export default function PremiumPage() {
  const { accessLevel } = useAccessControl();

  return (
    <main>
      <section>
        <h1>高级洞察中心</h1>
        <p>
          这里汇总了 Binance Alpha 的深度分析，包含波动率雷达、稳健资产榜以及最新上架追踪。订阅用户可以把数据同步到自动化脚本、
          Discord 或 Telegram 通知，也可以拓展成量化策略面板。
        </p>
      </section>

      {accessLevel !== 'premium' ? (
        <section>
          <h2>访问受限</h2>
          {accessLevel === 'guest' ? (
            <>
              <p>请先返回首页使用 Dynamic.xyz 登录，确认钱包信息写入 Supabase 后再进行订阅。</p>
              <p>
                <Link href="/" className="button ghost">
                  返回首页登录
                </Link>
              </p>
            </>
          ) : (
            <>
              <p>你已登录，但尚未激活 Stripe 订阅。完成支付后刷新页面即可立即访问高级洞察。</p>
              <p>
                <Link href="/" className="button ghost">
                  前往订阅
                </Link>
              </p>
            </>
          )}
        </section>
      ) : (
        <>
        <section>
          <h2>实时策略面板</h2>
          <PremiumInsights />
        </section>

        <section>
          <h2>WebSocket 波动率快照</h2>
          <p>
            这是与首页相同的实时面板，供你在高级页面中快速刷新 Binance Alpha aggTrade 波动率，并对接自动化脚本或交易工具。
          </p>
          <AlphaStreamPanel />
        </section>

        <section>
          <h2>下一步集成建议</h2>
          <ul className="integration-list">
            <li>在 Cloudflare Workers 或 Vercel Cron 中定时调用 `/api/tokens`，将结果写入 Supabase 或 KV 用于历史分析。</li>
              <li>结合 Stripe Webhook 将订阅状态写回 `user_subscriptions` 表，实现权限自动化，避免手动维护。</li>
              <li>通过 Dynamic 的事件回调触发 Discord、Slack 或 Telegram 通知，无需额外的 WebSocket，即可把握实时机会。</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
