import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/services/toast.service';
import { GastronomiaService, EstablecimientoDto, RankingGastronomiaDto } from '../../services/gastronomia.service';
import { AuthService } from '../../../core/services/auth.service';
import { first } from 'rxjs/operators';
import { catchError, forkJoin, map, of, from, mergeMap } from 'rxjs';

interface Establecimiento {
  id: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  imagen: string;
  ratingPromedio: number;
  totalReviews: number;
}

@Component({
  selector: 'app-lista-gastronomia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-gastronomia.component.html',
  styleUrl: './lista-gastronomia.component.scss'
})
export class ListaGastronomiaComponent implements OnInit {
  search = '';
  sortMode: 'nombre' | 'ubicacion' = 'nombre';
  rankingMode = false;
  establecimientos: Establecimiento[] = [];
  loading = false;
  error: string | null = null;
  isPublic = false;

  constructor(
    private toast: ToastService,
    private gastronomiaService: GastronomiaService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Detectar si estamos en ruta pública
    this.isPublic = this.router.url.includes('/publica/');
    this.fetchEstablecimientos();
  }

  private fetchEstablecimientos() {
    this.loading = true;
    this.error = null;

    // 1. Carga la lista base inmediatamente → el usuario ve las tarjetas rápido
    this.gastronomiaService.listAll().pipe(first()).subscribe({
      next: (data: EstablecimientoDto[]) => {
        this.establecimientos = (data || []).map(d => ({
          id: d.id!,
          nombre: d.nombre,
          ubicacion: d.ubicacion,
          descripcion: d.descripcion,
          imagen: d.fotoPrincipal || 'assets/images/hero-oferentes.svg',
          ratingPromedio: 0,
          totalReviews: 0
        }));
        this.loading = false; // Mostrar contenido YA, sin esperar ratings

        // 2. Enriquecer con ranking en background (no bloquea el render)
        this.loadRankingAsync();
      },
      error: () => {
        this.establecimientos = [];
        this.error = 'No se pudieron cargar los restaurantes';
        this.loading = false;
      }
    });
  }

  private loadRankingAsync() {
    this.gastronomiaService.getRankingBackground().pipe(first()).subscribe({
      next: (ranking: RankingGastronomiaDto[]) => {
        if (!(ranking || []).length) return;
        this.rankingMode = true;
        const rankMap = new Map(ranking.map(r => [r.id!, r]));
        this.establecimientos = this.establecimientos.map(e => {
          const r = rankMap.get(e.id);
          return r
            ? { ...e, ratingPromedio: Number(r.promedio || 0), totalReviews: Number(r.totalResenas || 0) }
            : e;
        });
        // Reordenar según el ranking recibido
        const order = ranking.map(r => r.id!);
        this.establecimientos.sort(
          (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
        );
      },
      error: () => {
        // Si ranking falla, cargar reseñas individuales como fallback
        if (this.establecimientos.length) this.loadRatingsResumen();
      }
    });
  }

  private loadRatingsResumen() {
    if (!this.establecimientos.length) {
      this.loading = false;
      return;
    }

    // Cargar ratings en paralelo (máximo 3 simultáneas) para velocidad sin sobrecargar
    const mapa = new Map<number, { ratingPromedio: number; totalReviews: number }>();
    
    from(this.establecimientos)
      .pipe(
        mergeMap(
          (e) =>
            this.gastronomiaService.getReviewsBackground(e.id).pipe(
              map((reviews) => {
                const total = (reviews || []).length;
                const suma = (reviews || []).reduce((acc, r) => acc + (Number(r.puntuacion) || 0), 0);
                return {
                  id: e.id,
                  ratingPromedio: total ? suma / total : 0,
                  totalReviews: total
                };
              }),
              catchError(() => of({ id: e.id, ratingPromedio: 0, totalReviews: 0 }))
            ),
          3 // Máximo 3 solicitudes simultáneas
        )
      )
      .subscribe({
        next: (result) => {
          mapa.set(result.id, { ratingPromedio: result.ratingPromedio, totalReviews: result.totalReviews });
          // Actualizar en vivo a medida que llegan resultados
          this.establecimientos = this.establecimientos.map((e) => {
            const review = mapa.get(e.id);
            return review ? { ...e, ratingPromedio: review.ratingPromedio, totalReviews: review.totalReviews } : e;
          });
        },
        error: () => {
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  get filtered(): Establecimiento[] {
    if (this.loading || this.error) return this.establecimientos;
    let result = this.establecimientos.filter(e =>
      e.nombre.toLowerCase().includes(this.search.toLowerCase()) ||
      e.ubicacion.toLowerCase().includes(this.search.toLowerCase())
    );

    if (this.rankingMode) {
      // Importante: conservar el orden entregado por /ranking
      return result;
    }

    switch (this.sortMode) {
      case 'nombre':
        result = [...result].sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'ubicacion':
        result = [...result].sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
        break;
    }
    return result;
  }

  navigateToDetail(id: number) {
    if (this.isPublic && !this.auth.isAuthenticated()) {
      this.toast.error('Debes iniciar sesión para ver detalles');
      this.router.navigate(['/login']);
      return;
    }
    
    const route = this.isPublic ? '/publica/gastronomia' : '/cliente/gastronomia';
    this.router.navigate([route, id]);
  }

  retry() {
    this.fetchEstablecimientos();
  }
}
