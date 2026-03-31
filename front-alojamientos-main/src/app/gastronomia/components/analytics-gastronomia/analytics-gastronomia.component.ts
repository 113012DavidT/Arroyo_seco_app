import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { GastronomiaAnalyticsDto, GastronomiaService, ReviewOferenteDto } from '../../services/gastronomia.service';
import { Chart, registerables } from 'chart.js';
import { ToastService } from '../../../shared/services/toast.service';

Chart.register(...registerables);

type ModerationAction = 'report' | 'delete';

@Component({
  selector: 'app-analytics-gastronomia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics-gastronomia.component.html',
  styleUrl: './analytics-gastronomia.component.scss'
})
export class AnalyticsGastronomiaComponent implements OnInit {
  loading = true;
  error: string | null = null;
  data: GastronomiaAnalyticsDto | null = null;
  reviewsLoading = true;
  misReviews: ReviewOferenteDto[] = [];
  reportingReviewId: number | null = null;

  // Modal para reporte
  showReportModal = false;
  selectedReview: ReviewOferenteDto | null = null;
  reportMotivo = '';
  moderationAction: ModerationAction = 'report';

  @ViewChild('starsCanvas') starsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;

  private starsChart?: Chart;
  private trendChart?: Chart;

  constructor(
    private gastronomiaService: GastronomiaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.gastronomiaService.getAnalytics().pipe(first()).subscribe({
      next: (res) => {
        this.data = (res && typeof res === 'object') ? res as GastronomiaAnalyticsDto : {
          totalResenas: 0, promedio: 0,
          distribucionEstrellas: [], top5: [], bottom5: [], tendenciaMensual: []
        };
        this.loading = false;
        setTimeout(() => this.buildCharts(), 0);
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar la analitica';
        this.loading = false;
      }
    });

    this.gastronomiaService.getMisReviews().pipe(first()).subscribe({
      next: (reviews) => {
        this.misReviews = (reviews || []).slice(0, 30);
        this.reviewsLoading = false;
      },
      error: () => {
        this.reviewsLoading = false;
      }
    });
  }

  private buildCharts(): void {
    if (!this.data) return;
    this.buildStarsChart();
    this.buildTrendChart();
  }

  private buildStarsChart(): void {
    if (!this.starsCanvas?.nativeElement) return;
    const dist = this.data!.distribucionEstrellas || [];
    if (this.starsChart) this.starsChart.destroy();
    this.starsChart = new Chart(this.starsCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.etiqueta),
        datasets: [{
          label: 'Reseñas',
          data: dist.map(d => d.valor),
          backgroundColor: ['#f87171','#fb923c','#facc15','#4ade80','#34d399'],
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  private buildTrendChart(): void {
    if (!this.trendCanvas?.nativeElement) return;
    const trend = this.data!.tendenciaMensual || [];
    if (this.trendChart) this.trendChart.destroy();
    this.trendChart = new Chart(this.trendCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: trend.map(t => t.etiqueta),
        datasets: [{
          label: 'Reseñas por mes',
          data: trend.map(t => t.valor),
          borderColor: '#e53e3e',
          backgroundColor: 'rgba(229,62,62,0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#e53e3e',
          pointRadius: 5,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  trackByLabel(_: number, item: { etiqueta: string }) {
    return item?.etiqueta;
  }

  puedeReportar(review: ReviewOferenteDto): boolean {
    return !['Reportada', 'EliminacionSolicitada', 'Rechazada'].includes(review.estado);
  }

  puedeSolicitarEliminacion(review: ReviewOferenteDto): boolean {
    return !['EliminacionSolicitada', 'Rechazada'].includes(review.estado);
  }

  reportar(review: ReviewOferenteDto): void {
    if (!review?.id || !this.puedeReportar(review) || this.reportingReviewId === review.id) {
      return;
    }

    this.openModerationModal(review, 'report');
  }

  solicitarEliminacion(review: ReviewOferenteDto): void {
    if (!review?.id || !this.puedeSolicitarEliminacion(review) || this.reportingReviewId === review.id) {
      return;
    }

    this.openModerationModal(review, 'delete');
  }

  private openModerationModal(review: ReviewOferenteDto, action: ModerationAction): void {
    this.moderationAction = action;
    this.selectedReview = review;
    this.reportMotivo = '';
    this.showReportModal = true;
  }

  closeReportModal(): void {
    this.showReportModal = false;
    this.selectedReview = null;
    this.reportMotivo = '';
    this.moderationAction = 'report';
  }

  get modalTitle(): string {
    return this.moderationAction === 'delete' ? 'Solicitar eliminación de reseña' : 'Reportar reseña';
  }

  get modalDescription(): string {
    if (this.moderationAction === 'delete') {
      return 'Indícanos por qué deseas solicitar la eliminación de esta reseña. Un administrador deberá aprobar la solicitud.';
    }

    return 'Indícanos por qué deseas reportar esta reseña. El administrador revisará la denuncia.';
  }

  get modalPlaceholder(): string {
    return this.moderationAction === 'delete'
      ? 'Motivo de la solicitud de eliminación (lenguaje ofensivo, contenido falso, etc.)'
      : 'Motivo del reporte (grosería, spam, contenido inapropiado, etc.)';
  }

  get submitLabel(): string {
    return this.moderationAction === 'delete' ? 'Solicitar eliminación' : 'Reportar';
  }

  submitReport(): void {
    if (!this.selectedReview || !this.reportMotivo.trim()) {
      this.toast.info('Debes indicar el motivo del reporte');
      return;
    }

    this.reportingReviewId = this.selectedReview.id;
    const motivo = this.reportMotivo.trim();
    
    const request$ = this.moderationAction === 'delete'
      ? this.gastronomiaService.solicitarEliminacionReview(this.selectedReview.id, { motivo })
      : this.gastronomiaService.reportarReview(this.selectedReview.id, { motivo });

    request$.pipe(first()).subscribe({
      next: () => {
        const nuevoEstado = this.moderationAction === 'delete' ? 'EliminacionSolicitada' : 'Reportada';
        this.misReviews = this.misReviews.map((item) =>
          item.id === this.selectedReview!.id ? { ...item, estado: nuevoEstado, motivoRechazo: motivo } : item
        );
        this.toast.success(
          this.moderationAction === 'delete'
            ? 'Solicitud enviada. El administrador decidirá si la reseña se elimina.'
            : 'Reseña reportada. El administrador la revisará.'
        );
        this.reportingReviewId = null;
        this.closeReportModal();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudo reportar la reseña');
        this.reportingReviewId = null;
      }
    });
  }
}
