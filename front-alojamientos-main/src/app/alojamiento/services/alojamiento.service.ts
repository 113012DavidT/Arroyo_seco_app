import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
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

  listAll(): Observable<AlojamientoDto[]> {
    return this.api.get<AlojamientoDto[]>('/alojamientos').pipe(
      map((items) => (items || []).map((item) => this.normalizeAlojamiento(item)))
    );
  }

  getById(id: number): Observable<AlojamientoDto> {
    return this.api.get<AlojamientoDto>(`/alojamientos/${id}`).pipe(
      map((item) => this.normalizeAlojamiento(item))
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
      map((items) => (items || []).map((item) => this.normalizeAlojamiento(item)))
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
