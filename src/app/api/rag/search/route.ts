import { NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/rag/vectorStore';
import { auth } from '@/lib/auth/auth';
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. 鉴权检查
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session, PERMISSIONS.RAG_SEARCH)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const query: string = body?.query;
    const rawTopK = parseInt(body?.topK, 10);
    const topK: number = Number.isFinite(rawTopK) ? Math.max(1, Math.min(rawTopK, 20)) : 5;
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const res = await searchDocuments(query, topK);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    console.error('[RAG][search] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
