'use client';

import { useEffect, useMemo, useState } from 'react';

type TokenRow = {
  symbol: string;
  name: string;
  listingDate: string;
  daysSinceListing: number;
  volatility: number;
  price: number;
  volume24h: number;
  count24h: number;
  priceHigh24h: number;
  priceLow24h: number;
  percentChange24h: number;
};

type ApiResponse = {
  tokens?: TokenRow[];
  generatedAt?: string;
  error?: string;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2
});

export default function TokenTable() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
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

        const payload: ApiResponse = await response.json();
        if (payload.error) {
          throw new Error(payload.error);
        }

        setRows(payload.tokens ?? []);
        setGeneratedAt(payload.generatedAt);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          setError((err as Error).message ?? '数据加载失败');
        }
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, []);

  const metrics = useMemo(() => {
    if (!rows.length) {
      return {
        count: 0,
        avgVolatility: 0,
        totalVolume: 0,
        rising: 0
      };
    }

    const totalVolatility = rows.reduce((sum, row) => sum + row.volatility, 0);
    const totalVolume = rows.reduce((sum, row) => sum + row.volume24h, 0);
    const rising = rows.filter((row) => row.percentChange24h >= 0).length;

    return {
      count: rows.length,
      avgVolatility: totalVolatility / rows.length,
      totalVolume,
      rising
    };
  }, [rows]);

  return (
    <div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>上市 30 天内代币</span>
          <strong>{metrics.count}</strong>
        </div>
        <div className="metric-card">
          <span>平均 24h 波动率</span>
          <strong>{percentFormatter.format(metrics.avgVolatility / 100)}</strong>
        </div>
        <div className="metric-card">
          <span>24h 总成交额</span>
          <strong>{currencyFormatter.format(metrics.totalVolume)}</strong>
        </div>
        <div className="metric-card">
          <span>24h 上涨的代币</span>
          <strong>{metrics.rising}</strong>
        </div>
      </div>

      {generatedAt ? (
        <p>数据更新时间：{new Date(generatedAt).toLocaleString()}</p>
      ) : null}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>上市日期</th>
              <th>上市天数</th>
              <th>24h 波动率</th>
              <th>现价</th>
              <th>24h 成交额</th>
              <th>24h 交易次数</th>
              <th>24h 最高价</th>
              <th>24h 最低价</th>
              <th>24h 涨跌幅</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11}>数据加载中…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11}>{error}</td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{row.name}</td>
                  <td>{row.listingDate}</td>
                  <td>{row.daysSinceListing}</td>
                  <td>{percentFormatter.format(row.volatility / 100)}</td>
                  <td>{currencyFormatter.format(row.price)}</td>
                  <td>{currencyFormatter.format(row.volume24h)}</td>
                  <td>{numberFormatter.format(row.count24h)}</td>
                  <td>{currencyFormatter.format(row.priceHigh24h)}</td>
                  <td>{currencyFormatter.format(row.priceLow24h)}</td>
                  <td>
                    <span className={`badge ${row.percentChange24h >= 0 ? 'success' : 'warning'}`}>
                      {percentFormatter.format(row.percentChange24h / 100)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11}>当前没有满足条件的代币。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
