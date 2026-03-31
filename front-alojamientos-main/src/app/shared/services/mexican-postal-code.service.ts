import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface MexicanCpInfo {
  estado: string;
  municipio: string;
  colonias: string[];
}

@Injectable({ providedIn: 'root' })
export class MexicanPostalCodeService {
  private readonly http = inject(HttpClient);

  /** In-memory cache to avoid re-fetching the same CP. */
  private readonly cache = new Map<string, MexicanCpInfo>();

  private readonly API_BASE = 'https://api-sepomex.hckdrk.mx/query/info_cp';

  async lookup(cp: string): Promise<MexicanCpInfo | null> {
    const clean = (cp || '').trim();
    if (clean.length !== 5 || !/^\d{5}$/.test(clean)) return null;

    if (this.cache.has(clean)) return this.cache.get(clean)!;

    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.API_BASE}/${clean}`)
      );

      if (res?.error || !Array.isArray(res?.response) || res.response.length === 0) {
        return null;
      }

      const colonias: string[] = [...new Set<string>(
        res.response.map((r: any) => (r.d_asenta as string) || '')
      )]
        .filter(c => c.trim().length > 0)
        .sort((a, b) => a.localeCompare(b, 'es'));

      const first = res.response[0];
      const info: MexicanCpInfo = {
        estado: first.d_estado ?? '',
        municipio: first.D_mnpio ?? '',
        colonias
      };

      this.cache.set(clean, info);
      return info;
    } catch {
      return null;
    }
  }
}
