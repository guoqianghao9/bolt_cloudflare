'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAccessControl } from '@/hooks/useAccessControl';

type DynamicUser = {
  id?: string;
  userId?: string;
  email?: string;
  username?: string;
  metadata?: Record<string, unknown> | null;
  wallets?: Array<{
    address?: string;
  }>;
  verifiedCredentials?: Array<{
    address?: string;
  }>;
};

function resolveWallet(user: DynamicUser | null, walletAddress?: string): string | undefined {
  if (walletAddress) return walletAddress;
  return user?.wallets?.[0]?.address ?? user?.verifiedCredentials?.[0]?.address ?? undefined;
}

async function persistUser(user: DynamicUser | null, walletAddress?: string): Promise<void> {
  if (!user) return;

  const resolvedWallet = resolveWallet(user, walletAddress);
  if (!resolvedWallet) {
    console.warn('Dynamic 登录成功，但未找到钱包地址');
    return;
  }

  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-store',
    body: JSON.stringify({
      userId: user.userId ?? user.id ?? resolvedWallet,
      walletAddress: resolvedWallet,
      email: user.email ?? null,
      username: user.username ?? null,
      metadata: user.metadata ?? null
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Supabase API 返回状态 ${response.status}`);
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  if (!payload?.success) {
    console.warn('Supabase 用户同步响应未返回 success 标记。');
  }
}

const ACCESS_LABELS: Record<string, string> = {
  guest: '访客模式：仅可查看部分指标',
  member: '会员预览：已登录，尚未订阅',
  premium: '高级订阅：完整访问权限'
};

export default function DynamicLogin() {
  const {
    accessLevel,
    isAuthenticated,
    user,
    walletAddress,
    hasDynamicProvider,
    loadingSubscription,
    subscriptionError
  } = useAccessControl();

  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'complete' | 'error'>('idle');
  const [lastSyncedUserId, setLastSyncedUserId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const resolvedLabel = useMemo(() => ACCESS_LABELS[accessLevel] ?? ACCESS_LABELS.guest, [accessLevel]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSyncState('idle');
      setLastSyncedUserId(null);
      setSyncError(null);
      return;
    }

    const identifier = user.userId ?? user.id ?? walletAddress;
    if (!identifier || identifier === lastSyncedUserId) {
      return;
    }

    const sync = async () => {
      try {
        setSyncState('syncing');
        setSyncError(null);
        await persistUser(user, walletAddress);
        setSyncState('complete');
        setLastSyncedUserId(identifier);
      } catch (error) {
        console.error('同步用户到 Supabase 失败', error);
        setSyncError((error as Error).message ?? '同步失败');
        setSyncState('error');
      }
    };

    void sync();
  }, [isAuthenticated, user, walletAddress, lastSyncedUserId]);

  if (!hasDynamicProvider) {
    return (
      <div className="card muted">
        <p>缺少 Dynamic 环境配置，无法使用钱包登录。请先在环境变量中设置 <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code>。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Dynamic Web3 登录</h3>
        <p>{resolvedLabel}</p>
      </div>
      <div className="card-body dynamic-login">
        <div className="login-instructions">
          <p>请使用页面右上角的 <strong>Log in or sign up</strong> 按钮完成钱包连接。</p>
          <p>登录后系统会自动把钱包信息写入 Supabase，并同步 Stripe 订阅状态。</p>
        </div>
        <div className="status-stack">
          {syncState === 'syncing' ? <span>正在同步到 Supabase…</span> : null}
          {syncState === 'complete' ? <span className="badge success">登录并同步成功</span> : null}
          {syncState === 'error' ? <span className="badge warning">{syncError ?? '同步失败，请重试'}</span> : null}
          {loadingSubscription ? <span>正在检查订阅状态…</span> : null}
          {subscriptionError ? <span className="badge warning">{subscriptionError}</span> : null}
        </div>
      </div>
      {!isAuthenticated ? (
        <p className="card-footer">使用右上角的登录按钮后即可解锁完整的波动率表格与指标。</p>
      ) : accessLevel !== 'premium' ? (
        <p className="card-footer">完成 Stripe 订阅后，可访问高级洞察页面与自动化提醒。</p>
      ) : (
        <p className="card-footer">订阅有效，欢迎访问“高级洞察”页面查看专属分析。</p>
      )}
    </div>
  );
}
