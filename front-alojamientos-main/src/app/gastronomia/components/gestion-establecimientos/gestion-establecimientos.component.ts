import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GastronomiaService, EstablecimientoDto } from '../../services/gastronomia.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-gestion-establecimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gestion-establecimientos.component.html',
  styleUrl: './gestion-establecimientos.component.scss'
})
export class GestionEstablecimientosComponent implements OnInit {
  private gastronomiaService = inject(GastronomiaService);
  private toast = inject(ToastService);
  private confirmModal = inject(ConfirmModalService);

  establecimientos: EstablecimientoDto[] = [];
  loading = false;
  searchTerm = '';

  ngOnInit(): void {
    this.loadEstablecimientos();
  }

  private loadEstablecimientos() {
    this.loading = true;
    this.gastronomiaService.listMine().pipe(first()).subscribe({
      next: (data) => {
        this.establecimientos = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar establecimientos:', err);
        this.toast.error('Error al cargar establecimientos. Por favor verifica que el backend esté funcionando.');
        this.establecimientos = [];
        this.loading = false;
      }
    });
  }

  async eliminar(est: EstablecimientoDto) {
    if (!est.id) return;
    const ok = await this.confirmModal.confirm({
      title: 'Eliminar establecimiento',
      message: `¿Eliminar "${est.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDangerous: true
    });
    if (!ok) return;

    this.gastronomiaService.delete(est.id).pipe(first()).subscribe({
      next: () => {
        this.toast.success(`Establecimiento "${est.nombre}" eliminado`);
        this.loadEstablecimientos();
      },
      error: () => {
        this.toast.error('Error al eliminar el establecimiento');
      }
    });
  }

  get filteredEstablecimientos(): EstablecimientoDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.establecimientos;
    return this.establecimientos.filter(e =>
      [e.nombre, e.ubicacion, e.descripcion]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(term))
    );
  }
}
