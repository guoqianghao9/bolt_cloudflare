import { NextRequest, NextResponse } from 'next/server';

import { getServiceRoleClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = getServiceRoleClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase 环境变量未配置，无法查询订阅信息。' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  const userId = searchParams.get('userId');

  if (!walletAddress && !userId) {
    return NextResponse.json({ error: '必须提供 wallet 或 userId 参数。' }, { status: 400 });
  }

  let query = supabase
    .from('user_subscriptions')
    .select('status, tier, current_period_end')
    .limit(1)
    .order('updated_at', { ascending: false });

  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('查询订阅状态失败', error);
    return NextResponse.json({ error: '查询订阅状态失败。' }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ tier: 'member', status: 'inactive' });
  }

  const record = data[0];
  const tier = record.tier === 'premium' ? 'premium' : 'member';

  return NextResponse.json({
    tier,
    status: record.status ?? 'inactive',
    currentPeriodEnd: record.current_period_end ?? null
  });
}
