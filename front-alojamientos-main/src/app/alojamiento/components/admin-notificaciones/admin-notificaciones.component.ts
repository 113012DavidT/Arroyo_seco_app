import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificacionesService, NotificacionDto } from '../../services/notificaciones.service';
import { PwaPushService } from '../../../core/services/pwa-push.service';
import { first } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { GastronomiaService, ReviewReportadaAdminDto } from '../../../gastronomia/services/gastronomia.service';

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  fecha?: string;
  tipo?: string;
  urlAccion?: string;
  estatus: 'Abierta' | 'Atendida';
  leida: boolean;
}

@Component({
  selector: 'app-admin-notificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-notificaciones.component.html',
  styleUrl: './admin-notificaciones.component.scss'
})
export class AdminNotificacionesComponent implements OnInit {
  activeTab: 'notificaciones' | 'reportes' = 'notificaciones';
  searchTerm = '';
  notificaciones: Notificacion[] = [];
  reportes: ReviewReportadaAdminDto[] = [];
  loading = false;
  loadingReportes = false;
  error: string | null = null;
  errorReportes: string | null = null;
  pushSupported = false;
  pushEnabled = false;
  pushLoading = false;
  resolvingReportId: number | null = null;
  comentarioPorReporte: Record<number, string> = {};

  constructor(
    private notiService: NotificacionesService,
    private pushService: PwaPushService,
    private gastronomiaService: GastronomiaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'reportes') {
      this.activeTab = 'reportes';
    }
    this.cargar();
    this.cargarReportes();
    this.initPushState();
  }

  setActiveTab(tab: 'notificaciones' | 'reportes') {
    this.activeTab = tab;
    this.searchTerm = '';
  }

  private async initPushState() {
    this.pushSupported = this.pushService.isSupported();
    if (!this.pushSupported) return;
    this.pushEnabled = await this.pushService.hasActiveSubscription();
  }

  async activarPush() {
    if (this.pushLoading) return;
    this.pushLoading = true;
    try {
      const ok = await this.pushService.enablePush();
      this.pushEnabled = ok;
    } finally {
      this.pushLoading = false;
    }
  }

  async desactivarPush() {
    if (this.pushLoading) return;
    this.pushLoading = true;
    try {
      await this.pushService.disablePush();
      this.pushEnabled = false;
    } finally {
      this.pushLoading = false;
    }
  }

  async enviarPushPrueba() {
    try {
      await this.pushService.sendTest();
    } catch {
      this.error = 'No se pudo enviar la prueba push';
    }
  }

  cargar() {
    this.loading = true;
    this.error = null;
    this.notiService.list(false).pipe(first()).subscribe({
      next: (data: NotificacionDto[]) => {
        const mapped: Notificacion[] = (data || []).reduce((acc, d) => {
            const rawId = (d as any)?.id ?? (d as any)?.ID ?? (d as any)?.notificacionId ?? '';
            if (!rawId) return acc;
            acc.push({
              id: String(rawId),
              titulo: d.titulo || 'Notificación',
              mensaje: d.mensaje || '',
              fecha: d.fecha,
              tipo: d.tipo,
              urlAccion: d.urlAccion,
              estatus: (d.leida ? 'Atendida' : 'Abierta') as 'Atendida' | 'Abierta',
              leida: !!d.leida
            });
            return acc;
          }, [] as Notificacion[]);
        this.notificaciones = mapped;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar las notificaciones';
        this.loading = false;
      }
    });
  }

  cargarReportes() {
    this.loadingReportes = true;
    this.errorReportes = null;
    this.gastronomiaService.listReviewsReportadas().pipe(first()).subscribe({
      next: (data) => {
        this.reportes = data || [];
        this.loadingReportes = false;
      },
      error: () => {
        this.errorReportes = 'No se pudieron cargar los reportes de reseñas';
        this.loadingReportes = false;
      }
    });
  }

  formatFecha(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get filteredNotificaciones(): Notificacion[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.notificaciones;
    return this.notificaciones.filter(item => [item.titulo, item.mensaje, item.tipo || ''].some(v => v.toLowerCase().includes(term)));
  }

  get filteredReportes(): ReviewReportadaAdminDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.reportes;
    return this.reportes.filter(item => [
      item.establecimientoNombre,
      item.comentario,
      item.motivoReporte || '',
      item.tipoSolicitud || ''
    ].some(v => v.toLowerCase().includes(term)));
  }

  esSolicitudEliminacion(reporte: ReviewReportadaAdminDto): boolean {
    return (reporte.tipoSolicitud || '').toLowerCase() === 'eliminacion' || reporte.estado === 'EliminacionSolicitada';
  }

  marcarLeida(n: Notificacion) {
    if (!n.id) return;
    this.notiService.marcarLeida(n.id).pipe(first()).subscribe({
      next: () => {
        n.leida = true;
        n.estatus = 'Atendida';
      },
      error: () => this.error = 'No se pudo marcar como leída'
    });
  }

  verNotificacion(n: Notificacion) {
    if (!n.urlAccion) return;
    this.router.navigateByUrl(n.urlAccion);
  }

  resolverReporte(reporte: ReviewReportadaAdminDto, esValido: boolean) {
    this.resolvingReportId = reporte.id;
    this.errorReportes = null;
    this.gastronomiaService.resolverReporteReview(reporte.id, {
      esValido,
      comentarioAdmin: (this.comentarioPorReporte[reporte.id] || '').trim() || undefined
    }).pipe(first()).subscribe({
      next: () => {
        this.reportes = this.reportes.filter(r => r.id !== reporte.id);
        delete this.comentarioPorReporte[reporte.id];
        this.resolvingReportId = null;
      },
      error: () => {
        this.errorReportes = this.esSolicitudEliminacion(reporte)
          ? 'No se pudo resolver la solicitud de eliminación'
          : 'No se pudo resolver el reporte';
        this.resolvingReportId = null;
      }
    });
  }
}
