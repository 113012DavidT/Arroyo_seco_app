import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ReservaGastronomiaDto {
  id?: number;
  usuarioId?: string;
  establecimientoId?: number;
  mesaId?: number;
  fecha: string;
  numeroPersonas: number;
  estado?: string;
  total?: number;
  establecimientoNombre?: string;
  clienteNombre?: string;
  mesaNumero?: number;
}

@Injectable({ providedIn: 'root' })
export class ReservasGastronomiaService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflineSyncService);

  /** Crear nueva reserva */
  crear(payload: { establecimientoId: number; fecha: string; numeroPersonas: number; mesaId?: number | null }): Observable<any> {
    return this.api.post('/ReservasGastronomia', payload);
  }

  /** Obtener reserva por ID */
  getById(id: number): Observable<ReservaGastronomiaDto> {
    return this.api.get<ReservaGastronomiaDto>(`/ReservasGastronomia/${id}`);
  }

  /** Listar reservas del cliente autenticado */
  listByCliente(clienteId: string): Observable<ReservaGastronomiaDto[]> {
    return this.api.get<ReservaGastronomiaDto[]>(`/ReservasGastronomia/cliente/${clienteId}`);
  }

  /** Reservas activas del cliente/oferente autenticado */
  activas(params?: { establecimientoId?: number; clienteId?: string }): Observable<ReservaGastronomiaDto[]> {
    const q: any = {};
    if (params?.establecimientoId) q.establecimientoId = params.establecimientoId;
    if (params?.clienteId) q.clienteId = params.clienteId;
    return this.api
      .get<ReservaGastronomiaDto[]>('/ReservasGastronomia/activas', q)
      .pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  /** Historial de reservas del cliente/oferente autenticado */
  historial(params?: { establecimientoId?: number; clienteId?: string }): Observable<ReservaGastronomiaDto[]> {
    const q: any = {};
    if (params?.establecimientoId) q.establecimientoId = params.establecimientoId;
    if (params?.clienteId) q.clienteId = params.clienteId;
    return this.api
      .get<ReservaGastronomiaDto[]>('/ReservasGastronomia/historial', q)
      .pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  /** Cambiar estado de reserva */
  cambiarEstado(id: number, estado: string): Observable<any> {
    return this.api.patch(`/ReservasGastronomia/${id}/estado`, { estado });
  }

  /** Cancelar reserva */
  cancelar(id: number): Observable<any> {
    return this.cambiarEstado(id, 'Cancelada');
  }

  /** Confirmar reserva (oferente) */
  confirmar(id: number): Observable<any> {
    return this.cambiarEstado(id, 'Confirmada');
  }

  private applyQueuedMutations(serverData: ReservaGastronomiaDto[]): ReservaGastronomiaDto[] {
    const queue = this.offline.getQueuedRequests();
    const result = [...serverData];

    for (const item of queue) {
      const url = item.url.toLowerCase();
      if (!url.includes('/reservasgastronomia')) continue;

      if (item.method === 'POST') {
        const body = item.body || {};
        const localId = Number(`${item.createdAt}`.slice(-9));
        const exists = result.some((r) => Number(r.id) === localId);
        if (exists) continue;

        result.unshift({
          id: localId,
          establecimientoId: body.establecimientoId,
          fecha: body.fecha,
          numeroPersonas: Number(body.numeroPersonas) || 1,
          mesaId: body.mesaId ?? undefined,
          estado: 'Pendiente'
        });
      }

      if (item.method === 'PATCH' && /\/reservasgastronomia\/\d+\/estado$/i.test(url)) {
        const idMatch = url.match(/\/reservasgastronomia\/(\d+)\/estado/i);
        const id = idMatch ? Number(idMatch[1]) : NaN;
        const nuevoEstado = item.body?.estado;
        if (!id || !nuevoEstado) continue;

        const current = result.find((r) => Number(r.id) === id);
        if (current) current.estado = nuevoEstado;
      }
    }

    return result;
  }
}
