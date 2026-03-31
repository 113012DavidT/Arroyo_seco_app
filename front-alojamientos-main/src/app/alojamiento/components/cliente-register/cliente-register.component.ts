import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-cliente-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cliente-register.component.html',
  styleUrls: ['./cliente-register.component.scss']
})
export class ClienteRegisterComponent {
  model = { email: '', password: '', confirm: '', direccion: '', sexo: '' };
  loading = false;
  showPassword = false;
  showConfirm = false;
  readonly direccionPattern = '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s.,#-]{5,200}$';

  constructor(private toast: ToastService, private router: Router, private auth: AuthService) {}

  submit(form: NgForm) {
    if (form.invalid || this.loading) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(this.model.email)) {
      this.toast.show('Correo inválido', 'error');
      return;
    }
    if (!this.cumplePoliticaPassword(this.model.password)) {
      this.toast.show('La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo.', 'error');
      return;
    }
    if (this.model.password !== this.model.confirm) {
      this.toast.show('Las contraseñas no coinciden', 'error');
      return;
    }
    this.loading = true;
    // El backend asigna rol CLIENTE por defecto; no enviamos role
    if (!this.model.direccion.trim()) {
      this.toast.show('La direccion es obligatoria', 'error');
      this.loading = false;
      return;
    }
    if (!this.validarDireccion(this.model.direccion)) {
      this.toast.show('La direccion debe tener entre 5 y 200 caracteres permitidos', 'error');
      this.loading = false;
      return;
    }
    if (!this.model.sexo) {
      this.toast.show('El sexo es obligatorio', 'error');
      this.loading = false;
      return;
    }

    this.auth.register({
      email: this.model.email,
      password: this.model.password,
      direccion: this.model.direccion.trim(),
      sexo: this.model.sexo
    }).pipe(first()).subscribe({
      next: (res: any) => {
        if (res?.queuedOffline) {
          this.toast.show('Sin internet: registro guardado y pendiente de sincronizacion', 'success');
        } else {
          this.toast.show('Registro exitoso. Inicia sesión.', 'success');
        }
        this.loading = false;
        this.router.navigate(['/cliente/login']);
      },
      error: (err) => {
        const message = this.getRegisterErrorMessage(err);
        this.toast.show(message, 'error');
        this.loading = false;
      }
    });
  }

  private cumplePoliticaPassword(password: string): boolean {
    const hasMinLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return hasMinLength && hasUpper && hasLower && hasDigit && hasSymbol;
  }

  private validarDireccion(direccion: string): boolean {
    const direccionLimpia = (direccion || '').trim();
    return new RegExp(this.direccionPattern).test(direccionLimpia);
  }

  private getRegisterErrorMessage(err: any): string {
    const payload = err?.error;

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (Array.isArray(payload) && payload.length > 0) {
      const desc = payload.map((e: any) => e?.description || e?.code).filter(Boolean).join(' ');
      if (desc) return desc;
    }

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    return 'No se pudo registrar. Revisa los datos e intenta de nuevo.';
  }
}
