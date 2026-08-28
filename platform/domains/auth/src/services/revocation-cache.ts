const DEFAULT_TTL_MS = 30_000;

interface CacheEntry {
  expiresAt: number;
}

export class RevocationCache {
  readonly #cache = new Map<string, CacheEntry>();
  readonly #ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.#ttlMs = ttlMs;
  }

  isValid(jti: string): boolean {
    const entry = this.#cache.get(jti);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(jti);
      return false;
    }
    return true;
  }

  markValid(jti: string): void {
    this.#cache.set(jti, { expiresAt: Date.now() + this.#ttlMs });
  }
}
