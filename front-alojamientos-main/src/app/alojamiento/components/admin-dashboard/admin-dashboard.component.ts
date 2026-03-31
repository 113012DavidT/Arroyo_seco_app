import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { first } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { AdminAnalyticsService, AdminAnalyticsDto, TopEstablecimientoReservasDto } from '../../services/admin-analytics.service';

interface DashboardCard {
  title: string;
  description: string;
  icon: string;
  route: string;
}

interface StatCard {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sexoChart') sexoChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('cpChart') cpChartRef?: ElementRef<HTMLCanvasElement>;

  stats: StatCard[] = [];
  topEstablecimientos: TopEstablecimientoReservasDto[] = [];
  loading = true;
  error: string | null = null;

  private sexoChart?: Chart;
  private cpChart?: Chart;

  readonly cards: DashboardCard[] = [
    {
      title: 'Gestión de Oferentes',
      description: 'Administra la información de los oferentes registrados.',
      icon: 'person',
      route: '/admin/oferentes'
    },
    {
      title: 'Notificaciones',
      description: 'Consulta y gestiona los avisos enviados a los oferentes.',
      icon: 'notifications',
      route: '/admin/notificaciones'
    },
    {
      title: 'Solicitudes',
      description: 'Revisa las solicitudes de nuevos oferentes.',
      icon: 'solicitudes',
      route: '/admin/solicitudes'
    },
    {
      title: 'Usuarios',
      description: 'Administra cuentas, bloqueos y nuevos administradores.',
      icon: 'person',
      route: '/admin/usuarios'
    },
    {
      title: 'Gastronomía',
      description: 'Gestiona establecimientos gastronómicos de la zona.',
      icon: 'food',
      route: '/admin/gastronomia'
    }
  ];

  constructor(private analyticsService: AdminAnalyticsService) {
    Chart.register(...registerables);
    this.loadAnalytics();
  }

  ngAfterViewInit(): void {
    this.tryRenderCharts();
  }

  ngOnDestroy(): void {
    this.sexoChart?.destroy();
    this.cpChart?.destroy();
  }

  private loadAnalytics(): void {
    this.loading = true;
    this.analyticsService.getAnalytics().pipe(first()).subscribe({
      next: (data: AdminAnalyticsDto) => {
        this.stats = [
          { label: 'Usuarios registrados', value: String(data.totalUsuarios), icon: 'person' },
          { label: 'Oferentes activos', value: String(data.totalOferentes), icon: 'store' },
          { label: 'Solicitudes pendientes', value: String(data.solicitudesPendientes), icon: 'pending' },
          { label: 'Reportes de reseñas', value: String(data.reportesResenasPendientes), icon: 'notifications' }
        ];
        this.topEstablecimientos = data.topEstablecimientosPorReservas || [];
        this.loading = false;
        setTimeout(() => this.renderCharts(data), 0);
      },
      error: () => {
        this.error = 'No se pudo cargar la analítica del panel';
        this.loading = false;
      }
    });
  }

  private tryRenderCharts(): void {
    // Render happens once data and canvas are both ready.
  }

  private renderCharts(data: AdminAnalyticsDto): void {
    if (!this.sexoChartRef?.nativeElement || !this.cpChartRef?.nativeElement) return;

    this.sexoChart?.destroy();
    this.cpChart?.destroy();

    const sexoLabels = (data.usuariosPorSexo || []).map((x) => x.etiqueta);
    const sexoValues = (data.usuariosPorSexo || []).map((x) => x.valor);

    this.sexoChart = new Chart(this.sexoChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: sexoLabels,
        datasets: [{
          data: sexoValues,
          backgroundColor: ['#E31B23', '#0EA5E9', '#22C55E', '#F59E0B', '#64748B']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    const cpLabels = (data.usuariosPorCodigoPostal || []).map((x) => x.etiqueta);
    const cpValues = (data.usuariosPorCodigoPostal || []).map((x) => x.valor);

    this.cpChart = new Chart(this.cpChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: cpLabels,
        datasets: [{
          label: 'Usuarios',
          data: cpValues,
          backgroundColor: '#E31B23'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }
}
