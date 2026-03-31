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
  currentPage = 1;
  readonly pageSize = 6;

  ngOnInit(): void {
    this.loadEstablecimientos();
  }

  private loadEstablecimientos() {
    this.loading = true;
    this.gastronomiaService.listMine().pipe(first()).subscribe({
      next: (data) => {
        this.establecimientos = data || [];
        this.currentPage = 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar establecimientos:', err);
        this.toast.error('Error al cargar establecimientos. Por favor verifica que el backend esté funcionando.');
        this.establecimientos = [];
        this.currentPage = 1;
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

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEstablecimientos.length / this.pageSize));
  }

  get paginatedEstablecimientos(): EstablecimientoDto[] {
    const page = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredEstablecimientos.slice(start, start + this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  goPrevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  goNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }
}
