import { NextResponse } from 'next/server';
import { upsertDocuments } from '@/lib/rag/vectorStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // log body summary for debugging (avoid logging secrets)
    try {
      console.info('[RAG][ingest] incoming body keys:', Object.keys(body || {}));
    } catch {}

    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }

    // basic validation
    const invalid = items.findIndex((it: unknown) => {
      if (!it || typeof it !== 'object') return true;
      const t = (it as Record<string, unknown>).text;
      return typeof t !== 'string' || !t.trim();
    });
    if (invalid >= 0) {
      return NextResponse.json({ error: `items[${invalid}].text must be a non-empty string` }, { status: 400 });
    }

    const res = await upsertDocuments(items);
    console.info('[RAG][ingest] result:', res);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    console.error('[RAG][ingest] error:', e);
    const err = e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) };
    return NextResponse.json({ error: err.message, detail: process.env.NODE_ENV === 'development' ? err.stack : undefined }, { status: 500 });
  }
}
