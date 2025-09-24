import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2024-06-20';

function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return null;
  }
  return new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: 'Alpha Volatility Radar',
      url: 'https://github.com/bolt-cloudflare/alpha-volatility-radar'
    }
  });
}

type CheckoutPayload = {
  productId?: string;
  priceId?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  walletAddress?: string;
  userId?: string;
};

async function fetchStripePrice(stripe: Stripe, priceId: string): Promise<Stripe.Price> {
  try {
    return await stripe.prices.retrieve(priceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法读取 Stripe 价格 ${priceId}：${message}`);
  }
}

function isStripePrice(value: unknown): value is Stripe.Price {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  );
}

function isMonthlyRecurringPrice(price: Stripe.Price): boolean {
  if (!price.active) {
    return false;
  }
  if (price.type !== 'recurring' || !price.recurring) {
    return false;
  }

  const intervalCount = price.recurring.interval_count ?? 1;
  return price.recurring.interval === 'month' && intervalCount === 1;
}

async function resolveProductPriceId(stripe: Stripe, productId: string): Promise<string> {
  let product: Stripe.Product;

  try {
    product = await stripe.products.retrieve(productId, {
      expand: ['default_price']
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法读取 Stripe 产品 ${productId}：${message}`);
  }

  if (isStripePrice(product.default_price) && isMonthlyRecurringPrice(product.default_price)) {
    return product.default_price.id;
  }

  if (typeof product.default_price === 'string') {
    const price = await fetchStripePrice(stripe, product.default_price);
    if (isMonthlyRecurringPrice(price)) {
      return price.id;
    }
  }

  try {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100
    });

    const monthly = prices.data.find((price) => isMonthlyRecurringPrice(price));
    if (monthly) {
      return monthly.id;
    }

    const recurring = prices.data.find((price) => price.active && price.type === 'recurring');
    if (recurring) {
      throw new Error(
        '该 Stripe 产品存在订阅价格，但不是按月计费。请创建一个 interval 为 month 且 interval_count 为 1 的价格。'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`查询 Stripe 产品价格失败：${message}`);
  }

  throw new Error('该 Stripe 产品没有启用的按月订阅价格，请在 Stripe Dashboard 中创建一个按月收费的价格。');
}

async function resolveConfiguredPriceId(
  stripe: Stripe,
  candidate?: string | null
): Promise<string> {
  if (!candidate) {
    throw new Error('缺少 Stripe 价格或产品 ID。');
  }

  const normalized = candidate.trim();
  if (!normalized) {
    throw new Error('缺少 Stripe 价格或产品 ID。');
  }

  if (normalized.startsWith('price_')) {
    const price = await fetchStripePrice(stripe, normalized);
    if (!isMonthlyRecurringPrice(price)) {
      throw new Error(
        '该 Stripe 价格不是启用的按月订阅价格。请确保选择 active 状态、interval = month、interval_count = 1 的 recurring price。'
      );
    }
    return price.id;
  }

  if (normalized.startsWith('prod_')) {
    return resolveProductPriceId(stripe, normalized);
  }

  throw new Error('STRIPE_PRICE_ID 仅支持以 price_ 或 prod_ 开头的 Stripe 标识符。');
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe 环境变量未配置。' }, { status: 500 });
  }

  const body = (await request.json()) as CheckoutPayload;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin') ?? requestUrl.origin;
  const successUrl =
    body.successUrl ?? process.env.STRIPE_SUCCESS_URL ?? `${origin.replace(/\/$/, '')}/stripe/success`;
  const cancelUrl =
    body.cancelUrl ?? process.env.STRIPE_CANCEL_URL ?? `${origin.replace(/\/$/, '')}/stripe/cancel`;

  let priceId: string;
  try {
    const rawIdentifier = body.priceId ?? body.productId ?? process.env.STRIPE_PRICE_ID;
    priceId = await resolveConfiguredPriceId(stripe, rawIdentifier);
  } catch (error) {
    const message = error instanceof Error ? error.message : '缺少 Stripe 价格或产品 ID。';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: body.customerEmail,
      client_reference_id: body.userId ?? body.walletAddress,
      metadata: {
        walletAddress: body.walletAddress ?? '',
        userId: body.userId ?? '',
        source: 'alpha-volatility-radar'
      },
      subscription_data: {
        metadata: {
          walletAddress: body.walletAddress ?? '',
          userId: body.userId ?? '',
          source: 'alpha-volatility-radar'
        }
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('创建 Stripe Checkout 会话失败', error);
    return NextResponse.json({ error: `创建 Stripe 会话失败：${message}` }, { status: 500 });
  }
}
