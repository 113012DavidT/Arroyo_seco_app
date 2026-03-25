import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-cliente-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cliente-login.component.html',
  styleUrls: ['./cliente-login.component.scss']
})
export class ClienteLoginComponent implements OnInit {
  model = { email: '', password: '' };
  loading = false;
  private returnUrl: string | null = null;

  constructor(private toast: ToastService, private router: Router, private auth: AuthService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const ru = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = ru && ru.trim().length > 0 ? ru : null;
    // Si ya está autenticado, redirigir directo
    if (this.auth.isAuthenticated()) {
      if (this.returnUrl) {
        this.router.navigateByUrl(this.returnUrl);
      } else {
        this.router.navigate(['/cliente/home']);
      }
    }
  }

  submit(form: NgForm) {
    if (form.invalid || this.loading) return;
    // Validación mínima: campos requeridos. Se eliminan reglas de complejidad para permitir cuentas existentes.
    if (!this.model.email || !this.model.password) return;
    this.loading = true;
    this.auth.login({ email: this.model.email, password: this.model.password }).pipe(first()).subscribe({
      next: () => {
        this.toast.show('Inicio de sesión exitoso', 'success');
        this.loading = false;
        // Redirigir a returnUrl si existe
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl);
          return;
        }
        // Detectar rol y redirigir
        const roles = this.auth.getRoles();
        if (roles.some(r => /admin/i.test(r))) {
          this.router.navigate(['/admin/home']);
        } else if (roles.some(r => /oferente/i.test(r))) {
          this.router.navigate(['/oferente/home']);
        } else {
          this.router.navigate(['/cliente/home']);
        }
      },
      error: () => {
        this.toast.show('Credenciales inválidas o error de servidor', 'error');
        this.loading = false;
      }
    });
  }
}
