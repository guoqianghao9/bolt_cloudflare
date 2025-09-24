import { NextResponse } from 'next/server';
import { fetchAlphaTokens } from '@/lib/binance';

export const revalidate = 300;

export async function GET() {
  try {
    const { tokens, source, error } = await fetchAlphaTokens();

    const payload: {
      tokens: typeof tokens;
      generatedAt: string;
      source: typeof source;
      warning?: string;
    } = {
      tokens,
      generatedAt: new Date().toISOString(),
      source
    };

    if (source === 'fallback') {
      payload.warning = `当前返回的是示例数据，原因：${error ?? '未知错误'}`;
    }

    if (source === 'fallback' && error) {
      console.warn('Binance API 请求失败，已切换为本地示例数据。', error);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('加载 Binance Alpha 数据失败', error);
    return NextResponse.json(
      {
        error: '无法获取 Binance Alpha 数据，请稍后重试'
      },
      { status: 502 }
    );
  }
}
