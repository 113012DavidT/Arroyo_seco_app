import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { first } from 'rxjs/operators';
import { GastronomiaService, EstablecimientoDto } from '../../services/gastronomia.service';
import { ReservasGastronomiaService } from '../../services/reservas-gastronomia.service';

@Component({
  selector: 'app-oferente-dashboard-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './oferente-dashboard-gastronomia.component.html',
  styleUrl: './oferente-dashboard-gastronomia.component.scss'
})
export class OferenteDashboardGastronomiaComponent implements OnInit {
  establecimientos: EstablecimientoDto[] = [];
  totalReservas = 0;
  reservasPendientes = 0;
  loading = false;

  constructor(
    private gastronomiaService: GastronomiaService,
    private reservasService: ReservasGastronomiaService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData() {
    this.loading = true;

    forkJoin({
      establecimientos: this.gastronomiaService.listMine(),
      reservas: this.reservasService.activas()
    }).pipe(first()).subscribe({
      next: ({ establecimientos, reservas }) => {
        this.establecimientos = establecimientos || [];
        this.totalReservas = reservas?.length || 0;
        this.reservasPendientes = reservas?.filter((r: any) => r.estado === 'Pendiente').length || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar dashboard:', err);
        this.establecimientos = [];
        this.loading = false;
      }
    });
  }
}
