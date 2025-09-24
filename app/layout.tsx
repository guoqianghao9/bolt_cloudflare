import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
