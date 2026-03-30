import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservasGastronomiaService, ReservaGastronomiaDto } from '../../services/reservas-gastronomia.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { GastronomiaService } from '../../services/gastronomia.service';
import { first, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-cliente-reservas-gastronomia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-reservas-gastronomia.component.html',
  styleUrl: './cliente-reservas-gastronomia.component.scss'
})
export class ClienteReservasGastronomiaComponent implements OnInit {
  reservasActivas: ReservaGastronomiaDto[] = [];
  reservasHistorial: ReservaGastronomiaDto[] = [];
  loading = false;
  reviewOpenForReservaId: number | null = null;
  reviewPuntuacion = 5;
  reviewComentario = '';
  submittingReview = false;

  private confirmModal = inject(ConfirmModalService);

  constructor(
    private reservasService: ReservasGastronomiaService,
    private gastronomiaService: GastronomiaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadReservas();
  }

  private loadReservas() {
    this.loading = true;

    forkJoin({
      activas: this.reservasService.activas().pipe(catchError(() => of([]))),
      historial: this.reservasService.historial().pipe(catchError(() => of([])))
    }).pipe(first()).subscribe({
      next: ({ activas, historial }) => {
        this.reservasActivas = activas || [];
        this.reservasHistorial = historial || [];
        this.loading = false;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.toast.info('Sin internet: mostrando reservas desde cache local', 3500);
        }
      },
      error: () => {
        this.toast.error('No se pudieron cargar reservas');
        this.loading = false;
      }
    });
  }

  cancelarReserva(reserva: ReservaGastronomiaDto) {
    if (!reserva.id) return;
    this.confirmModal.confirm({
      title: 'Cancelar reserva',
      message: `¿Estás seguro de cancelar la reserva en "${reserva.establecimientoNombre}"?`,
      confirmText: 'Cancelar reserva',
      cancelText: 'Volver',
      isDangerous: true
    }).then(ok => {
      if (!ok) return;
      this.reservasService.cancelar(reserva.id!).pipe(first()).subscribe({
        next: () => {
          this.toast.success('Reserva cancelada');
          this.loadReservas();
        },
        error: () => {
          this.toast.error('Error al cancelar la reserva');
        }
      });
    });
  }

  getEstadoClass(estado?: string): string {
    switch (estado?.toLowerCase()) {
      case 'confirmada': return 'estado-confirmada';
      case 'pendiente': return 'estado-pendiente';
      case 'cancelada': return 'estado-cancelada';
      default: return '';
    }
  }

  abrirReview(reserva: ReservaGastronomiaDto) {
    if (!reserva.id) return;
    this.reviewOpenForReservaId = reserva.id;
    this.reviewPuntuacion = 5;
    this.reviewComentario = '';
  }

  cerrarReview() {
    this.reviewOpenForReservaId = null;
    this.reviewPuntuacion = 5;
    this.reviewComentario = '';
    this.submittingReview = false;
  }

  enviarReview(reserva: ReservaGastronomiaDto) {
    if (!reserva.establecimientoId) {
      this.toast.error('No se pudo identificar el restaurante para calificar');
      return;
    }

    const comentario = (this.reviewComentario || '').trim();
    if (this.reviewPuntuacion < 1 || this.reviewPuntuacion > 5) {
      this.toast.error('La calificación debe ser entre 1 y 5');
      return;
    }
    if (!comentario) {
      this.toast.error('Escribe un comentario para enviar la reseña');
      return;
    }

    this.submittingReview = true;
    this.gastronomiaService.createReview(reserva.establecimientoId, {
      puntuacion: this.reviewPuntuacion,
      comentario
    }).pipe(first()).subscribe({
      next: () => {
        this.toast.success('Tu reseña fue enviada');
        this.cerrarReview();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudo enviar la reseña');
        this.submittingReview = false;
      }
    });
  }
}
