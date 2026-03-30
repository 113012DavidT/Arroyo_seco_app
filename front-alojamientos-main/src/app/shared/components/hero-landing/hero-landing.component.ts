import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GastronomiaService, EstablecimientoDto } from '../../../gastronomia/services/gastronomia.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-hero-landing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hero-landing.component.html',
  styleUrl: './hero-landing.component.scss'
})
export class HeroLandingComponent implements OnInit {
  scrollOffset = 0;
  searchQuery = '';
  checkIn = '';
  checkOut = '';
  guests = 1;
  isGastronomiaLanding = false;
  selectedGastroTipo = 'todos';

  readonly categories = [
    { svg: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', label: 'Cabañas' },
    { svg: 'M7 14.5h10v-1H7v1zM7 11h10v-1H7v1zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z', label: 'Hoteles' },
    { svg: 'M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2zm0 2.84L18.16 11H17v8h-2v-6H9v6H7v-8H5.84L12 4.84z', label: 'Camping' },
    { svg: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', label: 'Restaurantes' },
    { svg: 'M21 18H3v2h18v-2zM17.12 5.56A3.07 3.07 0 0 0 12 2.68 3.07 3.07 0 0 0 6.88 5.56L3 16h18l-3.88-10.44z', label: 'Río' },
    { svg: 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z', label: 'Montaña' }
  ];

  readonly featuredAlojamientos = [
    {
      id: 1,
      nombre: 'Cabaña El Encino',
      ubicacion: 'Arroyo Seco Centro',
      precio: 1200,
      rating: 4.8,
      imagen: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&h=400&fit=crop',
      badge: 'Popular'
    },
    {
      id: 2,
      nombre: 'Hotel Río Escondido',
      ubicacion: 'Camino al Río Escanela',
      precio: 1850,
      rating: 4.9,
      imagen: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
      badge: 'Mejor valorado'
    },
    {
      id: 3,
      nombre: 'Glamping Las Cascadas',
      ubicacion: 'Zona de Cascadas',
      precio: 2200,
      rating: 5.0,
      imagen: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=400&fit=crop',
      badge: 'Nuevo'
    },
    {
      id: 4,
      nombre: 'Casa Rural El Mirador',
      ubicacion: 'Mirador de Arroyo Seco',
      precio: 1500,
      rating: 4.7,
      imagen: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
      badge: ''
    }
  ];

  featuredRestaurantes: Array<{
    id: number;
    nombre: string;
    ubicacion: string;
    descripcion: string;
    imagen: string;
    badge: string;
    tipo: string;
  }> = [
    {
      id: 1,
      nombre: 'Restaurante El Mirador',
      ubicacion: 'Centro de Arroyo Seco',
      descripcion: 'Cocina tradicional queretana con vista panorámica al valle.',
      imagen: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop',
      badge: 'Recomendado',
      tipo: 'restaurante'
    },
    {
      id: 2,
      nombre: 'La Trucha Feliz',
      ubicacion: 'Camino al Río Escanela',
      descripcion: 'Trucha fresca del río, preparada al estilo serrano.',
      imagen: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop',
      badge: 'Favorito local',
      tipo: 'restaurante'
    },
    {
      id: 3,
      nombre: 'Café Sierra Gorda',
      ubicacion: 'Calle Hidalgo 12',
      descripcion: 'Café de altura y postres artesanales de la región.',
      imagen: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=400&fit=crop',
      badge: '',
      tipo: 'cafe'
    },
    {
      id: 4,
      nombre: 'Fonda Doña María',
      ubicacion: 'Plaza Principal',
      descripcion: 'Comida casera de la Sierra Gorda. Gorditas y tamales.',
      imagen: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
      badge: 'Tradicional',
      tipo: 'comida-corrida'
    }
  ];

  readonly gastroCategorias = [
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

  constructor(private router: Router, private gastronomiaService: GastronomiaService) {}

  ngOnInit(): void {
    this.syncExperienceByRoute(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncExperienceByRoute(event.urlAfterRedirects);
      }
    });

    this.loadFeaturedRestaurantes();
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrollOffset = window.scrollY;
  }

  search() {
    const baseRoute = this.isGastronomiaLanding ? '/publica/gastronomia' : '/publica/alojamientos';
    this.router.navigate([baseRoute], {
      queryParams: {
        q: this.searchQuery || undefined,
        guests: !this.isGastronomiaLanding && this.guests > 1 ? this.guests : undefined,
        tipo: this.isGastronomiaLanding && this.selectedGastroTipo !== 'todos' ? this.selectedGastroTipo : undefined
      }
    });
  }

  filterByCategory(label: string) {
    if (this.isGastronomiaLanding) {
      this.selectedGastroTipo = label;
      return;
    }

    this.router.navigate(['/publica/alojamientos'], { queryParams: { category: label } });
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  get heroSubtitleText(): string {
    return this.isGastronomiaLanding
      ? 'Encuentra restaurantes, bares y cafes reales de Arroyo Seco en segundos'
      : 'Hospedajes únicos, gastronomía local y experiencias inolvidables en el corazón de Querétaro';
  }

  get featuredGastronomia(): Array<{ id: number; nombre: string; ubicacion: string; descripcion: string; imagen: string; badge: string; tipo: string }> {
    if (this.selectedGastroTipo === 'todos') {
      return this.featuredRestaurantes;
    }

    return this.featuredRestaurantes.filter((item) => item.tipo === this.selectedGastroTipo);
  }

  getTipoLabel(tipo: string): string {
    const found = this.gastroCategorias.find((item) => item.key === tipo);
    return found?.label || 'Restaurante';
  }

  private syncExperienceByRoute(url: string): void {
    this.isGastronomiaLanding = url.includes('/publica/gastronomia');
  }

  private loadFeaturedRestaurantes(): void {
    this.gastronomiaService.listAll().pipe(first()).subscribe({
      next: (restaurantes: EstablecimientoDto[]) => {
        if (!restaurantes?.length) return;

        this.featuredRestaurantes = restaurantes.slice(0, 8).map((item) => ({
          id: item.id || 0,
          nombre: item.nombre,
          ubicacion: item.ubicacion,
          descripcion: item.descripcion || 'Conoce este establecimiento en Arroyo Seco.',
          imagen: item.fotoPrincipal || 'assets/images/hero-oferentes.svg',
          badge: item.tipoEstablecimiento ? this.getTipoLabel(item.tipoEstablecimiento) : 'Recomendado',
          tipo: item.tipoEstablecimiento || 'restaurante'
        }));
      },
      error: () => {
        // Fallback already present with static data
      }
    });
  }
}
