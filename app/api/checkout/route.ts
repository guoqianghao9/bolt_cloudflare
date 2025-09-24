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
  priceId?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  walletAddress?: string;
  userId?: string;
};

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe 环境变量未配置。' }, { status: 500 });
  }

  const body = (await request.json()) as CheckoutPayload;
  const defaultPrice = process.env.STRIPE_PRICE_ID;
  const successUrl = body.successUrl ?? process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = body.cancelUrl ?? process.env.STRIPE_CANCEL_URL;

  if (!(body.priceId ?? defaultPrice)) {
    return NextResponse.json({ error: '缺少 Stripe 价格 ID。' }, { status: 400 });
  }

  if (!successUrl || !cancelUrl) {
    return NextResponse.json({ error: '必须设置 successUrl 与 cancelUrl。' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: body.priceId ?? defaultPrice!,
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
    console.error('创建 Stripe Checkout 会话失败', error);
    return NextResponse.json({ error: '创建 Stripe 会话失败。' }, { status: 500 });
  }
}
