import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Observable } from 'rxjs';

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
  fotoPrincipal?: string;
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
}
