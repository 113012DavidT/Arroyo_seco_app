import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';

interface Perfil {
  nombre: string;
  correo: string;
  telefono: string;
  notificarEmail: boolean;
  notificarSms: boolean;
}

@Component({
  selector: 'app-oferente-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="configuracion">
      <h2>Configuración</h2>
      <form #f="ngForm" (ngSubmit)="guardar(f)" class="card">
        <label>
          Nombre completo
          <input type="text" name="nombre" [(ngModel)]="perfil.nombre" required minlength="3" maxlength="80" [pattern]="nombrePattern" />
        </label>

        <label>
          Correo
          <input type="email" name="correo" [(ngModel)]="perfil.correo" required />
        </label>

        <label>
          Teléfono
          <input type="tel" name="telefono" [(ngModel)]="perfil.telefono" required maxlength="10" [pattern]="telefonoPattern" inputmode="numeric" (input)="onTelefonoInput()" />
        </label>

        <fieldset class="prefs">
          <legend>Preferencias de notificación</legend>
          <label class="inline"><input type="checkbox" name="notificarEmail" [(ngModel)]="perfil.notificarEmail" /> Email</label>
          <label class="inline"><input type="checkbox" name="notificarSms" [(ngModel)]="perfil.notificarSms" /> SMS</label>
        </fieldset>

        <div class="actions">
          <button class="btn primary" [disabled]="f.invalid">Guardar cambios</button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .configuracion { display: grid; gap: 1rem; }
    .card { background: #fff; border-radius: 12px; padding: 1rem; display: grid; gap: .75rem; }
    label { display: grid; gap: .5rem; font-weight: 600; color: #374151; }
    input { border: 1px solid #d1d5db; border-radius: 10px; padding: .75rem 1rem; }
    .prefs { border: 1px solid #e5e7eb; border-radius: 10px; padding: .75rem 1rem; display: grid; gap: .5rem; }
    .inline { font-weight: 500; display: inline-flex; align-items: center; gap: .5rem; }
    .actions { display: flex; justify-content: flex-end; }
    .btn.primary { background: #1c66d6; color: #fff; border: none; border-radius: 10px; padding: .6rem 1rem; cursor: pointer; }
  `]
})
export class OferenteConfiguracionComponent implements OnInit {
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private modalService = inject(ConfirmModalService);

  perfil: Perfil = {
    nombre: '',
    correo: '',
    telefono: '',
    notificarEmail: true,
    notificarSms: false,
  };
  readonly nombrePattern = "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\\s.'-]{3,80}$";
  readonly telefonoPattern = '^\\d{10}$';

  ngOnInit() {
    // Obtener datos del JWT token
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Extraer nombre y email del token
        this.perfil.nombre = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 
                            payload['name'] || 
                            payload['unique_name'] || 
                            'Usuario';
        
        this.perfil.correo = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
                            payload['email'] || 
                            '';
        
        // Teléfono y preferencias se pueden cargar desde el API si están disponibles
      } catch (error) {
        console.error('Error al decodificar token:', error);
      }
    }
  }

  guardar(form: NgForm) {
    if (form.invalid) return;

    const nombre = (this.perfil.nombre || '').trim();
    const correo = (this.perfil.correo || '').trim();
    const telefono = (this.perfil.telefono || '').trim();

    if (!new RegExp(this.nombrePattern).test(nombre)) {
      this.toastService.error('Nombre invalido. Debe tener entre 3 y 80 caracteres');
      return;
    }

    if (!new RegExp(this.telefonoPattern).test(telefono)) {
      this.toastService.error('Telefono invalido. Debe tener exactamente 10 digitos');
      return;
    }

    this.usuarioService.updatePerfil({ nombre, email: correo, telefono }).subscribe({
      next: async () => {
        await this.modalService.confirm({ title: 'Configuración', message: 'Cambios guardados correctamente.', confirmText: 'Aceptar' });
      },
      error: (err) => {
        console.error('Error al guardar configuración:', err);
        this.toastService.error('No fue posible guardar los cambios');
      }
    });
  }

  onTelefonoInput() {
    const soloDigitos = (this.perfil.telefono || '').replace(/\D/g, '');
    this.perfil.telefono = soloDigitos.slice(0, 10);
  }
}
