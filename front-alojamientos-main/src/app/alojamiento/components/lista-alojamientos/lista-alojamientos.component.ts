import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FavoritesService, FavoriteAlojamiento } from '../../../shared/services/favorites.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AlojamientoService, AlojamientoDto } from '../../services/alojamiento.service';
import { AuthService } from '../../../core/services/auth.service';
import { first } from 'rxjs/operators';

interface Alojamiento {
  id: number;
  nombre: string;
  ubicacion: string;
  precioNoche: number;
  rating: number;
  imagen: string;
}

@Component({
  selector: 'app-lista-alojamientos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-alojamientos.component.html',
  styleUrl: './lista-alojamientos.component.scss'
})
export class ListaAlojamientosComponent implements OnInit {
  search = '';
  sortMode: 'precio' | 'rating' | 'nombre' = 'precio';
  alojamientos: Alojamiento[] = [];
  loading = false;
  error: string | null = null;
  isPublic = false;

  constructor(private favs: FavoritesService,
              private toast: ToastService,
              private alojamientosService: AlojamientoService,
              private auth: AuthService,
              private router: Router,
              private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Detectar si estamos en ruta pública
    this.isPublic = this.router.url.includes('/publica/');
    this.fetchAlojamientos();
  }

  private fetchAlojamientos() {
    this.loading = true;
    this.error = null;
    this.alojamientosService.listAll().pipe(first()).subscribe({
      next: (data: AlojamientoDto[]) => {
        this.alojamientos = (data || []).map(d => ({
          id: d.id!,
            nombre: d.nombre,
            ubicacion: d.ubicacion,
            precioNoche: d.precioPorNoche,
            rating: 0, // Backend aún no provee rating
            imagen: d.fotoPrincipal || 'assets/images/hero-oferentes.svg'
        }));
        this.loading = false;
      },
      error: () => {
        this.alojamientos = [];
        this.error = 'No se pudieron cargar los alojamientos reales';
        this.loading = false;
      }
    });
  }

  get filtered(): Alojamiento[] {
    if (this.loading || this.error) return this.alojamientos; // evitar operaciones si hay estado especial
    let result = this.alojamientos.filter(a =>
      a.nombre.toLowerCase().includes(this.search.toLowerCase()) ||
      a.ubicacion.toLowerCase().includes(this.search.toLowerCase())
    );
    switch (this.sortMode) {
      case 'precio':
        result = [...result].sort((a, b) => a.precioNoche - b.precioNoche);
        break;
      case 'rating':
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case 'nombre':
        result = [...result].sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
    }
    return result;
  }

  isFavorite(id: number): boolean {
    return this.favs.isFavorite(id);
  }

  toggleFavorite(a: Alojamiento, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    const wasFav = this.isFavorite(a.id);
    this.favs.toggle(a as FavoriteAlojamiento);
    this.toast.info(!wasFav ? 'Añadido a favoritos' : 'Eliminado de favoritos');
  }

  navigateToDetail(id: number) {
    if (this.isPublic && !this.auth.isAuthenticated()) {
      this.toast.error('Debes iniciar sesión para ver detalles');
      this.router.navigate(['/login']);
      return;
    }
    
    const route = this.isPublic ? '/publica/alojamientos' : '/cliente/alojamientos';
    this.router.navigate([route, id]);
  }

  retry() {
    this.fetchAlojamientos();
  }
}
