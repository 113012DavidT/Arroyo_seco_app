import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { first } from 'rxjs/operators';
import { ConfirmModalService } from '../../../shared/services/confirm-modal.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AdminUserDto, AdminUsuariosService } from '../../services/admin-usuarios.service';

interface UsuarioSistema {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  roles: string[];
  accessFailedCount: number;
  lockoutEnd?: string | null;
  isLocked: boolean;
}

interface NuevoAdminForm {
  nombre: string;
  email: string;
  telefono: string;
  codigo: string;
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: '../admin-oferentes-gastronomia/admin-oferentes-gastronomia.component.scss'
})
export class AdminUsuariosComponent implements OnInit {
  private readonly toastService = inject(ToastService);
  private readonly usuariosService = inject(AdminUsuariosService);
  private readonly confirmModal = inject(ConfirmModalService);

  usuarios: UsuarioSistema[] = [];
  userSearchTerm = '';
  modalEditarUsuarioAbierto = false;
  modalRegistroAdminAbierto = false;
  usuarioEditar: UsuarioSistema | null = null;
  nuevoAdmin: NuevoAdminForm = this.createEmptyAdmin();
  codigoEnviado = false;
  enviandoCodigo = false;
  creandoAdmin = false;

  ngOnInit(): void {
    this.loadUsuarios();
  }

  get filteredUsuarios(): UsuarioSistema[] {
    const term = this.userSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.usuarios;
    }

    return this.usuarios.filter((usuario) =>
      [usuario.nombre, usuario.email, usuario.telefono, usuario.roles.join(', ')]
        .some((value) => value?.toLowerCase().includes(term))
    );
  }

  private loadUsuarios(): void {
    this.usuariosService.listUsuarios().pipe(first()).subscribe({
      next: (data: AdminUserDto[]) => {
        this.usuarios = (data || []).map((u) => ({
          id: u.id,
          nombre: u.nombre || '',
          email: u.email || '',
          telefono: u.telefono || '',
          roles: u.roles || [],
          accessFailedCount: u.accessFailedCount || 0,
          lockoutEnd: u.lockoutEnd || null,
          isLocked: !!u.isLocked
        }));
      },
      error: () => this.toastService.error('Error al cargar usuarios del sistema')
    });
  }

  abrirEditarUsuario(usuario: UsuarioSistema): void {
    this.usuarioEditar = { ...usuario, roles: [...usuario.roles] };
    this.modalEditarUsuarioAbierto = true;
  }

  cerrarEditarUsuario(): void {
    this.usuarioEditar = null;
    this.modalEditarUsuarioAbierto = false;
  }

  guardarEditarUsuario(form: NgForm): void {
    if (form.invalid || !this.usuarioEditar?.id) {
      return;
    }

    this.usuariosService.updateUsuario(this.usuarioEditar.id, {
      nombre: this.usuarioEditar.nombre,
      email: this.usuarioEditar.email,
      telefono: this.usuarioEditar.telefono
    }).pipe(first()).subscribe({
      next: () => {
        this.toastService.success('Usuario actualizado correctamente');
        this.cerrarEditarUsuario();
        this.loadUsuarios();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar el usuario')
    });
  }

  desbloquearUsuario(usuario: UsuarioSistema): void {
    this.usuariosService.desbloquearUsuario(usuario.id).pipe(first()).subscribe({
      next: () => {
        this.toastService.success('Cuenta desbloqueada');
        this.loadUsuarios();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo desbloquear la cuenta')
    });
  }

  async eliminarUsuario(usuario: UsuarioSistema): Promise<void> {
    const ok = await this.confirmModal.confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar al usuario "${usuario.email}"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDangerous: true
    });

    if (!ok) {
      return;
    }

    this.usuariosService.deleteUsuario(usuario.id).pipe(first()).subscribe({
      next: () => {
        this.toastService.success('Usuario eliminado');
        this.loadUsuarios();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo eliminar el usuario')
    });
  }

  abrirRegistroAdmin(): void {
    this.nuevoAdmin = this.createEmptyAdmin();
    this.codigoEnviado = false;
    this.modalRegistroAdminAbierto = true;
  }

  cerrarRegistroAdmin(): void {
    this.modalRegistroAdminAbierto = false;
    this.nuevoAdmin = this.createEmptyAdmin();
    this.codigoEnviado = false;
    this.enviandoCodigo = false;
    this.creandoAdmin = false;
  }

  solicitarCodigo(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.enviandoCodigo = true;
    this.usuariosService.solicitarCodigoAltaAdmin({
      nombre: this.nuevoAdmin.nombre,
      email: this.nuevoAdmin.email,
      telefono: this.nuevoAdmin.telefono
    }).pipe(first()).subscribe({
      next: (response) => {
        this.codigoEnviado = true;
        this.toastService.success(response?.message || 'Se envio el codigo de seguridad al correo del administrador');
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo enviar el codigo de seguridad'),
      complete: () => { this.enviandoCodigo = false; }
    });
  }

  crearAdmin(form: NgForm): void {
    if (form.invalid || !this.codigoEnviado) {
      form.control.markAllAsTouched();
      return;
    }

    this.creandoAdmin = true;
    this.usuariosService.confirmarAltaAdmin({
      nombre: this.nuevoAdmin.nombre,
      email: this.nuevoAdmin.email,
      telefono: this.nuevoAdmin.telefono,
      codigo: this.nuevoAdmin.codigo
    }).pipe(first()).subscribe({
      next: () => {
        this.toastService.success('Administrador creado correctamente');
        this.cerrarRegistroAdmin();
        this.loadUsuarios();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo crear el administrador'),
      complete: () => { this.creandoAdmin = false; }
    });
  }

  private createEmptyAdmin(): NuevoAdminForm {
    return {
      nombre: '',
      email: '',
      telefono: '',
      codigo: ''
    };
  }
}