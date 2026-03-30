import { NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/rag/vectorStore';
import { auth } from '@/lib/auth/auth';
import { isAdmin } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. 鉴权与管理员检查
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const query: string = body?.query;
    const topK: number = Math.max(1, Math.min(Number(body?.topK) || 5, 20));
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const res = await searchDocuments(query, topK);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
