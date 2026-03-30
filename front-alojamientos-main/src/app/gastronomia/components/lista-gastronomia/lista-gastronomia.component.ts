import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/services/toast.service';
import { GastronomiaService, EstablecimientoDto, RankingGastronomiaDto } from '../../services/gastronomia.service';
import { AuthService } from '../../../core/services/auth.service';
import { OfflineCacheService } from '../../../core/services/offline-cache.service';
import { first } from 'rxjs/operators';
import { catchError, map, of, from, mergeMap } from 'rxjs';

interface Establecimiento {
  id: number;
  nombre: string;
  ubicacion: string;
  tipoEstablecimiento: string;
  amenidades: string[];
  descripcion: string;
  imagen: string;
  latitud: number | null;
  longitud: number | null;
  distanciaKm: number | null;
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
  sortMode: 'nombre' | 'ubicacion' | 'cercania' = 'cercania';
  selectedTipo = 'todos';
  rankingMode = false;
  establecimientos: Establecimiento[] = [];
  loading = false;
  error: string | null = null;
  isPublic = false;
  locationStatus = 'Detectando tu ubicacion...';
  hasOfflineFallback = false;
  private userCoords: { lat: number; lng: number } | null = null;
  private readonly listCacheKey = 'gastronomia:list';
  readonly tiposDisponibles = [
    { key: 'todos', label: 'Todos' },
    { key: 'restaurante', label: 'Restaurantes' },
    { key: 'bar', label: 'Bar' },
    { key: 'antro', label: 'Antro' },
    { key: 'cafe', label: 'Cafe' },
    { key: 'desayunos', label: 'Desayunos' },
    { key: 'comida-corrida', label: 'Comida corrida' },
    { key: 'cena', label: 'Cena' },
    { key: 'antojitos', label: 'Antojitos' }
  ];

  private readonly amenidadLabels: Record<string, string> = {
    'wifi': 'WiFi',
    'terraza': 'Terraza',
    'estacionamiento': 'Estacionamiento',
    'pet-friendly': 'Pet friendly',
    'reservas': 'Acepta reservas',
    'musica-en-vivo': 'Musica en vivo',
    'accesible': 'Acceso para silla de ruedas',
    'entrega-a-domicilio': 'Entrega a domicilio',
    'para-llevar': 'Para llevar',
    'tarjeta': 'Pago con tarjeta'
  };

  constructor(
    private toast: ToastService,
    private gastronomiaService: GastronomiaService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private offlineCache: OfflineCacheService
  ) {}

  ngOnInit(): void {
    // Detectar si estamos en ruta pública
    this.isPublic = this.router.url.includes('/publica/');

    const tipo = this.route.snapshot.queryParamMap.get('tipo');
    if (tipo) {
      this.selectedTipo = tipo;
    }

    this.detectUserLocation();
    this.fetchEstablecimientos();
  }

  private detectUserLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationStatus = 'Tu navegador no permite geolocalizacion';
      this.sortMode = 'nombre';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.locationStatus = 'Mostrando restaurantes mas cercanos a tu ubicacion';
        this.recalculateDistances();
      },
      () => {
        this.locationStatus = 'No pudimos acceder a tu ubicacion. Ordenamos por nombre';
        this.sortMode = 'nombre';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private fetchEstablecimientos() {
    this.loading = true;
    this.error = null;
    this.hasOfflineFallback = false;

    // 1. Carga la lista base inmediatamente → el usuario ve las tarjetas rápido
    this.gastronomiaService.listAll().pipe(first()).subscribe({
      next: (data: EstablecimientoDto[]) => {
        this.establecimientos = (data || []).map(d => ({
          id: d.id!,
          nombre: d.nombre,
          ubicacion: d.ubicacion,
          tipoEstablecimiento: d.tipoEstablecimiento || 'restaurante',
          amenidades: d.amenidades || [],
          descripcion: d.descripcion,
          imagen: d.fotoPrincipal || 'assets/images/hero-oferentes.svg',
          latitud: d.latitud ?? null,
          longitud: d.longitud ?? null,
          distanciaKm: null,
          ratingPromedio: 0,
          totalReviews: 0
        }));
        this.offlineCache.set<EstablecimientoDto[]>(this.listCacheKey, data || [], 1000 * 60 * 60 * 24 * 7);
        this.recalculateDistances();
        this.loading = false; // Mostrar contenido YA, sin esperar ratings

        // 2. Enriquecer con ranking en background (no bloquea el render)
        this.loadRankingAsync();
      },
      error: () => {
        const cached = this.offlineCache.get<EstablecimientoDto[]>(this.listCacheKey) || [];
        if (cached.length > 0) {
          this.establecimientos = cached.map(d => ({
            id: d.id!,
            nombre: d.nombre,
            ubicacion: d.ubicacion,
            tipoEstablecimiento: d.tipoEstablecimiento || 'restaurante',
            amenidades: d.amenidades || [],
            descripcion: d.descripcion,
            imagen: d.fotoPrincipal || 'assets/images/hero-oferentes.svg',
            latitud: d.latitud ?? null,
            longitud: d.longitud ?? null,
            distanciaKm: null,
            ratingPromedio: 0,
            totalReviews: 0
          }));
          this.hasOfflineFallback = true;
          this.locationStatus = 'Mostrando restaurantes guardados localmente';
          this.recalculateDistances();
        } else {
          this.establecimientos = [];
          this.error = 'No se pudieron cargar los restaurantes';
        }
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
      e.ubicacion.toLowerCase().includes(this.search.toLowerCase()) ||
      (e.tipoEstablecimiento || '').toLowerCase().includes(this.search.toLowerCase())
    );

    if (this.selectedTipo !== 'todos') {
      result = result.filter((e) => e.tipoEstablecimiento === this.selectedTipo);
    }

    if (this.sortMode === 'cercania') {
      return [...result].sort((a, b) => {
        const d1 = a.distanciaKm ?? Number.MAX_SAFE_INTEGER;
        const d2 = b.distanciaKm ?? Number.MAX_SAFE_INTEGER;
        return d1 - d2;
      });
    }

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

  formatDistance(km: number | null): string {
    if (km == null || !Number.isFinite(km)) return 'Sin distancia';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  getTipoLabel(tipo: string): string {
    const found = this.tiposDisponibles.find((item) => item.key === tipo);
    return found?.label || 'Restaurante';
  }

  getAmenidadLabel(value: string): string {
    return this.amenidadLabels[value] || value;
  }

  private recalculateDistances() {
    if (!this.userCoords) {
      this.establecimientos = this.establecimientos.map((e) => ({ ...e, distanciaKm: null }));
      return;
    }

    this.establecimientos = this.establecimientos.map((e) => ({
      ...e,
      distanciaKm: this.distanceBetween(this.userCoords!.lat, this.userCoords!.lng, e.latitud, e.longitud)
    }));
  }

  private distanceBetween(lat1: number, lng1: number, lat2: number | null, lng2: number | null): number | null {
    if (lat2 == null || lng2 == null) return null;
    const rad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }
}
