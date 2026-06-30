import { NextResponse } from 'next/server';
import { upsertDocuments } from '@/lib/rag/vectorStore';
import { splitMarkdown } from '@/lib/rag/markdownSplitter';
import { auth } from '@/lib/auth/auth';
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

function logIngestDebug(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.info(message, data ?? '');
  }
}

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

    if (!hasPermission(session, PERMISSIONS.RAG_INGEST)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin only' },
        { status: 403 }
      );
    }

    const body = await readJsonBody(req);
    if (body === null) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const bodyRecord =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};

    // log body summary for debugging (avoid logging secrets)
    logIngestDebug(
      '[RAG][ingest] incoming body keys:',
      Object.keys(bodyRecord)
    );

    const items = Array.isArray(bodyRecord.items) ? bodyRecord.items : [];
    if (!items.length) {
      return NextResponse.json(
        { error: 'items must be a non-empty array' },
        { status: 400 }
      );
    }

    // basic validation
    const invalid = items.findIndex((it: unknown) => {
      if (!it || typeof it !== 'object') return true;
      const record = it as Record<string, unknown>;
      const t = record.text;
      const id = record.id;
      const meta = record.meta;

      return (
        typeof t !== 'string' ||
        !t.trim() ||
        (id !== undefined && (typeof id !== 'string' || !id.trim())) ||
        (meta !== undefined &&
          (typeof meta !== 'object' || meta === null || Array.isArray(meta)))
      );
    });
    if (invalid >= 0) {
      return NextResponse.json(
        {
          error: `items[${invalid}] must include non-empty text, optional non-empty string id, and optional object meta`,
        },
        { status: 400 }
      );
    }

    // Process items with Markdown semantic splitting
    interface IngestItem {
      id?: string;
      text: string;
      meta?: Record<string, unknown>;
    }

    const chunkedItems: IngestItem[] = [];

    for (const item of items as IngestItem[]) {
      // Use splitMarkdown to split text into semantically meaningful chunks
      const chunks = splitMarkdown(item.text.trim()).filter((chunk) =>
        chunk.trim()
      );

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

    logIngestDebug(
      `[RAG][ingest] Split ${items.length} docs into ${chunkedItems.length} chunks.`
    );

    const res = await upsertDocuments(chunkedItems);
    logIngestDebug('[RAG][ingest] result:', res);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    console.error('[RAG][ingest] error:', e);
    const err =
      e instanceof Error
        ? { message: e.message, stack: e.stack }
        : { message: String(e) };
    return NextResponse.json(
      {
        error: err.message,
        detail: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
