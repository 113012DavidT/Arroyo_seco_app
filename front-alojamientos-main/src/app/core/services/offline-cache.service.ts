import { Injectable } from '@angular/core';

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  private readonly prefix = 'as-offline-cache-v2:';
  private readonly defaultTtlMs = 1000 * 60 * 60 * 24 * 14; // 14 days

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (typeof localStorage === 'undefined') return;

    const entry: CacheEntry<T> = {
      value,
      updatedAt: Date.now(),
      expiresAt: Date.now() + Math.max(1000, ttlMs)
    };

    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // If storage is full or blocked, fail silently.
    }
  }

  get<T>(key: string): T | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || typeof parsed !== 'object') return null;

      if (typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return parsed.value ?? null;
    } catch {
      return null;
    }
  }

  remove(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.prefix + key);
  }

  keyFromUrl(url: string): string {
    return url.toLowerCase();
  }
}
