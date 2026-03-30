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
  viewMode: 'login' | 'forgot' | 'reset' = 'login';
  model = { email: '', password: '' };
  forgotModel = { email: '' };
  resetModel = { email: '', token: '', newPassword: '', confirmPassword: '' };
  loading = false;
  forgotLoading = false;
  resetLoading = false;
  biometricLoading = false;
  checkingBiometric = false;
  biometricReady = false;
  biometricUnavailableReason = '';
  private autoBiometricAttempted = false;
  showPassword = false;
  showResetPassword = false;
  showResetPasswordConfirm = false;
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
    const mode = this.route.snapshot.queryParamMap.get('mode');
    const resetEmail = this.route.snapshot.queryParamMap.get('email');
    const resetToken = this.route.snapshot.queryParamMap.get('token');

    if (resetEmail) {
      this.model.email = resetEmail;
      this.forgotModel.email = resetEmail;
      this.resetModel.email = resetEmail;
    }

    if (mode === 'reset' && resetEmail && resetToken) {
      this.viewMode = 'reset';
      this.resetModel.token = decodeURIComponent(resetToken);
    } else if (mode === 'forgot') {
      this.viewMode = 'forgot';
    }

    // Si ya está autenticado, redirigir
    if (this.auth.isAuthenticated() && this.viewMode === 'login') {
      this.redirectByRole();
    }

    this.refreshBiometricAvailability(false);
  }

  goToForgotPassword(): void {
    this.forgotModel.email = this.model.email?.trim() || this.forgotModel.email;
    this.viewMode = 'forgot';
  }

  goToLogin(): void {
    this.viewMode = 'login';
    this.resetModel.token = '';
    this.resetModel.newPassword = '';
    this.resetModel.confirmPassword = '';
  }

  submitForgot(form: NgForm): void {
    if (form.invalid || this.forgotLoading) return;

    this.forgotLoading = true;
    this.auth.forgotPassword({ email: this.forgotModel.email.trim() })
      .pipe(first())
      .subscribe({
        next: () => {
          this.forgotLoading = false;
          this.toast.show('Si el correo existe, enviamos instrucciones para restablecer contraseña.', 'success');
          this.goToLogin();
        },
        error: () => {
          this.forgotLoading = false;
          this.toast.show('No fue posible procesar la solicitud en este momento.', 'error');
        }
      });
  }

  submitReset(form: NgForm): void {
    if (form.invalid || this.resetLoading) return;
    if (this.resetModel.newPassword.length < 6) {
      this.toast.info('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.resetModel.newPassword !== this.resetModel.confirmPassword) {
      this.toast.info('Las contraseñas no coinciden.');
      return;
    }

    this.resetLoading = true;
    this.auth.resetPassword({
      email: this.resetModel.email.trim(),
      token: this.resetModel.token,
      newPassword: this.resetModel.newPassword
    })
      .pipe(first())
      .subscribe({
        next: () => {
          this.resetLoading = false;
          this.toast.show('Contraseña restablecida correctamente. Ya puedes iniciar sesión.', 'success');
          this.goToLogin();
        },
        error: () => {
          this.resetLoading = false;
          this.toast.show('El enlace de recuperación no es válido o expiró.', 'error');
        }
      });
  }

  onEmailBlur(): void {
    this.refreshBiometricAvailability(false);
  }

  onEmailChange(): void {
    this.autoBiometricAttempted = false;
    this.biometricReady = false;
    this.biometricUnavailableReason = '';
  }

  onPasswordFocus(): void {
    this.tryAutoBiometricLogin();
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

  private async refreshBiometricAvailability(showFeedback: boolean): Promise<void> {
    if (this.biometricLoading || this.loading) return;

    this.biometricReady = false;
    this.biometricUnavailableReason = '';

    const email = this.model.email?.trim() || '';
    if (!email) return;

    this.checkingBiometric = true;
    try {
      const availability = await this.auth.checkPasskeyAvailability(email);
      this.biometricReady = availability.supported && availability.hasCredential;
      if (!this.biometricReady) {
        this.biometricUnavailableReason = this.getBiometricReasonMessage(availability.reason);
        if (showFeedback && this.biometricUnavailableReason) {
          this.toast.info(this.biometricUnavailableReason);
        }
      } else {
        this.biometricUnavailableReason = '';
      }
    } finally {
      this.checkingBiometric = false;
    }
  }

  private async tryAutoBiometricLogin(): Promise<void> {
    if (this.autoBiometricAttempted || this.biometricLoading || this.loading) return;
    const email = this.model.email?.trim();
    if (!email) return;

    this.autoBiometricAttempted = true;
    await this.refreshBiometricAvailability(false);

    if (!this.biometricReady) {
      return;
    }

    try {
      await this.loginWithBiometric();
    } catch {
      // loginWithBiometric already handles user feedback
    }
  }

  private getBiometricReasonMessage(reason?: string): string {
    switch (reason) {
      case 'PLATFORM_AUTHENTICATOR_NOT_AVAILABLE':
        return 'Este equipo o navegador no tiene autenticacion biometrica disponible. Puedes continuar con contraseña.';
      case 'NO_REGISTERED_PASSKEY':
        return 'No encontramos una llave biometrica para este correo en este dispositivo.';
      case 'WEB_AUTHN_NOT_SUPPORTED':
        return 'Tu navegador no soporta biometria web. Usa contraseña o cambia a un navegador compatible.';
      default:
        return '';
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
