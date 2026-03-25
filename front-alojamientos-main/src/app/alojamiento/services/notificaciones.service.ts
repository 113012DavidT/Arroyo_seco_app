import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpHeaders } from '@angular/common/http';

export interface NotificacionDto {
  id: number | string;
  mensaje: string;
  titulo?: string;
  fecha?: string;
  leida?: boolean;
  tipo?: string;
  urlAccion?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly api = inject(ApiService);

  list(soloNoLeidas = false): Observable<NotificacionDto[]> {
    // Intento principal en minúsculas; si falla, probar variante con mayúscula
    return this.api.get<NotificacionDto[]>(`/notificaciones`).pipe(
      catchError(err => this.api.get<NotificacionDto[]>(`/Notificaciones`))
    );
  }

  marcarLeida(id: number | string): Observable<any> {
    // Estrategia tolerante: probar PUT minúsculas → PATCH → PUT mayúscula → POST
    return this.api.put(`/notificaciones/${id}/leer`, {}).pipe(
      catchError(err1 => this.api.patch(`/notificaciones/${id}/leer`, {}).pipe(
        catchError(err2 => this.api.put(`/Notificaciones/${id}/leer`, {}).pipe(
          catchError(err3 => this.api.post(`/notificaciones/${id}/leer`, {}).pipe(
            catchError(() => throwError(() => err1))
          ))
        ))
      ))
    );
  }

  eliminar(id: number | string): Observable<any> {
    return this.api.delete(`/notificaciones/${id}`);
  }

  crear(payload: { titulo?: string; mensaje: string; destinoRol?: 'oferente' | 'admin'; modulo?: 'alojamiento' | 'gastronomia'; referenciaId?: number | string }): Observable<any> {
    const body = {
      titulo: payload.titulo || 'Nueva reserva',
      mensaje: payload.mensaje,
      destinoRol: payload.destinoRol || 'oferente',
      modulo: payload.modulo || 'alojamiento',
      referenciaId: payload.referenciaId
    };
    // Header para que el interceptor omita el log de error (petición opcional)
    const silentHeaders = new HttpHeaders({ 'X-Skip-Error-Log': 'true' });
    return this.api.post('/notificaciones', body, silentHeaders).pipe(
      // Si falla, probar variante PascalCase y si también falla, devolver null sin propagar error
      catchError(() => this.api.post('/Notificaciones', {
        Titulo: body.titulo,
        Mensaje: body.mensaje,
        DestinoRol: body.destinoRol,
        Modulo: body.modulo,
        ReferenciaId: body.referenciaId
      }, silentHeaders).pipe(
        catchError(err2 => {
          console.warn('Creación de notificación no soportada, se ignora:', err2?.status);
          return of(null);
        })
      ))
    );
  }
}
