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
  private readonly http  = inject(HttpClient);
  private readonly cache = new Map<string, MexicanCpInfo>();

  async lookup(cp: string): Promise<MexicanCpInfo | null> {
    const clean = (cp || '').trim();
    if (clean.length !== 5 || !/^\d{5}$/.test(clean)) return null;
    if (this.cache.has(clean)) return this.cache.get(clean)!;

    const fromIcalia = await this.tryIcaliaLabs(clean);
    if (fromIcalia) {
      this.cache.set(clean, fromIcalia);
      return fromIcalia;
    }

    return null;
  }

  // Catalogo SEPOMEX expuesto por un proveedor con CORS habilitado.
  private async tryIcaliaLabs(cp: string): Promise<MexicanCpInfo | null> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`)
      );
      const arr = res?.zip_codes;
      if (!Array.isArray(arr) || arr.length === 0) return null;

      const first     = arr[0];
      const estado    = first.d_estado ?? '';
      const municipio = first.D_mnpio  ?? '';
      const colonias  = [...new Set<string>(
        arr.map((e: any) => (e.d_asenta as string)?.trim() ?? '').filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'es'));

      return colonias.length > 0 ? { estado, municipio, colonias } : null;
    } catch {
      return null;
    }
  }
}
