import { NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/rag/vectorStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
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
