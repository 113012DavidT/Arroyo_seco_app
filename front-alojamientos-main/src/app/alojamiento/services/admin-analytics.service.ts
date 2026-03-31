import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

export interface AnalyticsBucketDto {
  etiqueta: string;
  valor: number;
}

export interface TopEstablecimientoReservasDto {
  nombre: string;
  tipo: string;
  totalReservas: number;
}

export interface AdminAnalyticsDto {
  totalUsuarios: number;
  totalOferentes: number;
  solicitudesPendientes: number;
  reportesResenasPendientes: number;
  usuariosPorSexo: AnalyticsBucketDto[];
  usuariosPorCodigoPostal: AnalyticsBucketDto[];
  topEstablecimientosPorReservas: TopEstablecimientoReservasDto[];
}

@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
  private readonly api = inject(ApiService);

  getAnalytics(): Observable<AdminAnalyticsDto> {
    return this.api.get<AdminAnalyticsDto>('/admin/usuarios/analytics');
  }
}
