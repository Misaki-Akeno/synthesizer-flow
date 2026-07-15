import { NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/rag/vectorStore';
import { normalizeTopK } from '@/lib/rag/searchParams';
import { auth } from '@/lib/auth/auth';
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac';
import { readBoundedJsonBody } from '@/lib/http/readJsonBody';

export const runtime = 'nodejs';

const MAX_QUERY_LENGTH = 2_000;
const MAX_REQUEST_BODY_BYTES = 16_000;

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

    const bodyResult = await readBoundedJsonBody(req, MAX_REQUEST_BODY_BYTES);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error },
        { status: bodyResult.status }
      );
    }
    const body = bodyResult.data;

    const bodyRecord =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const query =
      typeof bodyRecord.query === 'string' ? bodyRecord.query.trim() : '';
    const topK = normalizeTopK(bodyRecord.topK);
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: 'query is too long' }, { status: 413 });
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
