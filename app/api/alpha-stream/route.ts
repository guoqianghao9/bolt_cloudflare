import { NextRequest, NextResponse } from 'next/server';

import streamConfig from '@/config/binance-streams.json';
import { fetchAlphaStreamSnapshot } from '@/lib/binance-wss';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const stream =
    searchParams.get('stream') ??
    (typeof streamConfig.defaultStream === 'string' ? streamConfig.defaultStream : '');

  if (!stream) {
    return NextResponse.json({ error: '缺少 stream 参数，请在查询参数或环境变量中设置目标频道。' }, { status: 400 });
  }

  const windowSizeParam = searchParams.get('windowSize');
  const requestedWindow = windowSizeParam ? Number.parseInt(windowSizeParam, 10) : undefined;
  const windowSize =
    typeof requestedWindow === 'number' && Number.isFinite(requestedWindow)
      ? Math.min(500, Math.max(5, requestedWindow))
      : undefined;

  const maxWaitParam = searchParams.get('maxWaitMs');
  const requestedMaxWait = maxWaitParam ? Number.parseInt(maxWaitParam, 10) : undefined;
  const maxWaitMs =
    typeof requestedMaxWait === 'number' && Number.isFinite(requestedMaxWait)
      ? Math.min(60000, Math.max(2000, requestedMaxWait))
      : undefined;

  try {
    const snapshot = await fetchAlphaStreamSnapshot({
      stream,
      windowSize,
      maxWaitMs
    });

    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('获取 Binance WebSocket 快照失败', error);
    return NextResponse.json(
      {
        error: (error as Error).message ?? '获取 Binance WebSocket 快照失败。'
      },
      { status: 502 }
    );
  }
}
