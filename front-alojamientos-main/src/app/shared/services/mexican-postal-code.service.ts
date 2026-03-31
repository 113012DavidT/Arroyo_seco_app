import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

export interface MexicanCpInfo {
  estado: string;
  municipio: string;
  colonias: string[];
}

@Injectable({ providedIn: 'root' })
export class MexicanPostalCodeService {
  private readonly api = inject(ApiService);

  /** In-memory cache to avoid re-fetching the same CP. */
  private readonly cache = new Map<string, MexicanCpInfo>();

  async lookup(cp: string): Promise<MexicanCpInfo | null> {
    const clean = (cp || '').trim();
    if (clean.length !== 5 || !/^\d{5}$/.test(clean)) return null;

    if (this.cache.has(clean)) return this.cache.get(clean)!;

    try {
      const res: any = await firstValueFrom(
        this.api.get<any>(`/ubicacion/cp/${clean}`)
      );

      if (!res || !Array.isArray(res.colonias)) return null;

      const info: MexicanCpInfo = {
        estado: res.estado ?? '',
        municipio: res.municipio ?? '',
        colonias: res.colonias as string[]
      };

      this.cache.set(clean, info);
      return info;
    } catch {
      return null;
    }
  }
}
