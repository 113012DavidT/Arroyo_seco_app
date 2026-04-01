import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { AdminOferentesService } from '../../services/admin-oferentes.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { first } from 'rxjs/operators';

interface Solicitud {
  id: number;
  nombre: string;
  telefono: string;
  contexto: string;
  tipoNegocio: number;
  tipoTexto: string;
  fechaSolicitud?: string;
  estado?: string;
}

@Component({
  selector: 'app-admin-solicitudes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-solicitudes.component.html',
  styleUrl: './admin-solicitudes.component.scss'
})
export class AdminSolicitudesComponent implements OnInit {
  private adminService = inject(AdminOferentesService);
  private toastService = inject(ToastService);
    private confirmModal = inject(ConfirmModalService);
  private router = inject(Router);

  solicitudes: Solicitud[] = [];
  loading = false;
  searchTerm = '';
  error = '';
  tipoFiltro: number | null = null; // 1=Alojamiento, 2=Gastronomía, null=Todos

  ngOnInit(): void {
    // Detectar si viene de gastronomía o alojamiento
    this.detectarTipoDesdeRuta();
    this.cargarSolicitudes();
    
    // Escuchar cambios de navegación
    this.router.events.pipe(
      first(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.detectarTipoDesdeRuta();
    });
  }

  private detectarTipoDesdeRuta(): void {
    const url = this.router.url;
    
    // Si la URL contiene 'gastronomia', filtrar por gastronomía
    if (url.includes('/gastronomia')) {
      this.tipoFiltro = 2; // Gastronomía
    } 
    // Si la URL es de admin pero no contiene gastronomia, es alojamiento
    else if (url.includes('/admin/solicitudes')) {
      this.tipoFiltro = 1; // Alojamiento
    }
    // Por defecto, alojamiento
    else {
      this.tipoFiltro = 1;
    }
  }

  cargarSolicitudes() {
    this.loading = true;
    this.error = '';
    this.adminService.listSolicitudes().pipe(first()).subscribe({
      next: (data) => {
        let solicitudesFiltradas = data || [];
        
        // Filtrar por tipo si está definido
        if (this.tipoFiltro !== null) {
          solicitudesFiltradas = solicitudesFiltradas.filter(s => 
            s.tipoSolicitado === this.tipoFiltro || s.tipoSolicitado === 3 // 3 = Ambos
          );
        }
        
        this.solicitudes = solicitudesFiltradas.map(s => ({
          id: s.id,
          nombre: s.nombreSolicitante,
          telefono: s.telefono || '',
          contexto: s.mensaje,
          tipoNegocio: s.tipoSolicitado,
          tipoTexto: this.getTipoTexto(s.tipoSolicitado),
          fechaSolicitud: s.fechaSolicitud,
          estado: s.estatus
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar solicitudes:', err);
        this.solicitudes = [];
        this.error = 'No fue posible cargar las solicitudes en este momento.';
        this.loading = false;
      }
    });
  }

  get filteredSolicitudes(): Solicitud[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.solicitudes;
    return this.solicitudes.filter(s => 
      s.nombre.toLowerCase().includes(term) || 
      s.telefono.includes(term) ||
      s.tipoTexto.toLowerCase().includes(term)
    );
  }

  getTipoTexto(tipo: number): string {
    switch (tipo) {
      case 1: return 'Alojamiento';
      case 2: return 'Gastronomía';
      case 3: return 'Ambos';
      default: return 'No especificado';
    }
  }

  getTituloFiltro(): string {
    if (this.tipoFiltro === 1) return '- Alojamiento';
    if (this.tipoFiltro === 2) return '- Gastronomía';
    return '';
  }

  aprobar(solicitud: Solicitud) {
    this.confirmModal.confirm({
      title: 'Aprobar solicitud',
      message: `¿Aprobar la solicitud de ${solicitud.nombre}?`,
      confirmText: 'Aprobar',
      cancelText: 'Cancelar'
    }).then(ok => {
      if (!ok) return;
      this.adminService.aprobarSolicitud(solicitud.id, solicitud.tipoNegocio).pipe(first()).subscribe({
        next: () => {
          this.toastService.success(`Solicitud de ${solicitud.nombre} aprobada`);
          this.cargarSolicitudes();
        },
        error: (err) => {
          this.toastService.error('Error al aprobar solicitud');
          console.error('Error aprobar:', err);
        }
      });
    });
  }

  rechazar(solicitud: Solicitud) {
    this.confirmModal.confirm({
      title: 'Rechazar solicitud',
      message: `¿Rechazar la solicitud de ${solicitud.nombre}? Esta acción no se puede deshacer.`,
      confirmText: 'Rechazar',
      cancelText: 'Cancelar',
      isDangerous: true
    }).then(ok => {
      if (!ok) return;
      this.adminService.rechazarSolicitud(solicitud.id).pipe(first()).subscribe({
        next: () => {
          this.toastService.warning(`Solicitud de ${solicitud.nombre} rechazada`);
          this.cargarSolicitudes();
        },
        error: (err) => {
          this.toastService.error('Error al rechazar solicitud');
          console.error('Error rechazar:', err);
        }
      });
    });
  }
}
