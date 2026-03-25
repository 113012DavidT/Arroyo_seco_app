import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { ReservasService } from '../../services/reservas.service';
import { first, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

interface Reserva {
  id: number;
  alojamiento: string;
  fechaEntrada: string;
  fechaSalida: string;
  huespedes: number;
  total: number;
  estado: 'activa' | 'pasada' | 'cancelada';
}

@Component({
  selector: 'app-cliente-reservas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-reservas.component.html',
  styleUrls: ['./cliente-reservas.component.scss']
})
export class ClienteReservasComponent implements OnInit {
  private reservasService = inject(ReservasService);
  private toast = inject(ToastService);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  reservas: Reserva[] = [];

  selectedReserva: Reserva | null = null;
  showCancelModal = false;

  constructor() {}

  ngOnInit(): void {
    this.cargar();
  }

  private cargar() {
    // Obtengo el usuario autenticado y le pido al backend el historial completo
    // del cliente: GET /reservas/cliente/{clienteId}/historial
    this.auth.me().pipe(
      first(),
      switchMap((user: any) => {
        const clienteId = String(user?.id || user?.sub || user?.userId || user?.clienteId || '');
        if (!clienteId) return of([] as any[]);
        return this.reservasService.historialByCliente(clienteId).pipe(first());
      })
    ).subscribe({
      next: (items: any[]) => {
        const mapItem = (it: any): Reserva => {
          let comprobanteUrl: string = it.comprobanteUrl || it.ComprobanteUrl || '';
          if (comprobanteUrl && !/^https?:\/\//i.test(comprobanteUrl)) {
            if (!comprobanteUrl.startsWith('/')) comprobanteUrl = '/' + comprobanteUrl;
            const apiRoot = this.api.baseUrl.replace(/\/api$/i, '');
            comprobanteUrl = `${apiRoot}${comprobanteUrl}`;
          }
          const estadoBackend = String(it.estado || it.Estado || '').toLowerCase();
          const estado: Reserva['estado'] = /activa|confirm/i.test(estadoBackend)
            ? 'activa'
            : (/cancel/i.test(estadoBackend) ? 'cancelada' : 'pasada');
          return {
            id: Number(it.id || it.Id || 0),
            alojamiento: it.alojamientoNombre || it.AlojamientoNombre || '',
            fechaEntrada: it.fechaEntrada || it.FechaEntrada || '',
            fechaSalida: it.fechaSalida || it.FechaSalida || '',
            huespedes: 1,
            total: Number(it.total || it.Total || 0),
            estado
          } as Reserva;
        };

        this.reservas = (items || []).map(mapItem);
      },
      error: () => {
        this.toast.error('No se pudieron cargar tus reservas');
      }
    });
  }

  openCancelModal(reserva: Reserva) {
    this.selectedReserva = reserva;
    this.showCancelModal = true;
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.selectedReserva = null;
  }

  cancelReserva() {
    if (this.selectedReserva) {
      this.selectedReserva.estado = 'cancelada';
      this.toast.success('Reserva cancelada exitosamente');
      this.closeCancelModal();
    }
  }

  get reservasActivas() {
    return this.reservas.filter(r => r.estado === 'activa');
  }

  get reservasPasadas() {
    return this.reservas.filter(r => r.estado === 'pasada' || r.estado === 'cancelada');
  }
}
