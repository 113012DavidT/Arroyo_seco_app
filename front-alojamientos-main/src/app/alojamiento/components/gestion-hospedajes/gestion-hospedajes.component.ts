import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AlojamientoService, AlojamientoDto } from '../../services/alojamiento.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { first } from 'rxjs/operators';

interface Hospedaje {
  id: string;
  nombre: string;
  ubicacion: string;
  huespedes: number;
  habitaciones: number;
  banos: number;
  precio: number;
  estado: 'Reservado' | 'Pendiente de pago' | 'Confirmado';
  imagen: string;
}

@Component({
  selector: 'app-gestion-hospedajes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gestion-hospedajes.component.html',
  styleUrl: './gestion-hospedajes.component.scss'
})
export class GestionHospedajesComponent implements OnInit {
  private toastService = inject(ToastService);
  private alojamientosService = inject(AlojamientoService);
  private confirmModal = inject(ConfirmModalService);

  searchTerm = '';

  hospedajes: Hospedaje[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.cargarHospedajes();
  }

  private cargarHospedajes() {
    this.loading = true;
    this.alojamientosService.listMine().pipe(first()).subscribe({
      next: (data: AlojamientoDto[]) => {
        this.hospedajes = (data || []).map(d => ({
          id: String(d.id),
          nombre: d.nombre,
          ubicacion: d.ubicacion,
          huespedes: d.maxHuespedes,
          habitaciones: d.habitaciones,
          banos: d.banos,
          precio: d.precioPorNoche,
          estado: 'Confirmado', // Suponemos estado generico, backend no provee
          imagen: d.fotoPrincipal || 'assets/images/hero-oferentes.svg'
        }));
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar tus hospedajes';
        this.loading = false;
      }
    });
  }

  get filteredHospedajes(): Hospedaje[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.hospedajes;
    }

    return this.hospedajes.filter((h) =>
      [h.nombre, h.ubicacion, h.estado]
        .some((value) => value.toLowerCase().includes(term))
    );
  }

  eliminar(hospedaje: Hospedaje) {
    this.confirmModal.confirm({
      title: 'Eliminar hospedaje',
      message: `¿Eliminar "${hospedaje.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDangerous: true
    }).then(ok => {
      if (!ok) return;
      this.alojamientosService.delete(Number(hospedaje.id)).pipe(first()).subscribe({
        next: () => {
          this.hospedajes = this.hospedajes.filter(h => h.id !== hospedaje.id);
          this.toastService.success(`Hospedaje "${hospedaje.nombre}" eliminado`);
        },
        error: () => this.toastService.error('No se pudo eliminar hospedaje')
      });
    });
  }
}
