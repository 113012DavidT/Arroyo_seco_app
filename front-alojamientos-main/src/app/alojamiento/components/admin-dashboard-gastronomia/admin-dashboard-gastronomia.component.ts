import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GastronomiaService, EstablecimientoDto } from '../../../gastronomia/services/gastronomia.service';
import { AdminOferentesService } from '../../services/admin-oferentes.service';

interface DashboardStats {
  totalEstablecimientos: number;
  pendientesAprobacion: number;
  reservasActivas: number;
  reservasHoy: number;
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
    reservasActivas: 0,
    reservasHoy: 0,
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
    
    // Cargar establecimientos
    this.gastronomiaService.listAll().subscribe({
      next: (data: EstablecimientoDto[]) => {
        this.establecimientos = data;
        this.calculateStats();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading dashboard:', error);
        this.loading = false;
      }
    });

    // Cargar solicitudes pendientes
    this.adminService.listSolicitudes().subscribe({
      next: (solicitudes: any[]) => {
        const gastronomiaSolicitudes = solicitudes.filter(
          s => s.tipoSolicitado === 2 || s.tipoNegocio === 2
        );
        this.stats.solicitudesPendientes = gastronomiaSolicitudes.length;
      },
      error: (error: any) => {
        console.error('Error loading solicitudes:', error);
      }
    });
  }

  calculateStats(): void {
    this.stats.totalEstablecimientos = this.establecimientos.length;
    this.stats.pendientesAprobacion = this.establecimientos.filter(
      e => e.estado === 'Pendiente'
    ).length;

    // TODO: Cargar reservas desde el servicio cuando esté disponible
    this.stats.reservasActivas = 0;
    this.stats.reservasHoy = 0;
  }

  get recentEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.slice(0, 5);
  }

  get pendingEstablecimientos(): EstablecimientoDto[] {
    return this.establecimientos.filter(e => e.estado === 'Pendiente').slice(0, 5);
  }
}
