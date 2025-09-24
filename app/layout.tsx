import type { Metadata } from 'next';
import './globals.css';

import DynamicAuthProvider from '@/components/DynamicAuthProvider';
import FloatingXButton from '@/components/FloatingXButton';
import HeaderBar from '@/components/HeaderBar';

export const metadata: Metadata = {
  title: 'Alpha Volatility Radar',
  description:
    'Monitor newly listed Binance Alpha tokens, onboard Web3 users with Dynamic, and manage subscriptions with Stripe.',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DynamicAuthProvider>
          <HeaderBar />
          <FloatingXButton />
          <div className="app-shell">{children}</div>
        </DynamicAuthProvider>
      </body>
    </html>
  );
}
