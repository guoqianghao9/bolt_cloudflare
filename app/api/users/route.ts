import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase';

type RequestPayload = {
  userId?: string;
  walletAddress?: string;
  email?: string | null;
  username?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  const supabase = getServiceRoleClient();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase 环境变量未配置，无法保存登录信息。' },
      { status: 500 }
    );
  }

  const body = (await request.json()) as RequestPayload;
  if (!body.userId || !body.walletAddress) {
    return NextResponse.json({ error: 'userId 与 walletAddress 为必填字段。' }, { status: 400 });
  }

  const payload = {
    user_id: body.userId,
    wallet_address: body.walletAddress,
    email: body.email ?? null,
    username: body.username ?? null,
    metadata: body.metadata ?? null,
    last_login_at: new Date().toISOString()
  };

  const { error } = await supabase.from('user_logins').upsert(payload, {
    onConflict: 'user_id'
  });

  if (error) {
    console.error('保存 Dynamic 登录用户失败', error);
    return NextResponse.json({ error: '保存用户登录数据失败。' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
