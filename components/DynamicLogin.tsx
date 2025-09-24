'use client';

import { useState } from 'react';
import { DynamicContextProvider, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

type AuthResult = {
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    username?: string;
    verifiedCredentials?: Array<{
      address?: string;
      type?: string;
      chain?: string;
    }>;
    wallets?: Array<{
      address?: string;
      chain?: string;
      label?: string;
    }>;
    metadata?: Record<string, unknown>;
  };
};

function resolvePrimaryWallet(result?: AuthResult['user']): string | undefined {
  if (!result) return undefined;

  if (result.wallets?.length) {
    return result.wallets[0]?.address ?? undefined;
  }

  if (result.verifiedCredentials?.length) {
    return result.verifiedCredentials[0]?.address ?? undefined;
  }

  return undefined;
}

async function persistUser(result?: AuthResult['user']): Promise<void> {
  if (!result) return;

  const walletAddress = resolvePrimaryWallet(result);
  if (!walletAddress) {
    console.warn('Dynamic 登录成功，但未找到钱包地址');
    return;
  }

  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: result.userId ?? result.id ?? walletAddress,
      walletAddress,
      email: result.email ?? null,
      username: result.username ?? null,
      metadata: result.metadata ?? null
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase 同步失败: ${response.status}`);
  }
}

export default function DynamicLogin() {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  const [status, setStatus] = useState<'idle' | 'syncing' | 'complete' | 'error'>('idle');

  if (!environmentId) {
    return (
      <p style={{ color: '#f87171' }}>
        请在环境变量中设置 <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code> 才能启用钱包登录。
      </p>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors],
        eventsCallbacks: {
          onAuthSuccess: async (result: AuthResult) => {
            try {
              setStatus('syncing');
              await persistUser(result.user);
              setStatus('complete');
            } catch (error) {
              console.error('同步用户到 Supabase 失败', error);
              setStatus('error');
            }
          }
        }
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <DynamicWidget buttonClassName="button" />
        {status === 'syncing' ? <span>正在同步到 Supabase…</span> : null}
        {status === 'complete' ? <span className="badge success">登录并同步成功</span> : null}
        {status === 'error' ? <span className="badge warning">同步失败，请重试</span> : null}
      </div>
    </DynamicContextProvider>
  );
}
