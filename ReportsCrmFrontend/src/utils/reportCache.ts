interface CacheEntry<T> {
  data: T;
  timestamp: number;
  filters: Record<string, any>;
}

class ReportCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, filters: Record<string, any> = {}): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      filters,
    });
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key) as CacheEntry<T> | undefined;
  }

  getWithExpiry<T>(
    key: string,
    expiryMs: number = 5 * 60 * 1000
  ): CacheEntry<T> | null {
    const entry = this.get<T>(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > expiryMs;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  clear(key: string): void {
    this.cache.delete(key);
  }

  clearAll(): void {
    this.cache.clear();
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

export const reportCache = new ReportCache();
