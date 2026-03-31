import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GastronomiaService, EstablecimientoDto, MenuDto, ReviewGastronomiaDto } from '../../services/gastronomia.service';
import { ReservasGastronomiaService } from '../../services/reservas-gastronomia.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { first } from 'rxjs/operators';
import { MapViewComponent } from '../../../shared/components/map-view/map-view.component';

@Component({
  selector: 'app-detalle-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MapViewComponent],
  templateUrl: './detalle-gastronomia.component.html',
  styleUrl: './detalle-gastronomia.component.scss'
})
export class DetalleGastronomiaComponent implements OnInit {
  establecimiento: EstablecimientoDto | null = null;
  menus: MenuDto[] = [];
  reviews: ReviewGastronomiaDto[] = [];
  loadingReviews = false;
  submittingReview = false;
  loading = false;
  error: string | null = null;
  isPublic = false;

  puntuacion = 5;
  comentario = '';
  
  // Formulario de reserva
  showReservaForm = false;
  fecha = '';
  hora = '19:00';
  numeroPersonas = 2;
  mesaId: number | null = null;
  submitting = false;
  lightboxOpen = false;
  lightboxIndex = 0;
  readonly horariosDisponibles = [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30', '22:00'
  ];

  private readonly tipoLabels: Record<string, string> = {
    'restaurante': 'Restaurante',
    'bar': 'Bar',
    'antro': 'Antro',
    'cafe': 'Café',
    'desayunos': 'Desayunos',
    'comida-corrida': 'Comida corrida',
    'cena': 'Cena',
    'antojitos': 'Antojitos'
  };

  private readonly amenidadCatalog: Record<string, { label: string; icon: string }> = {
    'wifi':               { label: 'WiFi', icon: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z' },
    'terraza':            { label: 'Terraza', icon: 'M12 3L2 12h3v9h6v-5h2v5h6v-9h3L12 3z' },
    'estacionamiento':    { label: 'Estacionamiento', icon: 'M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z' },
    'pet-friendly':       { label: 'Pet friendly', icon: 'M4.5 9A2.5 2.5 0 1 0 4.5 4a2.5 2.5 0 0 0 0 5zm15 0A2.5 2.5 0 1 0 19.5 4a2.5 2.5 0 0 0 0 5zM8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-4 1c-3.5 0-6 2.2-6 5 0 2.2 1.8 4 4 4 .9 0 1.7-.3 2.4-.8.6.5 1.5.8 2.6.8 2.2 0 4-1.8 4-4 0-2.8-2.5-5-6-5z' },
    'reservas':           { label: 'Acepta reservas', icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2z' },
    'musica-en-vivo':     { label: 'Música en vivo', icon: 'M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z' },
    'accesible':          { label: 'Acceso para sillas de ruedas', icon: 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z' },
    'entrega-a-domicilio':{ label: 'Entrega a domicilio', icon: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5l1.96 2.5H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2.22-3c-.55-.61-1.35-1-2.22-1s-1.67.39-2.22 1H3V6h12v9H8.22zm9.78 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z' },
    'para-llevar':        { label: 'Para llevar', icon: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2zm2-4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2z' },
    'tarjeta':            { label: 'Pago con tarjeta', icon: 'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' }
  };

  readonly defaultGalleryImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop'
  ];

  private readonly badWords = [
    'puta', 'puto', 'pendejo', 'cabron', 'chingar', 'mierda', 'pinche', 'culero', 'estupido', 'imbecil',
    'fuck', 'fucking', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'motherfucker', 'slut', 'whore'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gastronomiaService: GastronomiaService,
    private reservasService: ReservasGastronomiaService,
    private toast: ToastService,
    private auth: AuthService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.isPublic = this.router.url.includes('/publica/');
    this.setDefaultReservationDate();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadEstablecimiento(id);
      this.loadMenus(id);
      this.loadReviews(id);
    }
  }

  private loadEstablecimiento(id: number) {
    this.loading = true;
    this.gastronomiaService.getById(id).pipe(first()).subscribe({
      next: (data) => {
        console.log('Establecimiento cargado:', data);
        console.log('Mesas disponibles:', data?.mesas);
        data.fotosUrls = this.extractGalleryUrls(data);
        this.establecimiento = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar el restaurante';
        this.loading = false;
      }
    });
  }

  private loadMenus(id: number) {
    this.gastronomiaService.getMenus(id).pipe(first()).subscribe({
      next: (data) => {
        this.menus = data || [];
      },
      error: () => {
        console.error('Error al cargar menús');
      }
    });
  }

  private loadReviews(id: number) {
    this.loadingReviews = true;
    this.gastronomiaService.getReviews(id).pipe(first()).subscribe({
      next: (data) => {
        console.log('Reviews loaded:', data);
        this.reviews = data || [];
        this.loadingReviews = false;
      },
      error: (err) => {
        console.error('Reviews error:', err);
        this.reviews = [];
        this.loadingReviews = false;
      }
    });
  }

  toggleReservaForm() {
    if (this.isPublic) {
      const id = this.establecimiento?.id;
      const returnUrl = id ? `/cliente/gastronomia/${id}` : '/cliente/gastronomia';
      this.toast.error('Debes iniciar sesión para hacer una reserva');
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.toast.error('Debes iniciar sesión para hacer una reserva');
      this.router.navigate(['/login']);
      return;
    }
    this.showReservaForm = !this.showReservaForm;
  }

  get minFecha(): string {
    return new Date().toISOString().split('T')[0];
  }

  get fechaReservaResumen(): string {
    if (!this.fecha || !this.hora) return 'Selecciona fecha y hora';
    const date = new Date(`${this.fecha}T${this.hora}`);
    return date.toLocaleString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  crearReserva() {
    if (this.isPublic) {
      const id = this.establecimiento?.id;
      const returnUrl = id ? `/cliente/gastronomia/${id}` : '/cliente/gastronomia';
      this.toast.error('Debes iniciar sesión para hacer una reserva');
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.toast.error('Debes iniciar sesión para hacer una reserva');
      this.router.navigate(['/login']);
      return;
    }
    if (!this.establecimiento?.id) return;
    
    if (!this.fecha || !this.hora || !this.numeroPersonas) {
      this.toast.error('Completa todos los campos');
      return;
    }

    const fechaReserva = new Date(`${this.fecha}T${this.hora}`);
    if (Number.isNaN(fechaReserva.getTime())) {
      this.toast.error('Selecciona una fecha y hora válidas');
      return;
    }

    if (fechaReserva.getTime() < Date.now()) {
      this.toast.error('La reserva debe ser en una fecha futura');
      return;
    }

    this.submitting = true;
    const payload = {
      establecimientoId: this.establecimiento.id,
      fecha: fechaReserva.toISOString(),
      numeroPersonas: this.numeroPersonas,
      mesaId: this.mesaId || null
    };

    console.log('Enviando reserva con payload:', payload);
    this.reservasService.crear(payload)
      .pipe(first())
      .subscribe({
        next: (result: any) => {
          console.log('Reserva de gastronomía creada exitosamente:', result);
          if (result?.queuedOffline) {
            this.toast.info('Sin internet: reserva guardada localmente y pendiente de sincronización');
          } else {
            this.toast.success('Reserva creada exitosamente');
          }
          this.showReservaForm = false;
          this.resetForm();
          this.submitting = false;
          // Redirigir a listado de reservas de gastronomía (ruta existente)
          this.router.navigate(['/cliente/gastronomia/reservas']);
        },
        error: (err) => {
          console.error('Error al crear reserva de gastronomía:', err);
          this.toast.error(err?.error?.message || 'Error al crear la reserva');
          this.submitting = false;
        }
      });
  }

  private resetForm() {
    this.setDefaultReservationDate();
    this.hora = '19:00';
    this.numeroPersonas = 2;
    this.mesaId = null;
  }

  private setDefaultReservationDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.fecha = tomorrow.toISOString().split('T')[0];
  }

  enviarReview() {
    if (!this.establecimiento?.id) return;
    if (!this.auth.isAuthenticated()) {
      this.toast.error('Debes iniciar sesión para dejar una reseña');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/cliente/gastronomia/${this.establecimiento.id}` } });
      return;
    }

    const texto = (this.comentario || '').trim();
    if (this.puntuacion < 1 || this.puntuacion > 5) {
      this.toast.error('La calificación debe ser entre 1 y 5');
      return;
    }
    if (!texto) {
      this.toast.error('Escribe un comentario para publicar la reseña');
      return;
    }
    if (this.contieneLenguajeNoPermitido(texto)) {
      this.toast.error('La reseña contiene lenguaje no permitido');
      return;
    }

    this.submittingReview = true;
    this.gastronomiaService.createReview(this.establecimiento.id, {
      puntuacion: this.puntuacion,
      comentario: texto
    }).pipe(first()).subscribe({
      next: () => {
        this.toast.success('Reseña enviada correctamente');
        this.comentario = '';
        this.puntuacion = 5;
        this.submittingReview = false;
        this.toast.info('Tu reseña quedó pendiente de revisión por el administrador');
        this.loadReviews(this.establecimiento!.id!);
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudo enviar la reseña');
        this.submittingReview = false;
      }
    });
  }

  get promedioReviews(): number {
    if (!this.reviews.length) return 0;
    const total = this.reviews.reduce((acc, r) => acc + (Number(r.puntuacion) || 0), 0);
    return total / this.reviews.length;
  }

  estrellas(valor: number): number[] {
    const v = Math.max(1, Math.min(5, Math.round(valor || 0)));
    return Array.from({ length: v }, (_, i) => i);
  }

  estrellasTotales(): number[] {
    return [1, 2, 3, 4, 5];
  }

  obtenerAutor(review: ReviewGastronomiaDto): string {
    return review.usuarioNombre || review.nombreUsuario || review.nombre || 'Cliente';
  }

  abrirComoLlegar() {
    if (!this.establecimiento?.latitud || !this.establecimiento?.longitud) {
      this.toast.error('No hay coordenadas disponibles para este restaurante');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${this.establecimiento.latitud},${this.establecimiento.longitud}`;
    window.open(url, '_blank');
  }

  get galleryImages(): string[] {
    const raw = this.extractGalleryUrls(this.establecimiento);
    if (!raw.length) return this.defaultGalleryImages;
    const padded = [...raw];
    while (padded.length < 5) {
      padded.push(this.defaultGalleryImages[padded.length % this.defaultGalleryImages.length]);
    }
    return padded;
  }

  get tipoEstablecimientoLabel(): string {
    const key = this.establecimiento?.tipoEstablecimiento || 'restaurante';
    return this.tipoLabels[key] || 'Restaurante';
  }

  get amenidadesVisibles(): { icon: string; label: string }[] {
    return (this.establecimiento?.amenidades?.slice(0, 8) || [])
      .map((key) => this.amenidadCatalog[key] ?? { icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z', label: key });
  }

  get heroImage(): string {
    return this.galleryImages[0];
  }

  openLightbox(index = 0) {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  prevImage(event: Event) {
    event.stopPropagation();
    this.lightboxIndex = this.lightboxIndex > 0 ? this.lightboxIndex - 1 : this.galleryImages.length - 1;
  }

  nextImage(event: Event) {
    event.stopPropagation();
    this.lightboxIndex = (this.lightboxIndex + 1) % this.galleryImages.length;
  }

  shareProperty() {
    if (navigator.share) {
      navigator.share({ title: this.establecimiento?.nombre ?? '', url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
      this.toast.info('Enlace copiado al portapapeles');
    }
  }

  private resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const root = this.api.baseUrl.replace(/\/api$/i, '');
    return `${root}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private extractGalleryUrls(establecimiento: EstablecimientoDto | null): string[] {
    if (!establecimiento) return [];
    const urls = [
      establecimiento.fotoPrincipal,
      ...(establecimiento.fotos || []).map((foto) => foto.url),
      ...(establecimiento.fotosUrls || [])
    ]
      .filter((value): value is string => !!value)
      .map((u) => this.resolveUrl(u));
    return [...new Set(urls)];
  }

  // Exponer autenticación al template
  get autenticado(): boolean {
    return this.auth.isAuthenticated();
  }

  get mesasDisponibles() {
    return (this.establecimiento?.mesas || []).filter((mesa) => !!mesa?.disponible);
  }

  private contieneLenguajeNoPermitido(texto: string): boolean {
    const normalizado = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const tokens = normalizado.split(/[^a-z]+/).filter(Boolean);
    return tokens.some((token) => this.badWords.includes(token));
  }
}
