import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

export interface AdminUserDto {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  roles: string[];
  lockoutEnabled: boolean;
  lockoutEnd?: string | null;
  accessFailedCount: number;
  isLocked: boolean;
}

export interface CreateAdminRequest {
  nombre: string;
  email: string;
  telefono: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsuariosService {
  private readonly api = inject(ApiService);

  listUsuarios(): Observable<AdminUserDto[]> {
    return this.api.get<AdminUserDto[]>('/admin/usuarios');
  }

  updateUsuario(id: string, payload: { nombre?: string; email?: string; telefono?: string }): Observable<any> {
    return this.api.put(`/admin/usuarios/${id}`, payload);
  }

  desbloquearUsuario(id: string): Observable<any> {
    return this.api.post(`/admin/usuarios/${id}/desbloquear`, {});
  }

  deleteUsuario(id: string): Observable<any> {
    return this.api.delete(`/admin/usuarios/${id}`);
  }

  solicitarCodigoAltaAdmin(payload: CreateAdminRequest): Observable<any> {
    return this.api.post('/admin/usuarios/admins/solicitar-codigo', payload);
  }

  confirmarAltaAdmin(payload: CreateAdminRequest & { codigo: string }): Observable<any> {
    return this.api.post('/admin/usuarios/admins/confirmar', payload);
  }
}