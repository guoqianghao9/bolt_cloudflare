'use client';

import type { ReactNode } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

import styles from './dynamic-auth-provider.module.css';

export default function DynamicAuthProvider({ children }: { children: ReactNode }) {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

  if (!environmentId) {
    return (
      <div className={styles.providerlessWrapper}>
        <div className={styles.warning}>
          未配置 <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code>，钱包登录与访问控制将处于禁用状态。
        </div>
        {children}
      </div>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors]
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
