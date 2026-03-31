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
  readonly nombrePattern = "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\\s.'-]{2,80}$";
  readonly telefonoPattern = '^\\d{10}$';
  readonly correoPattern = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$';
  readonly negocioPattern = '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s.,#()\\-]{2,120}$';

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

    if (!this.validarModelo()) {
      return;
    }

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
        this.toast.error(err?.error?.message || 'Error al enviar la solicitud. Intenta nuevamente.');
        this.isSubmitting = false;
      }
    });
  }

  onTelefonoInput() {
    const soloDigitos = (this.model.telefono || '').replace(/\D/g, '');
    this.model.telefono = soloDigitos.slice(0, 10);
  }

  private validarModelo(): boolean {
    const nombre = this.model.nombre.trim();
    const correo = this.model.correo.trim();
    const telefono = this.model.telefono.trim();
    const contexto = this.model.contexto.trim();

    if (!new RegExp(this.nombrePattern).test(nombre)) {
      this.toast.error('Nombre invalido. Solo letras y espacios permitidos');
      return false;
    }

    if (!new RegExp(this.correoPattern).test(correo)) {
      this.toast.error('Correo invalido');
      return false;
    }

    if (!new RegExp(this.telefonoPattern).test(telefono)) {
      this.toast.error('Telefono invalido. Debe tener exactamente 10 digitos');
      return false;
    }

    if (!new RegExp(this.negocioPattern).test(nombre)) {
      this.toast.error('Nombre de negocio invalido');
      return false;
    }

    if (!contexto || contexto.length > 500) {
      this.toast.error('Describe tu negocio en un maximo de 500 caracteres');
      return false;
    }

    return true;
  }
}
