import { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

interface RagMatch {
  id: string;
  score: number;
  textSnippet: string;
  meta?: Record<string, unknown>;
}

export default function RagDebugger() {
  const [text, setText] = useState('Hello RAG from DevTools.');
  const [meta, setMeta] = useState('{"source":"devtools","note":"demo"}');
  const [query, setQuery] = useState('Hello');
  const [topK, setTopK] = useState(5);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<RagMatch[]>([]);

  const parseMeta = () => {
    const trimmed = meta.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch (_e) {
      throw new Error('Meta 必须是合法 JSON');
    }
  };

  const handleIngest = async () => {
    if (!text.trim()) {
      setMessage('请输入文本');
      return;
    }
    setIngestLoading(true);
    setMessage(null);
    try {
      const metaObj = parseMeta();
      const resp = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ text, meta: metaObj }] }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || '写入失败');
      }
      setMessage(`写入成功，新增 ${json.inserted} 条，总计 ${json.total || '未知'} 条`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '写入失败';
      setMessage(msg);
    } finally {
      setIngestLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setMessage('请输入查询');
      return;
    }
    setSearchLoading(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || '检索失败');
      }
      setMatches(json.matches || []);
      setMessage(`检索成功，返回 ${json.matches?.length || 0} 条`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '检索失败';
      setMessage(msg);
      setMatches([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">写入文本</label>
        <textarea
          className="w-full min-h-[80px] rounded border bg-background px-2 py-1 text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="text-xs font-medium">Meta (JSON 可选)</label>
        <textarea
          className="w-full min-h-[60px] rounded border bg-background px-2 py-1 text-xs font-mono"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />
        <Button size="sm" onClick={handleIngest} disabled={ingestLoading}>
          {ingestLoading ? '写入中...' : '写入 RAG'}
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">查询</label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入查询"
          className="h-8 text-xs"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={topK}
            onChange={(e) => setTopK(Math.max(1, Math.min(Number(e.target.value) || 1, 20)))}
            className="h-8 w-20 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} disabled={searchLoading}>
            {searchLoading ? '检索中...' : '搜索'}
          </Button>
        </div>
      </div>

      {message && <div className="text-xs text-muted-foreground">{message}</div>}

      <div className="space-y-2">
        <div className="text-xs font-medium">结果</div>
        {matches.length === 0 ? (
          <div className="text-xs text-muted-foreground">暂无结果</div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="rounded border p-2">
                <div className="text-[11px] font-mono text-muted-foreground">
                  {m.id} · score {m.score.toFixed(4)}
                </div>
                <div className="text-xs mt-1">{m.textSnippet}</div>
                {m.meta && (
                  <pre className="mt-1 bg-muted/50 rounded p-1 text-[11px] overflow-auto">
                    {JSON.stringify(m.meta, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
