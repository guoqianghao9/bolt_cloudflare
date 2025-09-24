import dynamic from 'next/dynamic';
import TokenTable from '@/components/TokenTable';

const DynamicLogin = dynamic(() => import('@/components/DynamicLogin'), { ssr: false });
const BillingPortal = dynamic(() => import('@/components/BillingPortal'), { ssr: false });

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>Alpha Volatility Radar</h1>
        <p>
          A focused SaaS dashboard for catching Binance Alpha listings the moment they go live. Track
          volatility, onboarding metrics, and subscription conversion in one place.
        </p>
        <p>
          Connect with your preferred wallet via Dynamic, sync the profile to Supabase, and unlock
          deeper analytics by subscribing through Stripe.
        </p>
        <DynamicLogin />
      </section>

      <section>
        <h2>Upgrade to premium insights</h2>
        <p>
          Access smart alerts, Discord and Telegram integrations, and early liquidity signals by
          activating a subscription. Billing is powered by Stripe for a seamless checkout flow.
        </p>
        <BillingPortal />
      </section>

      <section>
        <h2>New listings volatility board</h2>
        <p>
          We process Binance Alpha API data every request, highlight tokens listed in the last 30 days,
          and sort by intraday volatility to surface steady performers as well as new spikes.
        </p>
        <TokenTable />
      </section>
    </main>
  );
}
