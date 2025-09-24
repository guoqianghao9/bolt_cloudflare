'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import streamConfig from '@/config/binance-streams.json';
import { useAccessControl } from '@/hooks/useAccessControl';
import type { AlphaStreamSnapshot } from '@/lib/binance-wss';

const percentNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
});

const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 8
});

const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6
});

const defaultStream =
  typeof streamConfig.defaultStream === 'string' ? streamConfig.defaultStream : '';

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return `${percentNumberFormatter.format(value)}%`;
}

function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return priceFormatter.format(value);
}

function formatQuantity(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return quantityFormatter.format(value);
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AlphaStreamPanel() {
  const { accessLevel, isAuthenticated } = useAccessControl();
  const isPremium = accessLevel === 'premium';
  const allowData = isPremium || accessLevel === 'member';

  const [streamInput, setStreamInput] = useState<string>(defaultStream);
  const [activeStream, setActiveStream] = useState<string>(defaultStream);
  const [windowSize, setWindowSize] = useState<number>(() => (isPremium ? 50 : 20));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AlphaStreamSnapshot | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setWindowSize(isPremium ? 50 : 20);
  }, [isPremium]);

  useEffect(() => {
    if (!allowData || !activeStream) {
      setSnapshot(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          stream: activeStream,
          windowSize: String(windowSize)
        });

        const response = await fetch(`/api/alpha-stream?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`WebSocket 数据查询失败: ${response.status}`);
        }

        const payload = (await response.json()) as AlphaStreamSnapshot & { error?: string };
        if (payload.error) {
          throw new Error(payload.error);
        }

        if (!cancelled) {
          setSnapshot(payload);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError((err as Error).message ?? '实时数据获取失败');
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [allowData, activeStream, windowSize, refreshToken]);

  const metrics = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        label: '捕获窗口',
        value: `${snapshot.ticksCollected}/${snapshot.windowSize}${snapshot.partial ? ' · 未满' : ''}`
      },
      {
        label: '窗口波动率',
        value: formatPercent(snapshot.stdDevPct)
      },
      {
        label: '平均收益',
        value: formatPercent(snapshot.meanReturnPct)
      },
      {
        label: '最新成交价',
        value: formatPrice(snapshot.lastPrice)
      }
    ];
  }, [snapshot]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitized = streamInput.trim();
    if (!sanitized) {
      setError('请输入有效的频道，例如 alpha_185usdt@aggTrade');
      return;
    }

    setActiveStream(sanitized);
    setRefreshToken((value) => value + 1);
  };

  const handleRefresh = () => {
    setRefreshToken((value) => value + 1);
  };

  const handleWindowSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(value)) {
      return;
    }

    const bounded = Math.min(500, Math.max(5, value));
    setWindowSize(bounded);
  };

  if (!isAuthenticated) {
    return (
      <div className="card muted">
        <p>登录后即可预览 Binance Alpha 的实时 WebSocket 波动率指标。</p>
      </div>
    );
  }

  if (!allowData) {
    return (
      <div className="card muted">
        <p>当前账户权限不足。升级订阅后可访问实时波动率面板与详细 tick 数据。</p>
      </div>
    );
  }

  return (
    <div className="card stream-panel">
      <div className="card-header">
        <h3>Binance Alpha WebSocket 波动率</h3>
        <p>
          {isPremium
            ? '实时捕获 aggTrade 频道的 tick 数据，并计算窗口标准差用于交易决策。'
            : '预览模式下捕获 20 条 tick 数据。升级订阅可调整窗口并获得更完整的实时分析。'}
        </p>
      </div>

      <div className="card-body">
        <form className="stream-form" onSubmit={handleSubmit}>
          <label>
            订阅频道
            <input
              type="text"
              placeholder={defaultStream || 'alpha_185usdt@aggTrade'}
              value={streamInput}
              onChange={(event) => setStreamInput(event.target.value)}
              autoComplete="off"
            />
          </label>

          <label>
            Tick 窗口
            <input
              type="number"
              min={5}
              max={500}
              value={windowSize}
              onChange={handleWindowSizeChange}
              disabled={!isPremium}
              title={isPremium ? undefined : '订阅后可自定义窗口大小'}
            />
          </label>

          <div className="stream-actions">
            <button type="submit" className="button secondary">
              应用频道
            </button>
            <button type="button" className="button" onClick={handleRefresh} disabled={loading}>
              {loading ? '抓取中…' : '刷新快照'}
            </button>
          </div>
        </form>

        {error ? <p className="error-text">{error}</p> : null}

        {snapshot ? (
          <div className="stream-result">
            <div className="metric-grid">
              {metrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>

            <dl className="stream-meta">
              <div>
                <dt>最新成交时间</dt>
                <dd>{formatTimestamp(snapshot.lastTradeTime)}</dd>
              </div>
              <div>
                <dt>最新数量</dt>
                <dd>{formatQuantity(snapshot.lastQuantity)}</dd>
              </div>
              <div>
                <dt>订阅频道</dt>
                <dd>{snapshot.stream}</dd>
              </div>
              <div>
                <dt>基础频道</dt>
                <dd>{snapshot.baseStreams.join(', ')}</dd>
              </div>
              <div>
                <dt>交易对</dt>
                <dd>{snapshot.symbol ?? '—'}</dd>
              </div>
              <div>
                <dt>窗口均值</dt>
                <dd>{formatPercent(snapshot.meanReturnPct)}</dd>
              </div>
            </dl>

            {snapshot.warnings.length ? (
              <div className="locked-callout warning">
                {snapshot.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>{warning}</p>
                ))}
              </div>
            ) : null}

            {snapshot.ticks.length ? (
              <div className="stream-ticks">
                <h4>最近 {snapshot.ticks.length} 条 Tick</h4>
                <table>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>价格</th>
                      <th>数量</th>
                      <th>方向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.ticks.map((tick, index) => (
                      <tr key={`${tick.eventTime}-${index}`}>
                        <td>{formatTimestamp(tick.eventTime)}</td>
                        <td>{formatPrice(tick.price)}</td>
                        <td>{formatQuantity(tick.quantity)}</td>
                        <td>{tick.isMaker === null || tick.isMaker === undefined ? '—' : tick.isMaker ? '卖出' : '买入'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {snapshot.sampleReturnsPct.length ? (
              <div className="stream-returns">
                <h4>窗口收益序列（%）</h4>
                <ul>
                  {snapshot.sampleReturnsPct.map((value, index) => (
                    <li key={`${value}-${index}`}>{percentNumberFormatter.format(value)}%</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card-footer">
        <p>
          如果你希望 24/7 持续监听 WebSocket，可将该 API 部署到 Cloudflare Workers 或独立服务中，并按需写入 Supabase/KV 再由页面读取。
        </p>
      </div>
    </div>
  );
}
