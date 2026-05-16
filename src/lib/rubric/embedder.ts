// Embedder interface + HttpEmbedder (localhost:8001) + MockEmbedder (direct text → vector for tests).

/** Default dev-time embed-server URL. Re-export so the diagnostic component
 *  (RubricTester) and the student-facing widget (RubricResponse) don't drift
 *  apart on the URL. The server lives in scripts/embed-server.mjs. */
export const DEV_EMBEDDER_URL = 'http://localhost:8001/embed';

export interface Embedder {
  /** Engine convention (invariant 2): texts[0] is the student query, texts[1..] are anchors. */
  embed(texts: string[]): Promise<number[][]>;
}

export class HttpEmbedder implements Embedder {
  constructor(
    private readonly url: string,
    /** Tuning constant: 5s covers e5-small batches of ~32 anchors on a warm
     *  server. Raise if larger rubrics start timing out; failure is safe
     *  (engine returns `skipped-embedder`, widget closes the gate). */
    private readonly timeoutMs: number = 5000,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const [query, ...anchors] = texts;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, anchors }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`embed server ${res.status}`);
      const json = (await res.json()) as { queryVector: number[]; anchorVectors: number[][] };
      return [json.queryVector, ...json.anchorVectors];
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Direct text → vector lookup. Tests provide the table. All vectors must share
 * one dimension — validated at construction. Unknown texts return a zero vector
 * of that dimension (cosine 0 against everything). The engine computes real
 * cosines on real vectors; the mock only supplies the vectors, so the engine
 * never special-cases test mode.
 */
export class MockEmbedder implements Embedder {
  private readonly dim: number;
  public calls = 0;

  constructor(private readonly vectors: Record<string, number[]>) {
    const dims = new Set(Object.values(vectors).map((v) => v.length));
    if (dims.size > 1) {
      throw new Error(`MockEmbedder: mixed dimensions ${[...dims].join(',')}`);
    }
    this.dim = [...dims][0] ?? 1;
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.calls += 1;
    return texts.map((t) => this.vectors[t] ?? new Array(this.dim).fill(0));
  }
}
