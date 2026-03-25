import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CommonModule } from '@angular/common';
import { first } from 'rxjs/operators';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-oferente-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './oferente-login.component.html',
  styleUrl: './oferente-login.component.scss'
})
export class OferenteLoginComponent {
  loginModel: LoginModel = {
    email: '',
    password: ''
  };
  isLoading = false;
  showPassword = false;

  constructor(
    private router: Router, 
    private auth: AuthService,
    private toast: ToastService
  ) {}

  onSubmit(form: NgForm): void {
    if (!form.valid) {
      this.toast.error('Por favor completa todos los campos');
      return;
    }

    this.isLoading = true;
    this.auth.login({ email: this.loginModel.email, password: this.loginModel.password }).pipe(first()).subscribe({
      next: () => {
        // Detectar rol y redirigir
        const roles = this.auth.getRoles();
        console.log('Login exitoso, roles:', roles);
        
        if (roles.some(r => /admin/i.test(r))) {
          this.router.navigate(['/admin/home']);
        } else if (roles.some(r => /oferente/i.test(r))) {
          const tipo = this.auth.getTipoNegocio();
          if (tipo === 1) {
            this.router.navigate(['/oferente/dashboard']);
          } else if (tipo === 2) {
            this.router.navigate(['/oferente/gastronomia/dashboard']);
          } else {
            this.router.navigate(['/oferente/home']);
          }
        } else {
          this.router.navigate(['/cliente/home']);
        }
      },
      error: (err) => {
        console.error('Error al iniciar sesión:', err);
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'No se pudo iniciar sesión como oferente');
      }
    });
  }
}
