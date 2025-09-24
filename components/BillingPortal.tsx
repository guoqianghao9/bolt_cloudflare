'use client';

import { useState } from 'react';

export default function BillingPortal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <button type="button" className="button" onClick={handleCheckout} disabled={loading}>
        {loading ? '重定向到 Stripe…' : '订阅高级功能'}
      </button>
      {error ? <span className="badge warning">{error}</span> : null}
    </div>
  );
}
