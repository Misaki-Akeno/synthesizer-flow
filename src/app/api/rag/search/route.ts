import { NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/rag/vectorStore';
import { normalizeTopK } from '@/lib/rag/searchParams';
import { auth } from '@/lib/auth/auth';
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

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

    const body = await readJsonBody(req);
    if (body === null) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const bodyRecord = body as Record<string, unknown>;
    const query =
      typeof bodyRecord.query === 'string' ? bodyRecord.query.trim() : '';
    const topK = normalizeTopK(bodyRecord.topK);
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const res = await searchDocuments(query, topK);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    console.error('[RAG][search] error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
