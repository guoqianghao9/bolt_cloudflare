const BINANCE_ALPHA_URL =
  'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

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
  price?: string;
  priceHigh24h?: string;
  priceLow24h?: string;
  volume24h?: string;
  count24h?: string;
  percentChange24h?: string;
}

interface BinanceResponse {
  code: string;
  message?: string;
  data?: RawToken[];
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

type IntermediateToken = {
  listingTime: number;
} & ProcessedToken;

export async function fetchAlphaTokens(): Promise<ProcessedToken[]> {
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
  if (payload.code !== '000000' || !payload.data?.length) {
    throw new Error('Binance API 返回异常数据');
  }

  const now = Date.now();

  const processed: IntermediateToken[] = payload.data
    .map((token): IntermediateToken | null => {
      if (!token.symbol || !token.name || typeof token.listingTime !== 'number') {
        return null;
      }

      const listingTime = token.listingTime;
      const price = parseNumber(token.price);
      const priceHigh24h = parseNumber(token.priceHigh24h);
      const priceLow24h = parseNumber(token.priceLow24h);
      const volume24h = parseNumber(token.volume24h);
      const count24h = parseNumber(token.count24h);
      const percentChange24h = parseNumber(token.percentChange24h);

      const volatility = calculateVolatility(priceHigh24h, priceLow24h);
      const daysSinceListing = Math.floor((now - listingTime) / (24 * 60 * 60 * 1000));

      return {
        symbol: token.symbol,
        name: token.name,
        listingTime,
        listingDate: new Date(listingTime).toISOString().slice(0, 10),
        daysSinceListing,
        volatility,
        price,
        volume24h,
        count24h,
        priceHigh24h,
        priceLow24h,
        percentChange24h
      };
    })
    .filter((token): token is IntermediateToken => Boolean(token))
    .filter((token) => now - token.listingTime <= THIRTY_DAYS_IN_MS)
    .sort((a, b) => a.volatility - b.volatility);

  return processed.map(({ listingTime, ...rest }) => rest);
}
