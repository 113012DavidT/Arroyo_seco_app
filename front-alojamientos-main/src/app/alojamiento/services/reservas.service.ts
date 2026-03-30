import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface CrearReservaDto {
  alojamientoId: number;
  fechaEntrada: string; // ISO string
  fechaSalida: string;  // ISO string
  huespedes?: number;
}

export interface ReservaDto {
  id?: number | string;
  folio?: string;
  estado?: string;
  alojamientoId?: number;
  alojamientoNombre?: string;
  hospedaje?: string;
  huesped?: string;
  clienteNombre?: string;
  usuarioEmail?: string;
  fechaEntrada?: string;
  fechaSalida?: string;
  total?: number;
  [key: string]: any;
}

export interface ReservaRangoDto {
  inicio: string; // ISO o 'yyyy-MM-ddTHH:mm:ss'
  fin: string;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly offline = inject(OfflineSyncService);

  crear(payload: CrearReservaDto): Observable<any> {
    // Intento 1: endpoint/lowercase con camelCase
    const token = this.auth.getToken();
    const clienteId = token ? this.extractUserId(token) : undefined;
    const bodyCamel: any = {
      alojamientoId: payload.alojamientoId,
      fechaEntrada: payload.fechaEntrada,
      fechaSalida: payload.fechaSalida,
      huespedes: payload.huespedes,
      clienteId
    };
    return this.api.post('/reservas', bodyCamel).pipe(
      catchError(err => {
        // Intento 2: endpoint PascalCase
        const pascal = {
          AlojamientoId: payload.alojamientoId,
          FechaEntrada: payload.fechaEntrada,
          FechaSalida: payload.fechaSalida,
          Huespedes: payload.huespedes,
          ClienteId: clienteId
        };
        return this.api.post('/Reservas', pascal);
      })
    );
  }

  private extractUserId(token: string): string | undefined {
    try {
      const payloadJson = atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      const keys = [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        'nameidentifier',
        'sub',
        'userId',
        'UsuarioId'
      ];
      for (const k of keys) {
        if (payload[k]) return String(payload[k]);
      }
    } catch {}
    return undefined;
  }

  cambiarEstado(id: number, estado: string): Observable<any> {
    return this.api.patch(`/reservas/${id}/estado`, { estado });
  }

  getByFolio(folio: string): Observable<ReservaDto> {
    return this.api.get<ReservaDto>(`/reservas/folio/${folio}`);
  }

  // Lista de reservas del oferente autenticado. Admite filtro por alojamientoId.
  listForOferente(params?: { alojamientoId?: number; estado?: string }): Observable<ReservaDto[]> {
    // Mantener por compatibilidad si se usa en algún lugar; si no existe en backend, preferir listByAlojamiento
    return this.api.get<ReservaDto[]>('/reservas', params as any);
  }

  // Lista de reservas de un alojamiento específico
  listByAlojamiento(alojamientoId: number, estado?: string): Observable<ReservaDto[]> {
    const params: any = {};
    if (estado) params.estado = estado;
    return this.api.get<ReservaDto[]>(`/reservas/alojamiento/${alojamientoId}`, params);
  }

  // Lista de reservas de un cliente específico
  listByCliente(clienteId: string): Observable<ReservaDto[]> {
    return this.api
      .get<ReservaDto[]>(`/reservas/cliente/${clienteId}`)
      .pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  // Historial completo de reservas de un cliente (ordenadas de más reciente a más antigua)
  // Backend: GET /reservas/cliente/{clienteId}/historial
  historialByCliente(clienteId: string): Observable<ReservaDto[]> {
    return this.api
      .get<ReservaDto[]>(`/reservas/cliente/${clienteId}/historial`)
      .pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  // Rango de fechas ocupadas (estado Confirmada) para pintar calendario
  getCalendario(alojamientoId: number): Observable<ReservaRangoDto[]> {
    return this.api.get<ReservaRangoDto[]>(`/alojamientos/${alojamientoId}/calendario`);
  }

  // Reservas activas para el rol autenticado (Admin/Oferente/Cliente)
  // Ahora acepta opcionalmente `clienteId` para filtrar por cliente específico.
  activas(params?: { alojamientoId?: number; clienteId?: string }): Observable<any[]> {
    const q: any = {};
    if (params?.alojamientoId) q.alojamientoId = params.alojamientoId;
    if (params?.clienteId) q.clienteId = params.clienteId;
    return this.api.get<any[]>(`/reservas/activas`, q).pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  // Historial de reservas para el rol autenticado (Admin/Oferente/Cliente)
  // Ahora acepta opcionalmente `clienteId` para filtrar por cliente específico.
  historial(params?: { alojamientoId?: number; clienteId?: string }): Observable<any[]> {
    const q: any = {};
    if (params?.alojamientoId) q.alojamientoId = params.alojamientoId;
    if (params?.clienteId) q.clienteId = params.clienteId;
    return this.api.get<any[]>(`/reservas/historial`, q).pipe(map((data) => this.applyQueuedMutations(data || [])));
  }

  // Subir comprobante de pago (multipart/form-data con campo 'archivo')
  subirComprobante(reservaId: number, archivo: File): Observable<any> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.api.post(`/reservas/${reservaId}/comprobante`, form);
  }

  crearConComprobante(payload: CrearReservaDto, archivo: File): Observable<any> {
    const form = new FormData();
    // Duplicar nombres de campos en camelCase y PascalCase para compatibilidad
    form.append('alojamientoId', payload.alojamientoId.toString());
    form.append('AlojamientoId', payload.alojamientoId.toString());
    form.append('fechaEntrada', payload.fechaEntrada);
    form.append('FechaEntrada', payload.fechaEntrada);
    form.append('fechaSalida', payload.fechaSalida);
    form.append('FechaSalida', payload.fechaSalida);
    form.append('comprobante', archivo, archivo.name);
    form.append('Comprobante', archivo, archivo.name);
    form.append('archivo', archivo, archivo.name);

    const tryEndpoints = [
      '/reservas/crear-con-comprobante',
      '/Reservas/crear-con-comprobante',
      '/Reservas/CrearConComprobante',
      '/reservas/crearConComprobante'
    ];

    // Intentar secuencialmente distintos endpoints hasta que alguno funcione
    const attempt = (idx: number): Observable<any> => {
      if (idx >= tryEndpoints.length) {
        // Si ninguno funciona, propagar el error original
        return throwError(() => new Error('No se pudo crear la reserva con comprobante'));
      }
      return this.api.post(tryEndpoints[idx], form).pipe(
        catchError(() => attempt(idx + 1))
      );
    };

    return attempt(0);
  }

  aceptar(id: number): Observable<any> {
    // Usa el endpoint genérico de cambio de estado a 'Confirmada'
    return this.cambiarEstado(id, 'Confirmada');
  }

  rechazar(id: number): Observable<any> {
    // Intento principal: 'Rechazada'. Si backend falla (500) probar 'Cancelada'.
    return this.cambiarEstado(id, 'Rechazada').pipe(
      catchError(err => {
        if (err?.status === 500) {
          // Fallback a 'Cancelada' por posible regla de transición en backend
            return this.cambiarEstado(id, 'Cancelada').pipe(
              catchError(e2 => throwError(() => e2))
            );
        }
        return throwError(() => err);
      })
    );
  }

  private applyQueuedMutations(serverData: any[]): any[] {
    const queue = this.offline.getQueuedRequests();
    const result = [...serverData];

    for (const item of queue) {
      const url = item.url.toLowerCase();
      if (!/\/reservas(\/|$)/i.test(url)) continue;

      if (item.method === 'POST') {
        const body = item.body || {};
        const localId = Number(`${item.createdAt}`.slice(-9));
        const exists = result.some((r) => Number(r?.id) === localId);
        if (exists) continue;

        result.unshift({
          id: localId,
          alojamientoId: body.alojamientoId || body.AlojamientoId,
          fechaEntrada: body.fechaEntrada || body.FechaEntrada,
          fechaSalida: body.fechaSalida || body.FechaSalida,
          huespedes: body.huespedes || body.Huespedes || 1,
          estado: 'Pendiente'
        });
      }

      if (item.method === 'PATCH' && /\/reservas\/\d+\/estado$/i.test(url)) {
        const idMatch = url.match(/\/reservas\/(\d+)\/estado/i);
        const id = idMatch ? Number(idMatch[1]) : NaN;
        const nuevoEstado = item.body?.estado;
        if (!id || !nuevoEstado) continue;

        const current = result.find((r) => Number(r?.id) === id);
        if (current) current.estado = nuevoEstado;
      }
    }

    return result;
  }
}
