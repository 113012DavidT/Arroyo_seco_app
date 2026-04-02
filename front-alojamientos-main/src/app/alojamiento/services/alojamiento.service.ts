import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface FotoAlojamientoDto {
  id?: number;
  alojamientoId?: number;
  url: string;
  orden?: number;
}

export interface AlojamientoDto {
  id?: number;
  nombre: string;
  ubicacion: string;
  descripcion?: string;
  latitud?: number | null;
  longitud?: number | null;
  direccion?: string;
  maxHuespedes: number;
  habitaciones: number;
  banos: number;
  precioPorNoche: number;
  amenidades?: string[];
  fotoPrincipal?: string;
  fotos?: FotoAlojamientoDto[];
  fotosUrls?: string[];
}

@Injectable({ providedIn: 'root' })
export class AlojamientoService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflineSyncService);

  private normalizeFoto(foto: FotoAlojamientoDto): FotoAlojamientoDto {
    return {
      ...foto,
      url: this.api.toPublicAssetUrl(foto?.url)
    };
  }

  private normalizeAlojamiento(item: AlojamientoDto): AlojamientoDto {
    return {
      ...item,
      fotoPrincipal: this.api.toPublicAssetUrl(item.fotoPrincipal),
      fotos: (item.fotos || []).map((foto) => this.normalizeFoto(foto)),
      fotosUrls: (item.fotosUrls || []).map((url) => this.api.toPublicAssetUrl(url)).filter(Boolean)
    };
  }

  private applyQueuedMutations(items: AlojamientoDto[]): AlojamientoDto[] {
    const result = items.map((item) => ({ ...item }));
    const queue = this.offline.getQueuedRequests();

    for (const queued of queue) {
      const url = queued.url.toLowerCase();
      const body = queued.body || {};

      if (queued.method === 'POST' && /\/alojamientos$/i.test(url)) {
        const localId = Number(`${queued.createdAt}`.slice(-9));
        if (result.some((item) => Number(item.id) === localId)) continue;

        result.unshift(this.normalizeAlojamiento({
          id: localId,
          nombre: body.nombre || 'Alojamiento pendiente',
          ubicacion: body.ubicacion || body.direccion || '',
          descripcion: body.descripcion || '',
          direccion: body.direccion,
          maxHuespedes: Number(body.maxHuespedes) || 1,
          habitaciones: Number(body.habitaciones) || 1,
          banos: Number(body.banos) || 1,
          precioPorNoche: Number(body.precioPorNoche) || 0,
          amenidades: body.amenidades || [],
          fotoPrincipal: body.fotoPrincipal,
          fotosUrls: body.fotosUrls || []
        }));
        continue;
      }

      const match = url.match(/\/alojamientos\/(\d+)(?:$|\/)/i);
      const entityId = match ? Number(match[1]) : NaN;
      if (!entityId) continue;

      if (queued.method === 'PUT' && /\/alojamientos\/\d+$/i.test(url)) {
        const current = result.find((item) => Number(item.id) === entityId);
        if (current) {
          Object.assign(current, this.normalizeAlojamiento({ ...current, ...body }));
        }
        continue;
      }

      if (queued.method === 'DELETE' && /\/alojamientos\/\d+$/i.test(url)) {
        const idx = result.findIndex((item) => Number(item.id) === entityId);
        if (idx >= 0) result.splice(idx, 1);
      }
    }

    return result;
  }

  listAll(): Observable<AlojamientoDto[]> {
    return this.api.get<AlojamientoDto[]>('/alojamientos').pipe(
      map((items) => this.applyQueuedMutations((items || []).map((item) => this.normalizeAlojamiento(item))))
    );
  }

  getById(id: number): Observable<AlojamientoDto> {
    return this.api.get<AlojamientoDto>(`/alojamientos/${id}`).pipe(
      map((item) => this.applyQueuedMutations([this.normalizeAlojamiento(item)])[0])
    );
  }

  create(payload: AlojamientoDto): Observable<any> {
    return this.api.post('/alojamientos', payload);
  }

  update(id: number, payload: Partial<AlojamientoDto>): Observable<any> {
    return this.api.put(`/alojamientos/${id}`, payload);
  }

  delete(id: number): Observable<any> {
    return this.api.delete(`/alojamientos/${id}`);
  }

  listMine(): Observable<AlojamientoDto[]> {
    return this.api.get<AlojamientoDto[]>('/alojamientos/mios').pipe(
      map((items) => this.applyQueuedMutations((items || []).map((item) => this.normalizeAlojamiento(item))))
    );
  }

  listFotos(id: number): Observable<FotoAlojamientoDto[]> {
    return this.api.get<FotoAlojamientoDto[]>(`/alojamientos/${id}/fotos`).pipe(
      map((items) => (items || []).map((item) => this.normalizeFoto(item)))
    );
  }

  uploadFotos(id: number, files: File[]): Observable<FotoAlojamientoDto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return this.api.post<FotoAlojamientoDto[]>(`/alojamientos/${id}/fotos`, formData).pipe(
      map((items) => (items || []).map((item) => this.normalizeFoto(item)))
    );
  }

  deleteFoto(id: number, fotoId: number): Observable<void> {
    return this.api.delete<void>(`/alojamientos/${id}/fotos/${fotoId}`);
  }

  uploadTempFoto(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ url: string }>('/Storage/upload?folder=fotos/alojamientos', formData).pipe(
      map((response) => ({ ...response, url: this.api.toPublicAssetUrl(response?.url) }))
    );
  }
}
