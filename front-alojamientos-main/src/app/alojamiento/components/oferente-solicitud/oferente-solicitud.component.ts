import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AdminOferentesService } from '../../services/admin-oferentes.service';
import { first } from 'rxjs/operators';

interface SolicitudModel {
  nombre: string;
  telefono: string;
  correo: string;
  contexto: string;
  tipoNegocio: 1 | 2; // 1 = Alojamiento, 2 = Gastronomia
}

@Component({
  selector: 'app-oferente-solicitud',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './oferente-solicitud.component.html',
  styleUrls: ['./oferente-solicitud.component.scss']
})
export class OferenteSolicitudComponent {
  model: SolicitudModel = {
    nombre: '',
    telefono: '',
    correo: '',
    contexto: '',
    tipoNegocio: 1
  };

  isSubmitting = false;

  private toast = inject(ToastService);
  private adminService = inject(AdminOferentesService);
  private router = inject(Router);

  submit(form: NgForm) {
    if (form.invalid || this.isSubmitting) return;
    this.isSubmitting = true;

    const payload = {
      nombreSolicitante: this.model.nombre,
      telefono: this.model.telefono,
      mensaje: this.model.contexto,
      tipoSolicitado: this.model.tipoNegocio,
      nombreNegocio: this.model.nombre,
      correo: this.model.correo
    };

    this.adminService.crearSolicitud(payload).pipe(first()).subscribe({
      next: () => {
        this.toast.success('Solicitud enviada exitosamente. Te contactaremos pronto.');
        form.resetForm();
        this.model = {
          nombre: '',
          telefono: '',
          correo: '',
          contexto: '',
          tipoNegocio: 1
        };
        this.isSubmitting = false;
        // Redirigir al login después de 2 segundos
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        console.error('Error al enviar solicitud:', err);
        this.toast.error('Error al enviar la solicitud. Intenta nuevamente.');
        this.isSubmitting = false;
      }
    });
  }
}
