import { NextResponse } from 'next/server';
import { upsertDocuments } from '@/lib/rag/vectorStore';
import { splitMarkdown } from '@/lib/rag/markdownSplitter';
import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. 鉴权检查
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Process items with Markdown semantic splitting
    interface IngestItem {
      id?: string;
      text: string;
      meta?: Record<string, unknown>;
    }

    const chunkedItems: IngestItem[] = [];

    for (const item of (items as IngestItem[])) {
      // Use splitMarkdown to split text into semantically meaningful chunks
      const chunks = splitMarkdown(item.text);

      chunks.forEach((chunkText, idx) => {
        // Construct new ID: append suffix if multiple chunks
        let newId = item.id;
        if (chunks.length > 1 && item.id) {
          newId = `${item.id}_part_${idx}`;
        }

        // Add chunking info to metadata
        const newMeta = {
          ...(item.meta || {}),
          chunkIndex: idx,
          totalChunks: chunks.length,
          originalId: item.id,
        };

        chunkedItems.push({
          id: newId,
          text: chunkText,
          meta: newMeta,
        });
      });
    }

    console.info(`[RAG][ingest] Split ${items.length} docs into ${chunkedItems.length} chunks.`);

    const res = await upsertDocuments(chunkedItems);
    console.info('[RAG][ingest] result:', res);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    console.error('[RAG][ingest] error:', e);
    const err = e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) };
    return NextResponse.json({ error: err.message, detail: process.env.NODE_ENV === 'development' ? err.stack : undefined }, { status: 500 });
  }
}
