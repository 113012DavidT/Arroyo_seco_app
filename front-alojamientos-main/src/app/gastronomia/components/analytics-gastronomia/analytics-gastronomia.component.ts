import { CommonModule } from '@angular/common';
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { GastronomiaAnalyticsDto, GastronomiaService } from '../../services/gastronomia.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics-gastronomia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-gastronomia.component.html',
  styleUrl: './analytics-gastronomia.component.scss'
})
export class AnalyticsGastronomiaComponent implements OnInit {
  loading = true;
  error: string | null = null;
  data: GastronomiaAnalyticsDto | null = null;

  @ViewChild('starsCanvas') starsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;

  private starsChart?: Chart;
  private trendChart?: Chart;

  constructor(private gastronomiaService: GastronomiaService) {}

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
}
