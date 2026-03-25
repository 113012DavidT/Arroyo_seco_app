import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GastronomiaService, EstablecimientoDto } from '../../services/gastronomia.service';
import { ReservasGastronomiaService } from '../../services/reservas-gastronomia.service';
import { first } from 'rxjs/operators';

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
    
    // Cargar establecimientos del oferente
    this.gastronomiaService.listMine().pipe(first()).subscribe({
      next: (data) => {
        this.establecimientos = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar establecimientos:', err);
        this.establecimientos = [];
        this.loading = false;
      }
    });

    // Cargar estadísticas de reservas
    this.reservasService.activas().pipe(first()).subscribe({
      next: (data) => {
        this.totalReservas = data?.length || 0;
        this.reservasPendientes = data?.filter(r => r.estado === 'Pendiente').length || 0;
      },
      error: () => {}
    });
  }
}
