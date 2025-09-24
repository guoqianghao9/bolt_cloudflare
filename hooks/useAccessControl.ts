'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

export type AccessLevel = 'guest' | 'member' | 'premium';

type SubscriptionResponse = {
  tier?: AccessLevel;
  status?: 'active' | 'inactive' | 'canceled';
  error?: string;
};

type DynamicUser = {
  id?: string;
  userId?: string;
  email?: string;
  username?: string;
  metadata?: Record<string, unknown> | null;
  wallets?: Array<{
    address?: string;
    chain?: string;
    label?: string;
  }>;
  verifiedCredentials?: Array<{
    address?: string;
    type?: string;
    chain?: string;
  }>;
};

type DynamicContextValue = {
  isAuthenticated?: boolean;
  user?: DynamicUser | null;
  primaryWallet?: {
    address?: string;
    chain?: string;
  } | null;
};

function resolveWalletAddress(context: DynamicContextValue): string | undefined {
  if (context.primaryWallet?.address) {
    return context.primaryWallet.address;
  }

  const walletAddress = context.user?.wallets?.find((wallet) => wallet.address)?.address;
  if (walletAddress) {
    return walletAddress;
  }

  const credentialAddress = context.user?.verifiedCredentials?.find((cred) => cred.address)?.address;
  return credentialAddress ?? undefined;
}

export function useAccessControl() {
  let dynamicContext: (DynamicContextValue & { hasProvider: true }) | null = null;

  try {
    dynamicContext = useDynamicContext() as DynamicContextValue & { hasProvider: true };
  } catch (error) {
    dynamicContext = null;
  }

  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  const hasDynamicProvider = Boolean(environmentId && dynamicContext);

  const user = dynamicContext?.user ?? null;
  const resolvedWallet = dynamicContext ? resolveWalletAddress(dynamicContext) : undefined;
  const hasUserProfile = Boolean(user);
  const hasWalletConnection = Boolean(resolvedWallet);

  const isAuthenticated = Boolean(
    hasDynamicProvider && (dynamicContext?.isAuthenticated ?? (hasUserProfile || hasWalletConnection))
  );
  const walletAddress = isAuthenticated ? resolvedWallet : undefined;

  const [subscriptionTier, setSubscriptionTier] = useState<AccessLevel>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (!hasDynamicProvider || !isAuthenticated || !walletAddress) {
      setSubscriptionTier('member');
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/subscription-status?wallet=${encodeURIComponent(walletAddress)}`, {
          method: 'GET',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`订阅状态获取失败: ${response.status}`);
        }

        const payload = (await response.json()) as SubscriptionResponse;
        if (payload.error) {
          throw new Error(payload.error);
        }

        setSubscriptionTier(payload.tier === 'premium' ? 'premium' : 'member');
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.error('获取订阅状态失败', err);
        setSubscriptionTier('member');
        setError((err as Error).message ?? '订阅状态查询失败');
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, [hasDynamicProvider, isAuthenticated, walletAddress, requestKey]);

  const accessLevel: AccessLevel = useMemo(() => {
    if (!hasDynamicProvider || !isAuthenticated) {
      return 'guest';
    }

    return subscriptionTier;
  }, [hasDynamicProvider, isAuthenticated, subscriptionTier]);

  return {
    accessLevel,
    isAuthenticated,
    walletAddress,
    loadingSubscription: loading,
    subscriptionError: error,
    hasDynamicProvider,
    user,
    refreshSubscription: () => setRequestKey((value) => value + 1)
  };
}
