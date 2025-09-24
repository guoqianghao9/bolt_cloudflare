'use client';

import { useState } from 'react';

import { useAccessControl } from '@/hooks/useAccessControl';

export default function BillingPortal() {
  const { accessLevel, isAuthenticated, walletAddress, user } = useAccessControl();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setError('请先完成 Dynamic 登录。');
      return;
    }

    if (!walletAddress) {
      setError('未能识别钱包地址，无法启动订阅流程。');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          userId: user?.userId ?? user?.id ?? walletAddress,
          customerEmail: user?.email ?? undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Stripe 会话创建失败: ${response.status}`);
      }

      const payload: { url?: string; error?: string } = await response.json();
      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message ?? '支付流程启动失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="card muted">
        <p>登录后可发起 Stripe 订阅，解锁高级功能。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Stripe 订阅计费</h3>
        <p>绑定钱包：{walletAddress}</p>
      </div>
      <div className="card-body">
        <button
          type="button"
          className="button"
          onClick={handleCheckout}
          disabled={loading || accessLevel === 'premium'}
        >
          {accessLevel === 'premium' ? '订阅已激活' : loading ? '重定向到 Stripe…' : '订阅高级功能'}
        </button>
        {error ? <span className="badge warning">{error}</span> : null}
      </div>
      {accessLevel === 'premium' ? (
        <p className="card-footer">订阅有效，如需取消或更改，请前往 Stripe Portal。</p>
      ) : (
        <p className="card-footer">订阅后即可访问高级洞察页面，并解锁实时提醒。</p>
      )}
    </div>
  );
}
