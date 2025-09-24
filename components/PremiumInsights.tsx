'use client';

import { useEffect, useMemo, useState } from 'react';

import type { TokenRow } from './TokenTable';

type ApiResponse = {
  tokens?: TokenRow[];
  error?: string;
};

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4
});

export default function PremiumInsights() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tokens', {
          method: 'GET',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`请求失败: ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse;
        if (payload.error) {
          throw new Error(payload.error);
        }

        setRows(payload.tokens ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.error(err);
        setError((err as Error).message ?? '高级洞察数据加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, []);

  const highestVolatility = useMemo(() => {
    return [...rows].sort((a, b) => b.volatility - a.volatility).slice(0, 3);
  }, [rows]);

  const steadyPerformers = useMemo(() => {
    return rows.filter((row) => row.volatility < 15).slice(0, 3);
  }, [rows]);

  const newlyListed = useMemo(() => {
    return rows.filter((row) => row.daysSinceListing <= 3).slice(0, 5);
  }, [rows]);

  return (
    <div className="insight-grid">
      <div className="insight-card">
        <h3 className="insight-title">波动率 Top 3</h3>
        {loading ? <p>正在分析…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <ul>
          {highestVolatility.map((row) => (
            <li key={row.symbol}>
              <strong>{row.symbol}</strong> · {row.name}
              <span>{percentFormatter.format(row.volatility / 100)}</span>
            </li>
          ))}
        </ul>
        <p className="insight-meta">留意剧烈波动的代币，结合社群舆情判断是否值得追踪。</p>
      </div>

      <div className="insight-card">
        <h3 className="insight-title">稳健表现（波动率 &lt; 15%）</h3>
        <ul>
          {steadyPerformers.map((row) => (
            <li key={row.symbol}>
              <strong>{row.symbol}</strong>
              <span>{percentFormatter.format(row.volatility / 100)}</span>
            </li>
          ))}
        </ul>
        <p className="insight-meta">这些代币 24h 内波动较小，可关注其成交额与新增地址判断趋势。</p>
      </div>

      <div className="insight-card">
        <h3 className="insight-title">新上架观察</h3>
        <ul>
          {newlyListed.map((row) => (
            <li key={row.symbol}>
              <strong>{row.symbol}</strong>
              <span>
                {row.listingDate} · {currencyFormatter.format(row.price)}
              </span>
            </li>
          ))}
        </ul>
        <p className="insight-meta">将此列表接入你的自动化通知渠道，第一时间把握流量。</p>
      </div>
    </div>
  );
}
