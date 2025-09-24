import WebSocket from 'ws';

export interface AlphaStreamTick {
  price: number;
  quantity: number;
  eventTime: string;
  symbol?: string;
  isMaker?: boolean;
}

export interface AlphaStreamSnapshot {
  stream: string;
  baseStreams: string[];
  windowSize: number;
  ticksCollected: number;
  partial: boolean;
  lastPrice: number | null;
  lastQuantity: number | null;
  lastTradeTime: string | null;
  firstTradeTime: string | null;
  stdDevPct: number | null;
  meanReturnPct: number | null;
  sampleReturnsPct: number[];
  updatedAt: string;
  symbol: string | null;
  warnings: string[];
  ticks: AlphaStreamTick[];
}

export interface AlphaStreamOptions {
  stream: string;
  windowSize?: number;
  maxWaitMs?: number;
}

type InternalTick = {
  price: number;
  quantity: number;
  eventTime: number;
  symbol: string | null;
  isMaker: boolean | null;
};

const DEFAULT_URL = process.env.BINANCE_WS_URL ?? 'wss://nbstream.binance.com/w3w/wsa/stream';

function parseHeaders(): Record<string, string> {
  const defaults: Record<string, string> = {
    Origin: 'https://www.binance.com',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'User-Agent': 'Alpha-Volatility-Radar/1.0'
  };

  const raw = process.env.BINANCE_WS_HEADERS;
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const headers: Record<string, string> = { ...defaults };

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        headers[key] = value;
      }
    }

    return headers;
  } catch (error) {
    console.warn('解析 BINANCE_WS_HEADERS 失败，将使用默认请求头', error);
    return defaults;
  }
}

function getBaseStreams(): string[] {
  const raw = process.env.BINANCE_WS_BASE_STREAMS;
  if (!raw) {
    return ['came@allTokens@ticker24'];
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length ? parsed : ['came@allTokens@ticker24'];
}

function buildSubscribeFrames(stream: string, baseStreams: string[]): string[] {
  const params = baseStreams.includes(stream) ? [...baseStreams] : [...baseStreams, stream];

  return [
    JSON.stringify({
      method: 'SUBSCRIBE',
      params,
      id: Date.now()
    })
  ];
}

function parseAggTrade(raw: WebSocket.RawData): InternalTick | null {
  try {
    const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
    const data = payload?.data as Record<string, unknown> | undefined;

    if (!data || data['e'] !== 'aggTrade') {
      return null;
    }

    const price = Number.parseFloat(String(data['p'] ?? ''));
    const quantity = Number.parseFloat(String(data['q'] ?? ''));
    if (!Number.isFinite(price)) {
      return null;
    }

    const symbol = typeof data['s'] === 'string' ? data['s'] : null;
    const eventTimeRaw = data['T'] ?? data['E'];
    const eventTime = typeof eventTimeRaw === 'number' ? eventTimeRaw : Date.now();
    const maker = typeof data['m'] === 'boolean' ? data['m'] : null;

    return {
      price,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      eventTime,
      symbol,
      isMaker: maker
    };
  } catch (error) {
    console.warn('解析 Binance WebSocket 消息失败', error);
    return null;
  }
}

function computeStdDevPct(returns: number[]): number | null {
  if (returns.length < 2) {
    return null;
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  return Number.isFinite(stdDev) ? stdDev * 100 : null;
}

function buildSnapshot(
  stream: string,
  baseStreams: string[],
  windowSize: number,
  ticks: InternalTick[],
  warnings: string[]
): AlphaStreamSnapshot {
  const lastTick = ticks.at(-1) ?? null;
  const firstTick = ticks[0] ?? null;

  const returns: number[] = [];
  for (let i = 1; i < ticks.length; i += 1) {
    const prev = ticks[i - 1];
    const current = ticks[i];
    if (prev.price > 0 && current.price > 0) {
      returns.push(current.price / prev.price - 1);
    }
  }

  const meanReturn = returns.length
    ? returns.reduce((sum, value) => sum + value, 0) / returns.length
    : null;
  const stdDevPct = computeStdDevPct(returns);

  return {
    stream,
    baseStreams,
    windowSize,
    ticksCollected: ticks.length,
    partial: ticks.length < windowSize,
    lastPrice: lastTick ? Number(lastTick.price) : null,
    lastQuantity: lastTick ? Number(lastTick.quantity) : null,
    lastTradeTime: lastTick ? new Date(lastTick.eventTime).toISOString() : null,
    firstTradeTime: firstTick ? new Date(firstTick.eventTime).toISOString() : null,
    stdDevPct,
    meanReturnPct: meanReturn !== null ? meanReturn * 100 : null,
    sampleReturnsPct: returns.slice(-10).map((value) => value * 100),
    updatedAt: new Date().toISOString(),
    symbol: lastTick?.symbol ?? firstTick?.symbol ?? null,
    warnings,
    ticks: ticks.slice(-10).map((tick) => ({
      price: tick.price,
      quantity: tick.quantity,
      eventTime: new Date(tick.eventTime).toISOString(),
      symbol: tick.symbol ?? undefined,
      isMaker: tick.isMaker ?? undefined
    }))
  };
}

export async function fetchAlphaStreamSnapshot({
  stream,
  windowSize = 50,
  maxWaitMs = 8000
}: AlphaStreamOptions): Promise<AlphaStreamSnapshot> {
  if (!stream) {
    throw new Error('必须提供 stream 参数，例如 alpha_185usdt@aggTrade');
  }

  const baseStreams = getBaseStreams();
  const headers = parseHeaders();
  const subscribeFrames = buildSubscribeFrames(stream, baseStreams);

  const ticks: InternalTick[] = [];
  const warnings: string[] = [];

  return await new Promise<AlphaStreamSnapshot>((resolve, reject) => {
    let settled = false;

    const ws = new WebSocket(DEFAULT_URL, { headers, handshakeTimeout: 5000 });

    const cleanup = (snapshot?: AlphaStreamSnapshot, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;

      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch (closeError) {
        console.warn('关闭 Binance WebSocket 连接失败', closeError);
      }

      if (error && (!snapshot || snapshot.ticksCollected === 0)) {
        reject(error);
        return;
      }

      if (error) {
        warnings.push(error.message);
      }

      resolve(snapshot ?? buildSnapshot(stream, baseStreams, windowSize, ticks, warnings));
    };

    const timeout = setTimeout(() => {
      if (ticks.length < windowSize) {
        warnings.push(
          `在 ${maxWaitMs}ms 内仅获取到 ${ticks.length} 条 tick 数据，低于请求的窗口 ${windowSize}。`
        );
      }
      cleanup(buildSnapshot(stream, baseStreams, windowSize, ticks, warnings));
    }, maxWaitMs);

    ws.on('open', () => {
      for (const frame of subscribeFrames) {
        ws.send(frame);
      }
    });

    ws.on('message', (raw) => {
      const tick = parseAggTrade(raw);
      if (!tick) {
        return;
      }

      ticks.push(tick);

      if (ticks.length >= windowSize) {
        clearTimeout(timeout);
        cleanup(buildSnapshot(stream, baseStreams, windowSize, ticks, warnings));
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (ticks.length === 0) {
        cleanup(undefined, new Error('Binance WebSocket 在接收到数据前关闭。'));
      } else {
        warnings.push('Binance WebSocket 提前关闭。');
        cleanup(buildSnapshot(stream, baseStreams, windowSize, ticks, warnings));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      if (ticks.length === 0) {
        cleanup(undefined, error instanceof Error ? error : new Error('Binance WebSocket 错误'));
      } else {
        warnings.push('Binance WebSocket 报错，返回已捕获的数据快照。');
        cleanup(buildSnapshot(stream, baseStreams, windowSize, ticks, warnings));
      }
    });
  });
}
