import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface PerfilUpdateDto {
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  sexo?: string;
}

export interface PasswordUpdateDto {
  passwordActual: string;
  nuevaPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly api = inject(ApiService);

  updatePerfil(payload: PerfilUpdateDto): Observable<any> {
    return this.api.put('/auth/perfil', payload).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  cambiarPassword(payload: PasswordUpdateDto): Observable<any> {
    return this.api.post('/auth/cambiar-password', payload).pipe(
      catchError((err) => throwError(() => err))
    );
  }
}
