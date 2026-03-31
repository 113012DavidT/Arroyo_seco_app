import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { GastronomiaService, EstablecimientoDto } from '../../../gastronomia/services/gastronomia.service';
import { AdminOferentesService } from '../../services/admin-oferentes.service';

interface DashboardStats {
  totalEstablecimientos: number;
  pendientesAprobacion: number;
  solicitudesPendientes: number;
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
    pendientesAprobacion: 0,
    solicitudesPendientes: 0
  };

  establecimientos: EstablecimientoDto[] = [];
  loading = true;

  constructor(
    private gastronomiaService: GastronomiaService,
    private adminService: AdminOferentesService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;

    forkJoin({
      establecimientos: this.gastronomiaService.listAll(),
      solicitudes: this.adminService.listSolicitudes()
    }).pipe(first()).subscribe({
      next: ({ establecimientos, solicitudes }) => {
        this.establecimientos = establecimientos;
        const gastronomiaSolicitudes = (solicitudes || []).filter(
          (s: any) => s.tipoSolicitado === 2 || s.tipoNegocio === 2
        );
        this.stats.solicitudesPendientes = gastronomiaSolicitudes.length;
        this.calculateStats();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading dashboard:', error);
        this.loading = false;
      }
    });
  }

  calculateStats(): void {
    this.stats.totalEstablecimientos = this.establecimientos.length;
    this.stats.pendientesAprobacion = this.establecimientos.filter(
      e => e.estado === 'Pendiente'
    ).length;
  }

  get recentEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.slice(0, 5);
  }

  get pendingEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.filter(e => e.estado === 'Pendiente').slice(0, 5);
  }
}
