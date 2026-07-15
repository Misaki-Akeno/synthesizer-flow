import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth/auth';
import { upsertDocuments } from '@/lib/rag/vectorStore';

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rag/vectorStore', () => ({
  upsertDocuments: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  }),
}));

const mockAuth = vi.mocked(auth);
const mockUpsertDocuments = vi.mocked(upsertDocuments);

function createIngestRequest(body: unknown): Request {
  return new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function createRawIngestRequest(body: string): Request {
  return new Request('http://localhost/api/rag/ingest', {
    method: 'POST',
    body,
  });
}

const userSession = {
  user: {
    id: 'user-1',
    role: 'user',
    name: null,
    email: null,
    image: null,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const adminSession = {
  ...userSession,
  user: {
    ...userSession.user,
    role: 'admin',
  },
};

describe('POST /api/rag/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(createIngestRequest({ items: [] }));

    expect(response.status).toBe(401);
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    mockAuth.mockResolvedValue(userSession);

    const response = await POST(
      createIngestRequest({ items: [{ text: 'Oscillator docs' }] })
    );

    expect(response.status).toBe(403);
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });

  it('rejects malformed items before embedding or database writes', async () => {
    mockAuth.mockResolvedValue(adminSession);

    const response = await POST(
      createIngestRequest({
        items: [
          {
            id: '',
            text: 'Oscillator docs',
            meta: [],
          },
        ],
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('items[0]');
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON bodies', async () => {
    mockAuth.mockResolvedValue(adminSession);

    const response = await POST(createRawIngestRequest('{bad json'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });

  it('allows admins to ingest trimmed chunked documents', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockUpsertDocuments.mockResolvedValue({ inserted: 1, total: 1 });

    const response = await POST(
      createIngestRequest({
        items: [
          {
            id: 'osc',
            text: '  # Oscillator\n\nA sound source.  ',
            meta: { source: 'manual' },
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, inserted: 1, total: 1 });
    expect(mockUpsertDocuments).toHaveBeenCalledWith([
      {
        id: 'osc',
        text: '# Oscillator\n\nA sound source.',
        meta: {
          source: 'manual',
          chunkIndex: 0,
          totalChunks: 1,
          originalId: 'osc',
        },
      },
    ]);
  });

  it('rejects oversized document batches before embedding', async () => {
    mockAuth.mockResolvedValue(adminSession);

    const response = await POST(
      createIngestRequest({
        items: Array.from({ length: 51 }, (_, index) => ({
          id: `doc-${index}`,
          text: 'text',
        })),
      })
    );

    expect(response.status).toBe(413);
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });

  it('rejects oversized raw request bodies before JSON parsing', async () => {
    mockAuth.mockResolvedValue(adminSession);

    const response = await POST(
      createIngestRequest({
        items: [{ text: 'valid', meta: { padding: 'x'.repeat(1_500_000) } }],
      })
    );

    expect(response.status).toBe(413);
    expect(mockUpsertDocuments).not.toHaveBeenCalled();
  });
});
