import sampleTokens from '@/config/sample-alpha-tokens.json';

const BINANCE_ALPHA_URL =
  'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_IN_MS = 30 * DAY_IN_MS;

export interface ProcessedToken {
  symbol: string;
  name: string;
  listingDate: string;
  daysSinceListing: number;
  volatility: number;
  price: number;
  volume24h: number;
  count24h: number;
  priceHigh24h: number;
  priceLow24h: number;
  percentChange24h: number;
}

interface RawToken {
  symbol?: string;
  name?: string;
  listingTime?: number;
  price?: string | number;
  priceHigh24h?: string | number;
  priceLow24h?: string | number;
  volume24h?: string | number;
  count24h?: string | number;
  percentChange24h?: string | number;
}

interface BinanceResponse {
  code: string;
  message?: string;
  messageDetail?: string;
  data?: unknown;
}

function extractTokens(input: unknown): RawToken[] {
  if (Array.isArray(input)) {
    return input as RawToken[];
  }

  if (input && typeof input === 'object') {
    const container = input as Record<string, unknown>;
    const candidateKeys = ['list', 'tokenList', 'tokens', 'rows', 'data'];

    for (const key of candidateKeys) {
      const value = container[key];
      if (Array.isArray(value)) {
        return value as RawToken[];
      }
    }
  }

  return [];
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function calculateVolatility(high: number, low: number): number {
  if (!Number.isFinite(high) || !Number.isFinite(low)) return 0;
  if (low <= 0) return 0;
  return Math.abs(high / low - 1) * 100;
}

type SampleToken = Omit<ProcessedToken, 'daysSinceListing'> & {
  daysSinceListing?: number;
};

function getFallbackTokens(): ProcessedToken[] {
  const now = Date.now();

  return (sampleTokens as SampleToken[])
    .map((token) => {
      const listingTimestamp = Date.parse(`${token.listingDate}T00:00:00Z`);
      const derivedDays = Number.isFinite(listingTimestamp)
        ? Math.max(0, Math.floor((now - listingTimestamp) / (24 * 60 * 60 * 1000)))
        : 0;

      return {
        ...token,
        daysSinceListing: typeof token.daysSinceListing === 'number' ? token.daysSinceListing : derivedDays
      } as ProcessedToken;
    })
    .sort((a, b) => a.volatility - b.volatility);
}

export type FetchAlphaTokensResult = {
  tokens: ProcessedToken[];
  source: 'live' | 'fallback';
  error?: string;
};

export async function fetchAlphaTokens(): Promise<FetchAlphaTokensResult> {
  try {
    const response = await fetch(BINANCE_ALPHA_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Alpha-Volatility-Radar/1.0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Binance API 请求失败: ${response.status}`);
    }

    const payload = (await response.json()) as BinanceResponse;
    if (payload.code !== '000000') {
      throw new Error(payload.messageDetail ?? payload.message ?? 'Binance API 返回异常数据');
    }

    const rawTokens = extractTokens(payload.data);
    if (!rawTokens.length) {
      throw new Error('Binance API 未返回有效的代币数据');
    }

    const now = Date.now();

    const processed: ProcessedToken[] = rawTokens
      .map((token): ProcessedToken | null => {
        if (!token || !token.symbol || !token.name || typeof token.listingTime !== 'number') {
          return null;
        }

        const listingTime = token.listingTime;
        if (!Number.isFinite(listingTime)) {
          return null;
        }

        const age = now - listingTime;
        if (age < 0 || age > THIRTY_DAYS_IN_MS) {
          return null;
        }

        const price = parseNumber(token.price);
        const priceHigh24h = parseNumber(token.priceHigh24h);
        const priceLow24h = parseNumber(token.priceLow24h);
        const volume24h = parseNumber(token.volume24h);
        const count24h = Math.max(0, Math.trunc(parseNumber(token.count24h)));
        const percentChange24h = parseNumber(token.percentChange24h);

        return {
          symbol: token.symbol,
          name: token.name,
          listingDate: new Date(listingTime).toISOString().slice(0, 10),
          daysSinceListing: Math.max(0, Math.floor(age / DAY_IN_MS)),
          volatility: calculateVolatility(priceHigh24h, priceLow24h),
          price,
          volume24h,
          count24h,
          priceHigh24h,
          priceLow24h,
          percentChange24h
        };
      })
      .filter((token): token is ProcessedToken => Boolean(token))
      .sort((a, b) => a.volatility - b.volatility);

    return {
      tokens: processed,
      source: 'live'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.warn('获取 Binance Alpha 数据失败，使用本地示例数据。', message);
    return {
      tokens: getFallbackTokens(),
      source: 'fallback',
      error: message
    };
  }
}
