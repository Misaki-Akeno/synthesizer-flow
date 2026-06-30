import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth/auth';
import { searchDocuments } from '@/lib/rag/vectorStore';

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rag/vectorStore', () => ({
  searchDocuments: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockSearchDocuments = vi.mocked(searchDocuments);

function createSearchRequest(body: unknown): Request {
  return new Request('http://localhost/api/rag/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function createRawSearchRequest(body: string): Request {
  return new Request('http://localhost/api/rag/search', {
    method: 'POST',
    body,
  });
}

describe('POST /api/rag/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(createSearchRequest({ query: 'oscillator' }));

    expect(response.status).toBe(401);
    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });

  it('allows regular users to search according to RBAC policy', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'user',
        name: null,
        email: null,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    mockSearchDocuments.mockResolvedValue({ matches: [] });

    const response = await POST(
      createSearchRequest({ query: 'oscillator', topK: 100 })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, matches: [] });
    expect(mockSearchDocuments).toHaveBeenCalledWith('oscillator', 20);
  });

  it('normalizes topK to a bounded integer before searching', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'user',
        name: null,
        email: null,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    mockSearchDocuments.mockResolvedValue({ matches: [] });

    await POST(createSearchRequest({ query: 'oscillator', topK: 0 }));
    await POST(createSearchRequest({ query: 'filter', topK: 3.9 }));

    expect(mockSearchDocuments).toHaveBeenNthCalledWith(1, 'oscillator', 1);
    expect(mockSearchDocuments).toHaveBeenNthCalledWith(2, 'filter', 3);
  });

  it('rejects authenticated users without a recognized role', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-2',
        role: 'guest',
        name: null,
        email: null,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await POST(createSearchRequest({ query: 'oscillator' }));

    expect(response.status).toBe(403);
    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });

  it('rejects blank queries before calling vector search', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'user',
        name: null,
        email: null,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await POST(createSearchRequest({ query: '   ' }));

    expect(response.status).toBe(400);
    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON bodies', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'user',
        name: null,
        email: null,
        image: null,
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await POST(createRawSearchRequest('{bad json'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });
});
