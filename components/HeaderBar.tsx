'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';

import { useAccessControl } from '@/hooks/useAccessControl';

const ACCESS_LABELS: Record<string, string> = {
  guest: '访客预览模式',
  member: '已登录：等待订阅确认',
  premium: '高级订阅已激活'
};

export default function HeaderBar() {
  const { accessLevel, hasDynamicProvider } = useAccessControl();

  const statusLabel = useMemo(() => {
    if (!hasDynamicProvider) {
      return '缺少 Dynamic 配置';
    }

    return ACCESS_LABELS[accessLevel] ?? ACCESS_LABELS.guest;
  }, [accessLevel, hasDynamicProvider]);

  return (
    <header className="top-bar">
      <div className="top-bar__inner">
        <Link href="/" className="top-bar__brand" aria-label="Alpha Volatility Radar 首页">
          Alpha Volatility Radar
        </Link>

        <nav className="top-bar__nav" aria-label="主导航">
          <Link href="/" className="top-bar__link">
            首页
          </Link>
          <Link href="/premium" className="top-bar__link">
            高级洞察
          </Link>
        </nav>

        <div className="top-bar__auth" aria-live="polite">
          {hasDynamicProvider ? (
            <>
              <DynamicWidget buttonClassName="button small" />
              <span className="top-bar__status">{statusLabel}</span>
            </>
          ) : (
            <span className="top-bar__status warning">{statusLabel}</span>
          )}
        </div>
      </div>
    </header>
  );
}
