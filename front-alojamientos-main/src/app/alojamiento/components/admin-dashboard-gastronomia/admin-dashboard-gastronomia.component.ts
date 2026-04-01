import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { GastronomiaService, EstablecimientoDto } from '../../../gastronomia/services/gastronomia.service';
import { AdminOferentesService } from '../../services/admin-oferentes.service';

interface DashboardStats {
  totalEstablecimientos: number;
  solicitudesPendientes: number;
  activos: number;
}

@Component({
  selector: 'app-admin-dashboard-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard-gastronomia.component.html',
  styleUrl: './admin-dashboard-gastronomia.component.scss'
})
export class AdminDashboardGastronomiaComponent implements OnInit {
  stats: DashboardStats = {
    totalEstablecimientos: 0,
    solicitudesPendientes: 0,
    activos: 0
  };

  establecimientos: EstablecimientoDto[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private gastronomiaService: GastronomiaService,
    private adminService: AdminOferentesService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      establecimientos: this.gastronomiaService.listAll(),
      solicitudes: this.adminService.listSolicitudes()
    }).pipe(first()).subscribe({
      next: ({ establecimientos, solicitudes }) => {
        this.establecimientos = establecimientos;
        this.calculateStats(solicitudes || []);
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el dashboard de gastronomía';
        this.loading = false;
      }
    });
  }

  calculateStats(solicitudes: any[]): void {
    this.stats.totalEstablecimientos = this.establecimientos.length;
    this.stats.solicitudesPendientes = (solicitudes || []).filter(
      (s: any) => s?.tipoSolicitado === 2 || s?.tipoNegocio === 2
    ).length;
    this.stats.activos = this.establecimientos.length;
  }

  get recentEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.slice(0, 5);
  }

  get pendingEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.filter((e) => (e as any).estado === 'Pendiente').slice(0, 5);
  }
}
