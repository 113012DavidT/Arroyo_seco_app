import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { GastronomiaService, AdminGastronomiaAnalyticsDto, EstablecimientoDto } from '../../../gastronomia/services/gastronomia.service';
import { PdfExportService } from '../../../shared/services/pdf-export.service';

interface DashboardStats {
  totalEstablecimientos: number;
  totalReservas: number;
  totalResenas: number;
  promedioCalificacion: number;
  solicitudesPendientes: number;
  reportesPendientes: number;
}

@Component({
  selector: 'app-admin-dashboard-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard-gastronomia.component.html',
  styleUrl: './admin-dashboard-gastronomia.component.scss'
})
export class AdminDashboardGastronomiaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('reservasChart') reservasChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tiposChart') tiposChartRef?: ElementRef<HTMLCanvasElement>;

  stats: DashboardStats = {
    totalEstablecimientos: 0,
    totalReservas: 0,
    totalResenas: 0,
    promedioCalificacion: 0,
    solicitudesPendientes: 0,
    reportesPendientes: 0
  };

  analytics: AdminGastronomiaAnalyticsDto | null = null;
  establecimientos: EstablecimientoDto[] = [];
  loading = true;
  error: string | null = null;
  exportingPdf = false;

  private reservasChart?: Chart;
  private tiposChart?: Chart;

  constructor(
    private gastronomiaService: GastronomiaService,
    private pdfExportService: PdfExportService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.reservasChart?.destroy();
    this.tiposChart?.destroy();
  }

  loadDashboardData(): void {
    this.loading = true;

    forkJoin({
      establecimientos: this.gastronomiaService.listAll(),
      analytics: this.gastronomiaService.getAdminAnalytics(true)
    }).pipe(first()).subscribe({
      next: ({ establecimientos, analytics }) => {
        this.analytics = analytics;
        this.establecimientos = establecimientos;
        this.calculateStats();
        this.loading = false;
        setTimeout(() => this.renderCharts(), 0);
      },
      error: () => {
        this.error = 'No se pudo cargar la analítica de gastronomía';
        this.loading = false;
      }
    });
  }

  calculateStats(): void {
    this.stats.totalEstablecimientos = this.analytics?.totalEstablecimientos || this.establecimientos.length;
    this.stats.totalReservas = this.analytics?.totalReservas || 0;
    this.stats.totalResenas = this.analytics?.totalResenas || 0;
    this.stats.promedioCalificacion = this.analytics?.promedioCalificacion || 0;
    this.stats.solicitudesPendientes = this.analytics?.solicitudesPendientes || 0;
    this.stats.reportesPendientes = this.analytics?.reportesPendientes || 0;
  }

  get recentEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.slice(0, 5);
  }

  get topEstablecimientos() {
    return this.analytics?.topEstablecimientos || [];
  }

  exportarPdf(): void {
    if (!this.analytics || this.exportingPdf) {
      return;
    }

    this.exportingPdf = true;
    this.pdfExportService.exportReport({
      fileName: 'dashboard-admin-gastronomia.pdf',
      title: 'Dashboard admin de gastronomía',
      subtitle: 'Reporte consolidado del módulo gastronómico',
      summary: [
        { label: 'Establecimientos', value: String(this.stats.totalEstablecimientos) },
        { label: 'Reservas', value: String(this.stats.totalReservas) },
        { label: 'Reseñas', value: String(this.stats.totalResenas) },
        { label: 'Calificación promedio', value: this.stats.promedioCalificacion.toFixed(2) },
        { label: 'Solicitudes pendientes', value: String(this.stats.solicitudesPendientes) },
        { label: 'Reportes pendientes', value: String(this.stats.reportesPendientes) }
      ],
      charts: [
        { title: 'Reservas por mes', canvas: this.reservasChartRef?.nativeElement },
        { title: 'Establecimientos por tipo', canvas: this.tiposChartRef?.nativeElement }
      ],
      sections: [
        {
          title: 'Top establecimientos',
          lines: this.topEstablecimientos.map((item, index) => `${index + 1}. ${item.nombre} | ${item.totalReservas} reservas | ${item.promedio.toFixed(1)} estrellas`)
        },
        {
          title: 'Métricas de neurona',
          lines: [
            `Evaluados: ${this.analytics.neurona.totalEvaluados}`,
            `Clasificación ML: ${this.analytics.neurona.clasificacionesMl}`,
            `Fallback local: ${this.analytics.neurona.clasificacionesFallback}`,
            `Clase alta/media/baja: ${this.analytics.neurona.claseAlta}/${this.analytics.neurona.claseMedia}/${this.analytics.neurona.claseBaja}`,
            `Confianza promedio: ${this.analytics.neurona.confianzaPromedio.toFixed(2)}`
          ]
        }
      ]
    });

    this.exportingPdf = false;
  }

  private renderCharts(): void {
    if (!this.analytics || !this.reservasChartRef?.nativeElement || !this.tiposChartRef?.nativeElement) {
      return;
    }

    this.reservasChart?.destroy();
    this.tiposChart?.destroy();

    this.reservasChart = new Chart(this.reservasChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: (this.analytics.reservasPorMes || []).map((item) => item.etiqueta),
        datasets: [{
          label: 'Reservas',
          data: (this.analytics.reservasPorMes || []).map((item) => item.valor),
          borderColor: '#E31B23',
          backgroundColor: 'rgba(227, 27, 35, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    this.tiposChart = new Chart(this.tiposChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: (this.analytics.establecimientosPorTipo || []).map((item) => item.etiqueta),
        datasets: [{
          data: (this.analytics.establecimientosPorTipo || []).map((item) => item.valor),
          backgroundColor: ['#E31B23', '#F59E0B', '#0EA5E9', '#16A34A', '#6B7280', '#8B5CF6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}
