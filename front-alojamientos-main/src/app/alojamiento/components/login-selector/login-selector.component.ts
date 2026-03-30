import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-login-selector',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login-selector.component.html',
  styleUrl: './login-selector.component.scss'
})
export class LoginSelectorComponent implements OnInit {
  model = { email: '', password: '' };
  loading = false;
  biometricLoading = false;
  showPassword = false;
  rememberMe = false;
  private returnUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const ru = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = ru && ru.trim().length > 0 ? ru : null;

    // Si ya está autenticado, redirigir
    if (this.auth.isAuthenticated()) {
      this.redirectByRole();
    }
  }

  submit(form: NgForm) {
    if (form.invalid || this.loading) return;
    this.loading = true;

    this.auth.login({ email: this.model.email, password: this.model.password })
      .pipe(first())
      .subscribe({
        next: () => {
          this.toast.show('Inicio de sesión exitoso', 'success');
          this.loading = false;

          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
            return;
          }
          this.redirectByRole();
        },
        error: (err) => {
          if (err?.status === 428 && err?.error?.requiereCompletarPerfil === true) {
            if (err?.error?.token) {
              this.auth.setToken(err.error.token);
            }
            this.auth.savePendingLogin(this.model.email);
            this.loading = false;
            this.toast.info('Debes completar tu perfil antes de continuar');
            this.router.navigate(['/completar-perfil']);
            return;
          }

          this.toast.show('Credenciales inválidas', 'error');
          this.loading = false;
        }
      });
  }

  async loginWithBiometric(): Promise<void> {
    if (this.biometricLoading || !this.auth.supportsPasskeys()) return;
    if (!this.model.email?.trim()) {
      this.toast.info('Ingresa tu email para iniciar con huella o Face ID');
      return;
    }

    this.biometricLoading = true;
    try {
      await this.auth.loginWithPasskey(this.model.email);
      this.toast.show('Autenticacion biometrica exitosa', 'success');

      if (this.returnUrl) {
        await this.router.navigateByUrl(this.returnUrl);
      } else {
        this.redirectByRole();
      }
    } catch {
      this.toast.show('No fue posible iniciar con biometria', 'error');
    } finally {
      this.biometricLoading = false;
    }
  }

  async activateBiometric(form: NgForm): Promise<void> {
    if (this.biometricLoading || this.loading) return;
    if (form.invalid) {
      this.toast.info('Para activar biometria primero inicia sesion con email y contraseña');
      return;
    }

    this.loading = true;
    this.auth.login({ email: this.model.email, password: this.model.password })
      .pipe(first())
      .subscribe({
        next: async () => {
          this.loading = false;
          this.biometricLoading = true;
          try {
            await this.auth.registerCurrentDevicePasskey('Mi telefono');
            this.toast.show('Biometria activada correctamente en este dispositivo', 'success');

            if (this.returnUrl) {
              await this.router.navigateByUrl(this.returnUrl);
            } else {
              this.redirectByRole();
            }
          } catch {
            this.toast.show('No se pudo activar la biometria', 'error');
          } finally {
            this.biometricLoading = false;
          }
        },
        error: () => {
          this.loading = false;
          this.toast.show('Credenciales invalidas', 'error');
        }
      });
  }

  private redirectByRole() {
    const roles = this.auth.getRoles();
    if (roles.some(r => /admin/i.test(r))) {
      this.router.navigate(['/admin/home']);
    } else if (roles.some(r => /oferente/i.test(r))) {
      const tipo = this.auth.getTipoNegocio();
      if (tipo === 1) {
        this.router.navigate(['/oferente/dashboard']);
      } else if (tipo === 2) {
        this.router.navigate(['/oferente/gastronomia/dashboard']);
      } else {
        // Tipo 3 (Ambos) o sin claim: mostrar selector de módulos
        this.router.navigate(['/oferente/home']);
      }
    } else {
      this.router.navigate(['/cliente/home']);
    }
  }
}
