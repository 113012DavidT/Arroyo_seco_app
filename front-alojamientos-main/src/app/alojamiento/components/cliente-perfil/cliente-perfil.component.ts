import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';

interface Perfil {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
}

@Component({
  selector: 'app-cliente-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-perfil.component.html',
  styleUrls: ['./cliente-perfil.component.scss']
})
export class ClientePerfilComponent implements OnInit {
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private modalService = inject(ConfirmModalService);

  perfil = signal<Perfil>({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: ''
  });

  ngOnInit() {
    // Obtener datos del token JWT
    const token = this.authService.getToken();
    if (token) {
      const payload = this.decodeToken(token);
      this.perfil.set({
        nombre: payload['name'] || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'Usuario',
        email: payload['email'] || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
        telefono: payload['phone'] || '',
        direccion: '',
        ciudad: ''
      });
    }
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return {};
    }
  }

  guardarPerfil() {
    const { nombre, email, telefono } = this.perfil();
    this.usuarioService.updatePerfil({ nombre, email, telefono }).subscribe({
      next: async () => {
        await this.modalService.confirm({ title: 'Perfil actualizado', message: 'Tus datos han sido guardados correctamente.', confirmText: 'Aceptar' });
      },
      error: (err) => {
        console.error('Error al actualizar perfil:', err);
        this.toastService.error('No fue posible actualizar tu perfil');
      }
    });
  }
}
