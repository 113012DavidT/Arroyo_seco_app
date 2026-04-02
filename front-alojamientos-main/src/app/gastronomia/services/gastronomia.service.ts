import { inject, Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { map, Observable, shareReplay } from 'rxjs';

interface ApiEnvelope<T> {
  data?: T;
}

export interface FotoEstablecimientoDto {
  id?: number;
  establecimientoId?: number;
  url: string;
  orden?: number;
}

// ===== Interfaces =====
export interface EstablecimientoDto {
  id?: number;
  oferenteId?: string;
  nombre: string;
  ubicacion: string;
  tipoEstablecimiento?: string;
  horaApertura?: string;
  horaCierre?: string;
  amenidades?: string[];
  descripcion: string;
  fotoPrincipal?: string;
  fotos?: FotoEstablecimientoDto[];
  fotosUrls?: string[];
  estado?: string;
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  menus?: MenuDto[];
  mesas?: MesaDto[];
}

export interface MenuDto {
  id?: number;
  establecimientoId?: number;
  nombre: string;
  items?: MenuItemDto[];
}

export interface MenuItemDto {
  id?: number;
  menuId?: number;
  nombre: string;
  descripcion: string;
  precio: number;
}

export interface MesaDto {
  id?: number;
  establecimientoId?: number;
  numero: number;
  capacidad: number;
  disponible?: boolean;
}

export interface ReservaGastronomiaDto {
  id?: number;
  usuarioId?: string;
  establecimientoId?: number;
  mesaId?: number;
  fecha: string; // ISO string
  numeroPersonas: number;
  estado?: string;
  total?: number;
  establecimientoNombre?: string;
  clienteNombre?: string;
  mesaNumero?: number;
}

export interface CrearReservaGastronomiaDto {
  fecha: string;
  numeroPersonas: number;
  mesaId?: number;
}

export interface DisponibilidadDto {
  mesasDisponibles: number;
  mesas?: MesaDto[];
  horaApertura?: string;
  horaCierre?: string;
}

export interface ReviewGastronomiaDto {
  id?: number;
  establecimientoId?: number;
  usuarioId?: string;
  puntuacion: number;
  comentario: string;
  fecha?: string;
  usuarioNombre?: string;
  nombreUsuario?: string;
  nombre?: string;
}

export interface CrearReviewGastronomiaDto {
  puntuacion: number;
  comentario: string;
}

export interface ReviewOferenteDto {
  id: number;
  establecimientoId: number;
  establecimientoNombre: string;
  usuarioId: string;
  comentario: string;
  puntuacion: number;
  fecha: string;
  estado: string;
  motivoRechazo?: string;
}

export interface ReportarReviewDto {
  motivo?: string;
}

export interface ReviewReportadaAdminDto {
  id: number;
  establecimientoId: number;
  establecimientoNombre: string;
  usuarioId: string;
  comentario: string;
  puntuacion: number;
  fecha: string;
  estado: string;
  motivoReporte?: string;
  tipoSolicitud?: string;
  moderadaPorId?: string;
  fechaModeracionUtc?: string;
}

export interface ResolverReporteReviewDto {
  esValido: boolean;
  comentarioAdmin?: string;
}

export interface RankingGastronomiaDto extends EstablecimientoDto {
  promedio?: number;
  totalResenas?: number;
  scoreNeurona?: number;
}

export interface AnalyticsBucketDto {
  etiqueta: string;
  valor: number;
}

export interface AnalyticsTopBottomDto {
  nombre: string;
  promedio?: number;
  totalResenas?: number;
}

export interface GastronomiaAnalyticsDto {
  totalResenas: number;
  promedio: number;
  distribucionEstrellas: AnalyticsBucketDto[];
  top5: AnalyticsTopBottomDto[];
  bottom5: AnalyticsTopBottomDto[];
  tendenciaMensual: AnalyticsBucketDto[];
}

export interface AdminTopEstablecimientoDto {
  id: number;
  nombre: string;
  tipo: string;
  totalReservas: number;
  promedio: number;
}

export interface NeuronaMetricsDto {
  totalEvaluados: number;
  clasificacionesMl: number;
  clasificacionesFallback: number;
  claseAlta: number;
  claseMedia: number;
  claseBaja: number;
  confianzaPromedio: number;
}

export interface AdminGastronomiaAnalyticsDto {
  totalEstablecimientos: number;
  totalReservas: number;
  totalResenas: number;
  promedioCalificacion: number;
  solicitudesPendientes: number;
  reportesPendientes: number;
  reservasPorMes: AnalyticsBucketDto[];
  establecimientosPorTipo: AnalyticsBucketDto[];
  topEstablecimientos: AdminTopEstablecimientoDto[];
  neurona: NeuronaMetricsDto;
}

@Injectable({ providedIn: 'root' })
export class GastronomiaService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflineSyncService);
  private analyticsCache$?: Observable<GastronomiaAnalyticsDto>;
  private adminAnalyticsCache$?: Observable<AdminGastronomiaAnalyticsDto>;

  private normalizeHour(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  private normalizeFoto(foto: FotoEstablecimientoDto): FotoEstablecimientoDto {
    return {
      ...foto,
      url: this.api.toPublicAssetUrl(foto?.url)
    };
  }

  private normalizeEstablecimiento(item: EstablecimientoDto): EstablecimientoDto {
    const fotos = (item.fotos || []).map((foto) => this.normalizeFoto(foto));
    const fotosUrls = (item.fotosUrls || []).map((url) => this.api.toPublicAssetUrl(url)).filter(Boolean);

    return {
      ...item,
      fotoPrincipal: this.api.toPublicAssetUrl(item.fotoPrincipal),
      horaApertura: this.normalizeHour(item.horaApertura),
      horaCierre: this.normalizeHour(item.horaCierre),
      fotos,
      fotosUrls
    };
  }

  private applyQueuedMutations(items: EstablecimientoDto[]): EstablecimientoDto[] {
    const result: EstablecimientoDto[] = items.map((item) => ({
      ...item,
      mesas: (item.mesas || []).map((mesa) => ({ ...mesa })),
      menus: (item.menus || []).map((menu) => ({ ...menu, items: (menu.items || []).map((menuItem) => ({ ...menuItem })) }))
    }));

    const queue = this.offline.getQueuedRequests();

    for (const queued of queue) {
      const url = queued.url.toLowerCase();
      const body = queued.body || {};

      if (queued.method === 'POST' && /\/gastronomias$/i.test(url)) {
        const localId = Number(`${queued.createdAt}`.slice(-9));
        if (result.some((item) => Number(item.id) === localId)) continue;

        result.unshift(this.normalizeEstablecimiento({
          id: localId,
          nombre: body.nombre || 'Establecimiento pendiente',
          ubicacion: body.ubicacion || body.direccion || '',
          descripcion: body.descripcion || '',
          tipoEstablecimiento: body.tipoEstablecimiento,
          direccion: body.direccion,
          fotoPrincipal: body.fotoPrincipal,
          fotosUrls: body.fotosUrls || [],
          horaApertura: body.horaApertura,
          horaCierre: body.horaCierre,
          amenidades: body.amenidades || [],
          estado: 'Pendiente',
          menus: [],
          mesas: []
        }));
        continue;
      }

      const entityMatch = url.match(/\/gastronomias\/(\d+)(?:$|\/)/i);
      const entityId = entityMatch ? Number(entityMatch[1]) : NaN;
      if (!entityId) continue;

      if (queued.method === 'PUT' && /\/gastronomias\/\d+$/i.test(url)) {
        const current = result.find((item) => Number(item.id) === entityId);
        if (current) {
          Object.assign(current, this.normalizeEstablecimiento({ ...current, ...body }));
        }
        continue;
      }

      if (queued.method === 'DELETE' && /\/gastronomias\/\d+$/i.test(url)) {
        const idx = result.findIndex((item) => Number(item.id) === entityId);
        if (idx >= 0) result.splice(idx, 1);
        continue;
      }

      const current = result.find((item) => Number(item.id) === entityId);
      if (!current) continue;

      if (queued.method === 'POST' && /\/gastronomias\/\d+\/mesas$/i.test(url)) {
        current.mesas = current.mesas || [];
        const localMesaId = Number(`${queued.createdAt}`.slice(-9));
        if (current.mesas.some((mesa) => Number(mesa.id) === localMesaId || mesa.numero === Number(body.numero))) continue;

        current.mesas.push({
          id: localMesaId,
          establecimientoId: entityId,
          numero: Number(body.numero) || current.mesas.length + 1,
          capacidad: Number(body.capacidad) || 1,
          disponible: body.disponible !== false
        });
        continue;
      }

      if (queued.method === 'PUT' && /\/gastronomias\/\d+\/mesas\/\d+\/disponible$/i.test(url)) {
        const mesaMatch = url.match(/\/mesas\/(\d+)\/disponible$/i);
        const mesaId = mesaMatch ? Number(mesaMatch[1]) : NaN;
        const mesa = (current.mesas || []).find((item) => Number(item.id) === mesaId);
        if (mesa) {
          mesa.disponible = typeof body === 'boolean' ? body : !!body?.disponible;
        }
        continue;
      }

      if (queued.method === 'POST' && /\/gastronomias\/\d+\/menus$/i.test(url)) {
        current.menus = current.menus || [];
        const localMenuId = Number(`${queued.createdAt}`.slice(-9));
        if (current.menus.some((menu) => Number(menu.id) === localMenuId || menu.nombre === body.nombre)) continue;

        current.menus.push({
          id: localMenuId,
          establecimientoId: entityId,
          nombre: body.nombre || 'Menu pendiente',
          items: []
        });
        continue;
      }

      if (queued.method === 'POST' && /\/gastronomias\/\d+\/menus\/\d+\/items$/i.test(url)) {
        const menuMatch = url.match(/\/menus\/(\d+)\/items$/i);
        const menuId = menuMatch ? Number(menuMatch[1]) : NaN;
        const menu = (current.menus || []).find((item) => Number(item.id) === menuId);
        if (!menu) continue;

        menu.items = menu.items || [];
        const localItemId = Number(`${queued.createdAt}`.slice(-9));
        if (menu.items.some((item) => Number(item.id) === localItemId || item.nombre === body.nombre)) continue;

        menu.items.push({
          id: localItemId,
          menuId,
          nombre: body.nombre || 'Item pendiente',
          descripcion: body.descripcion || '',
          precio: Number(body.precio) || 0
        });
      }
    }

    return result;
  }

  private applyQueuedMenuMutations(establecimientoId: number, menus: MenuDto[]): MenuDto[] {
    const establecimientos = this.applyQueuedMutations([{ id: establecimientoId, nombre: '', ubicacion: '', descripcion: '', menus }]);
    return establecimientos[0]?.menus || [];
  }

  private unwrapItem<T>(response: T | ApiEnvelope<T> | null | undefined): T | null {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as ApiEnvelope<T>).data ?? null;
    }

    return (response as T) ?? null;
  }

  private unwrapArray<T>(response: T[] | ApiEnvelope<T[]> | null | undefined): T[] {
    return this.unwrapItem<T[]>(response) ?? [];
  }

  // ===== Públicos (sin autenticación) =====
  
  /** Listar todos los establecimientos */
  listAll(): Observable<EstablecimientoDto[]> {
    return this.api
      .get<EstablecimientoDto[] | ApiEnvelope<EstablecimientoDto[]>>('/Gastronomias')
      .pipe(map((response) => this.applyQueuedMutations(this.unwrapArray(response).map((item) => this.normalizeEstablecimiento(item)))));
  }

  /** Ranking de restaurantes (orden del backend) */
  getRanking(): Observable<RankingGastronomiaDto[]> {
    return this.api
      .get<RankingGastronomiaDto[] | ApiEnvelope<RankingGastronomiaDto[]>>('/Gastronomias/ranking')
      .pipe(map((response) => this.unwrapArray(response).map((item) => this.normalizeEstablecimiento(item as RankingGastronomiaDto) as RankingGastronomiaDto)));
  }

  /** Ranking silencioso: no activa el spinner global (para enriquecer en background) */
  getRankingBackground(): Observable<RankingGastronomiaDto[]> {
    const h = new HttpHeaders({ 'X-Skip-Loading': '1' });
    return this.api
      .get<RankingGastronomiaDto[] | ApiEnvelope<RankingGastronomiaDto[]>>('/Gastronomias/ranking', undefined, h)
      .pipe(map((response) => this.unwrapArray(response).map((item) => this.normalizeEstablecimiento(item as RankingGastronomiaDto) as RankingGastronomiaDto)));
  }

  /** Analitica de restaurantes del oferente autenticado */
  getAnalytics(forceRefresh = false): Observable<GastronomiaAnalyticsDto> {
    if (!this.analyticsCache$ || forceRefresh) {
      this.analyticsCache$ = this.api
        .get<GastronomiaAnalyticsDto | ApiEnvelope<GastronomiaAnalyticsDto>>('/Gastronomias/analytics')
        .pipe(
          map((response) => this.unwrapItem(response) ?? {
            totalResenas: 0,
            promedio: 0,
            distribucionEstrellas: [],
            top5: [],
            bottom5: [],
            tendenciaMensual: []
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }

    return this.analyticsCache$;
  }

  getAdminAnalytics(forceRefresh = false): Observable<AdminGastronomiaAnalyticsDto> {
    if (!this.adminAnalyticsCache$ || forceRefresh) {
      this.adminAnalyticsCache$ = this.api
        .get<AdminGastronomiaAnalyticsDto | ApiEnvelope<AdminGastronomiaAnalyticsDto>>('/Gastronomias/admin/analytics')
        .pipe(
          map((response) => this.unwrapItem(response) ?? {
            totalEstablecimientos: 0,
            totalReservas: 0,
            totalResenas: 0,
            promedioCalificacion: 0,
            solicitudesPendientes: 0,
            reportesPendientes: 0,
            reservasPorMes: [],
            establecimientosPorTipo: [],
            topEstablecimientos: [],
            neurona: {
              totalEvaluados: 0,
              clasificacionesMl: 0,
              clasificacionesFallback: 0,
              claseAlta: 0,
              claseMedia: 0,
              claseBaja: 0,
              confianzaPromedio: 0
            }
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }

    return this.adminAnalyticsCache$;
  }

  /** Detalle de un establecimiento */
  getById(id: number): Observable<EstablecimientoDto> {
    return this.api
      .get<EstablecimientoDto | ApiEnvelope<EstablecimientoDto>>(`/Gastronomias/${id}`)
      .pipe(map((response) => this.applyQueuedMutations([this.normalizeEstablecimiento(this.unwrapItem(response) as EstablecimientoDto)])[0]));
  }

  /** Listar menús de un establecimiento */
  getMenus(id: number): Observable<MenuDto[]> {
    return this.api
      .get<MenuDto[] | ApiEnvelope<MenuDto[]>>(`/Gastronomias/${id}/menus`)
      .pipe(map((response) => this.applyQueuedMenuMutations(id, this.unwrapArray(response))));
  }

  /** Verificar disponibilidad en una fecha */
  getDisponibilidad(id: number, fecha: string): Observable<DisponibilidadDto> {
    return this.api
      .get<DisponibilidadDto | ApiEnvelope<DisponibilidadDto>>(`/Gastronomias/${id}/disponibilidad`, { fecha })
      .pipe(
        map((response) => {
          const disponibilidad = this.unwrapItem(response) as DisponibilidadDto;
          return {
            mesasDisponibles: disponibilidad?.mesasDisponibles ?? 0,
            mesas: (disponibilidad?.mesas || []).map((mesa) => ({ ...mesa })),
            horaApertura: this.normalizeHour(disponibilidad?.horaApertura),
            horaCierre: this.normalizeHour(disponibilidad?.horaCierre)
          };
        })
      );
  }

  /** Listar reseñas de un establecimiento */
  getReviews(id: number): Observable<ReviewGastronomiaDto[]> {
    return this.api
      .get<ReviewGastronomiaDto[] | ApiEnvelope<ReviewGastronomiaDto[]>>(`/Gastronomias/${id}/reviews`)
      .pipe(map((response) => this.unwrapArray(response)));
  }

  /** Reseñas silenciosas: no activa el spinner global (para carga en background) */
  getReviewsBackground(id: number): Observable<ReviewGastronomiaDto[]> {
    const h = new HttpHeaders({ 'X-Skip-Loading': '1' });
    return this.api
      .get<ReviewGastronomiaDto[] | ApiEnvelope<ReviewGastronomiaDto[]>>(`/Gastronomias/${id}/reviews`, undefined, h)
      .pipe(map((response) => this.unwrapArray(response)));
  }

  /** Crear reseña de un establecimiento */
  createReview(id: number, payload: CrearReviewGastronomiaDto): Observable<number> {
    return this.api.post<number>(`/Gastronomias/${id}/reviews`, payload);
  }

  /** Listar reseñas de establecimientos del oferente */
  getMisReviews(): Observable<ReviewOferenteDto[]> {
    return this.api.get<ReviewOferenteDto[]>(`/Gastronomias/reviews/mias`);
  }

  /** Reportar reseña como oferente */
  reportarReview(reviewId: number, payload: ReportarReviewDto): Observable<void> {
    return this.api.patch<void>(`/Gastronomias/reviews/${reviewId}/reportar`, payload);
  }

  /** Solicitar eliminación de reseña como oferente */
  solicitarEliminacionReview(reviewId: number, payload: ReportarReviewDto): Observable<void> {
    return this.api.patch<void>(`/Gastronomias/reviews/${reviewId}/solicitar-eliminacion`, payload);
  }

  /** Admin: listar reseñas reportadas */
  listReviewsReportadas(): Observable<ReviewReportadaAdminDto[]> {
    return this.api.get<ReviewReportadaAdminDto[]>(`/Gastronomias/reviews/reportadas`);
  }

  /** Admin: resolver reporte de reseña */
  resolverReporteReview(reviewId: number, payload: ResolverReporteReviewDto): Observable<void> {
    return this.api.patch<void>(`/Gastronomias/reviews/${reviewId}/resolver-reporte`, payload);
  }

  // ===== Oferente (autenticado) =====

  /** Crear establecimiento */
  create(payload: EstablecimientoDto): Observable<any> {
    return this.api.post('/Gastronomias', payload);
  }

  /** Crear menú */
  createMenu(establecimientoId: number, payload: { nombre: string }): Observable<any> {
    return this.api.post(`/Gastronomias/${establecimientoId}/menus`, payload);
  }

  /** Agregar item a menú */
  addMenuItem(establecimientoId: number, menuId: number, payload: MenuItemDto): Observable<any> {
    return this.api.post(`/Gastronomias/${establecimientoId}/menus/${menuId}/items`, payload);
  }

  /** Crear mesa */
  createMesa(establecimientoId: number, payload: { numero: number; capacidad: number; disponible?: boolean }): Observable<any> {
    return this.api.post(`/Gastronomias/${establecimientoId}/mesas`, payload);
  }

  /** Cambiar disponibilidad de mesa */
  setMesaDisponible(establecimientoId: number, mesaId: number, disponible: boolean): Observable<any> {
    return this.api.put(`/Gastronomias/${establecimientoId}/mesas/${mesaId}/disponible`, disponible);
  }

  /** Actualizar disponibilidad de mesa */
  updateDisponibilidadMesa(establecimientoId: number, mesaId: number, disponible: boolean): Observable<any> {
    return this.api.put(`/Gastronomias/${establecimientoId}/mesas/${mesaId}/disponible`, disponible);
  }

  /** Listar reservas del establecimiento */
  getReservas(establecimientoId: number): Observable<ReservaGastronomiaDto[]> {
    return this.api
      .get<ReservaGastronomiaDto[] | ApiEnvelope<ReservaGastronomiaDto[]>>(`/Gastronomias/${establecimientoId}/reservas`)
      .pipe(map((response) => this.unwrapArray(response)));
  }

  /** Listar establecimientos propios del oferente */
  listMine(): Observable<EstablecimientoDto[]> {
    return this.api
      .get<EstablecimientoDto[] | ApiEnvelope<EstablecimientoDto[]>>('/Gastronomias/mios')
      .pipe(map((response) => this.applyQueuedMutations(this.unwrapArray(response).map((item) => this.normalizeEstablecimiento(item)))));
  }

  /** Actualizar establecimiento */
  update(id: number, payload: Partial<EstablecimientoDto>): Observable<any> {
    return this.api.put(`/Gastronomias/${id}`, payload);
  }

  /** Eliminar establecimiento */
  delete(id: number): Observable<any> {
    return this.api.delete(`/Gastronomias/${id}`);
  }

  listFotos(id: number): Observable<FotoEstablecimientoDto[]> {
    return this.api
      .get<FotoEstablecimientoDto[] | ApiEnvelope<FotoEstablecimientoDto[]>>(`/Gastronomias/${id}/fotos`)
      .pipe(map((response) => this.unwrapArray(response).map((foto) => this.normalizeFoto(foto))));
  }

  uploadFotos(id: number, files: File[]): Observable<FotoEstablecimientoDto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return this.api
      .post<FotoEstablecimientoDto[]>(`/Gastronomias/${id}/fotos`, formData)
      .pipe(map((response) => (response || []).map((foto) => this.normalizeFoto(foto))));
  }

  deleteFoto(id: number, fotoId: number): Observable<void> {
    return this.api.delete<void>(`/Gastronomias/${id}/fotos/${fotoId}`);
  }

  uploadTempFoto(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api
      .post<{ url: string }>('/Storage/upload?folder=fotos/gastronomia', formData)
      .pipe(map((response) => ({ ...response, url: this.api.toPublicAssetUrl(response?.url) })));
  }

  // ===== Cliente (autenticado) =====

  /** Crear reserva */
  createReserva(establecimientoId: number, payload: CrearReservaGastronomiaDto): Observable<any> {
    return this.api.post(`/Gastronomias/${establecimientoId}/reservas`, payload);
  }
}
