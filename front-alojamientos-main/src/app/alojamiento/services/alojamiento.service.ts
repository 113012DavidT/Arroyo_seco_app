import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Observable } from 'rxjs';

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

  listAll(): Observable<AlojamientoDto[]> {
    return this.api.get<AlojamientoDto[]>('/alojamientos');
  }

  getById(id: number): Observable<AlojamientoDto> {
    return this.api.get<AlojamientoDto>(`/alojamientos/${id}`);
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
    return this.api.get<AlojamientoDto[]>('/alojamientos/mios');
  }

  listFotos(id: number): Observable<FotoAlojamientoDto[]> {
    return this.api.get<FotoAlojamientoDto[]>(`/alojamientos/${id}/fotos`);
  }

  uploadFotos(id: number, files: File[]): Observable<FotoAlojamientoDto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return this.api.post<FotoAlojamientoDto[]>(`/alojamientos/${id}/fotos`, formData);
  }

  deleteFoto(id: number, fotoId: number): Observable<void> {
    return this.api.delete<void>(`/alojamientos/${id}/fotos/${fotoId}`);
  }

  uploadTempFoto(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ url: string }>('/Storage/upload?folder=fotos/alojamientos', formData);
  }
}
