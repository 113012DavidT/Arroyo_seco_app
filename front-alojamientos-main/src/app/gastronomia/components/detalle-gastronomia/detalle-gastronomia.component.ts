import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GastronomiaService, EstablecimientoDto, MenuDto, ReviewGastronomiaDto } from '../../services/gastronomia.service';
import { ReservasGastronomiaService } from '../../services/reservas-gastronomia.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-detalle-gastronomia',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  readonly horariosDisponibles = [
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30', '22:00'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gastronomiaService: GastronomiaService,
    private reservasService: ReservasGastronomiaService,
    private toast: ToastService,
    private auth: AuthService
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
            this.toast.info('Sin internet: reserva guardada localmente y pendiente de sincronizacion');
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

  // Exponer autenticación al template
  get autenticado(): boolean {
    return this.auth.isAuthenticated();
  }
}
