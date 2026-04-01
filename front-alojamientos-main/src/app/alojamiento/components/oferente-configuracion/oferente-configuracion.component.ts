import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';

interface Perfil {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  sexo: string;
}

@Component({
  selector: 'app-oferente-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './oferente-configuracion.component.html',
  styleUrls: ['./oferente-configuracion.component.scss']
})
export class OferenteConfiguracionComponent implements OnInit {
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private modalService = inject(ConfirmModalService);
  private router = inject(Router);

  perfil: Perfil = {
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    sexo: ''
  };
  editPerfil: Perfil = {
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    sexo: ''
  };
  cargando = false;
  guardando = false;
  editando = false;
  readonly nombrePattern = "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\\s.'-]{3,80}$";
  readonly correoPattern = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$';
  readonly telefonoPattern = '^\\d{10}$';
  readonly direccionPattern = '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s.,#-]{5,200}$';
  readonly sexosPermitidos = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'];

  ngOnInit() {
    this.cargarPerfil();
  }

  private cargarPerfil() {
    this.cargando = true;
    this.authService.me().pipe(first()).subscribe({
      next: (resp) => {
        this.perfil = {
          nombre: resp?.nombre || '',
          email: resp?.email || '',
          telefono: resp?.telefono || '',
          direccion: resp?.direccion || '',
          sexo: resp?.sexo || ''
        };
        this.editPerfil = { ...this.perfil };
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.cargarDesdeToken();
      }
    });
  }

  private cargarDesdeToken() {
    const token = this.authService.getToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.perfil = {
        nombre: payload['name'] || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'Usuario',
        email: payload['email'] || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
        telefono: payload['phone'] || '',
        direccion: '',
        sexo: ''
      };
      this.editPerfil = { ...this.perfil };
    } catch {
      this.toastService.error('No fue posible cargar tu perfil');
    }
  }

  iniciarEdicion() {
    this.editPerfil = { ...this.perfil };
    this.editando = true;
  }

  cancelarEdicion() {
    this.editPerfil = { ...this.perfil };
    this.editando = false;
  }

  guardarPerfil() {
    if (this.guardando) return;
    if (!this.validarPerfil()) return;

    const payload = {
      nombre: this.editPerfil.nombre?.trim(),
      email: this.editPerfil.email?.trim(),
      telefono: this.editPerfil.telefono?.trim(),
      direccion: this.editPerfil.direccion?.trim(),
      sexo: this.editPerfil.sexo?.trim()
    };

    this.guardando = true;
    this.usuarioService.updatePerfil(payload).pipe(first()).subscribe({
      next: async () => {
        this.perfil = { ...this.editPerfil };
        this.editando = false;
        this.guardando = false;
        await this.modalService.confirm({ title: 'Perfil actualizado', message: 'Tus datos han sido guardados correctamente.', confirmText: 'Aceptar' });
      },
      error: (err) => {
        console.error('Error al actualizar perfil:', err);
        this.guardando = false;
        this.toastService.error(err?.error?.message || 'No fue posible actualizar tu perfil');
      }
    });
  }

  onTelefonoInput() {
    const soloDigitos = (this.editPerfil.telefono || '').replace(/\D/g, '');
    this.editPerfil.telefono = soloDigitos.slice(0, 10);
  }

  private validarPerfil(): boolean {
    const nombre = (this.editPerfil.nombre || '').trim();
    const email = (this.editPerfil.email || '').trim();
    const telefono = (this.editPerfil.telefono || '').trim();
    const direccion = (this.editPerfil.direccion || '').trim();
    const sexo = (this.editPerfil.sexo || '').trim();

    if (!new RegExp(this.nombrePattern).test(nombre)) {
      this.toastService.error('Nombre invalido. Solo letras y espacios permitidos');
      return false;
    }

    if (!new RegExp(this.correoPattern).test(email)) {
      this.toastService.error('Correo invalido');
      return false;
    }

    if (!new RegExp(this.telefonoPattern).test(telefono)) {
      this.toastService.error('Telefono invalido. Debe tener exactamente 10 digitos');
      return false;
    }

    if (!new RegExp(this.direccionPattern).test(direccion)) {
      this.toastService.error('Direccion invalida. Usa entre 5 y 200 caracteres permitidos');
      return false;
    }

    if (!this.sexosPermitidos.includes(sexo)) {
      this.toastService.error('Selecciona un sexo válido');
      return false;
    }

    return true;
  }

  irRecuperarPassword() {
    this.router.navigate(['/login'], {
      queryParams: {
        mode: 'forgot',
        email: this.perfil.email || null
      }
    });
  }
}
