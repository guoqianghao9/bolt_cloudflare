import { NextResponse } from 'next/server';
import { fetchAlphaTokens } from '@/lib/binance';

export const revalidate = 300;

export async function GET() {
  try {
    const tokens = await fetchAlphaTokens();
    return NextResponse.json({
      tokens,
      generatedAt: new Date().toISOString()
    });
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
