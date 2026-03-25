import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { NotificacionesService, NotificacionDto } from '../../services/notificaciones.service';
import { first } from 'rxjs/operators';

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: Date;
  leida: boolean;
  tipo: 'reserva' | 'sistema' | 'oferta';
}

@Component({
  selector: 'app-cliente-notificaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-notificaciones.component.html',
  styleUrls: ['./cliente-notificaciones.component.scss']
})
export class ClienteNotificacionesComponent implements OnInit {
  notificaciones = signal<Notificacion[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor(private toastService: ToastService, private notiService: NotificacionesService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.notiService.list(false).pipe(first()).subscribe({
      next: (data: NotificacionDto[]) => {
        const mapped = (data || [])
          .map(d => {
            const rawId = (d as any)?.id ?? (d as any)?.ID ?? (d as any)?.notificacionId ?? (d as any)?.NotificacionId;
            if (rawId === undefined || rawId === null || rawId === '') return null;
            return {
              id: String(rawId),
              titulo: d.titulo || 'Notificación',
              mensaje: d.mensaje,
              fecha: d.fecha ? new Date(d.fecha) : new Date(),
              leida: !!d.leida,
              tipo: 'sistema' as const
            } as Notificacion;
          })
          .filter((n): n is Notificacion => !!n);
        this.notificaciones.set(mapped);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar notificaciones');
        this.loading.set(false);
      }
    });
  }

  get notificacionesNoLeidas() {
    return this.notificaciones().filter(n => !n.leida);
  }

  get notificacionesLeidas() {
    return this.notificaciones().filter(n => n.leida);
  }

  marcarLeida(notificacion: Notificacion) {
    this.notiService.marcarLeida(notificacion.id).pipe(first()).subscribe({
      next: () => {
        const updated = this.notificaciones().map(n => n.id === notificacion.id ? { ...n, leida: true } : n);
        this.notificaciones.set(updated);
        this.toastService.show('Notificación marcada como leída', 'success');
      },
      error: () => this.toastService.show('No se pudo marcar como leída', 'error')
    });
  }

  marcarNoLeida(notificacion: Notificacion) {
    // Si el backend no soporta desmarcar, solo actualizamos localmente
    const updated = this.notificaciones().map(n => n.id === notificacion.id ? { ...n, leida: false } : n);
    this.notificaciones.set(updated);
    this.toastService.show('Notificación marcada como no leída', 'info');
  }

  eliminar(notificacion: Notificacion) {
    this.notiService.eliminar(notificacion.id).pipe(first()).subscribe({
      next: () => {
        const updated = this.notificaciones().filter(n => n.id !== notificacion.id);
        this.notificaciones.set(updated);
        this.toastService.show('Notificación eliminada', 'success');
      },
      error: () => this.toastService.show('No se pudo eliminar', 'error')
    });
  }
}
