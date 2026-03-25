import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { OfflineSyncService } from '../services/offline-sync.service';
import { ToastService } from '../../shared/services/toast.service';
import { of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const offlineQueueInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const offline = inject(OfflineSyncService);
  const toast = inject(ToastService);

  const isMutation = MUTATION_METHODS.has(req.method.toUpperCase());
  const isApiRequest = req.url.startsWith(api.baseUrl);

  if (!isMutation || !isApiRequest) {
    return next(req);
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (!offline.canQueueBody(req.body)) {
      toast.error('Sin internet: este tipo de envio no puede quedar en cola offline');
      return throwError(() => new HttpErrorResponse({ status: 0, url: req.url, error: { message: 'No se puede encolar sin conexion' } }));
    }

    const headers: Record<string, string> = {};
    req.headers.keys().forEach((key) => {
      const value = req.headers.get(key);
      if (value !== null) headers[key] = value;
    });

    const queued = offline.enqueue({
      method: req.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: req.url,
      body: req.body,
      headers
    });

    toast.info(`Sin internet: solicitud guardada en cola (${queued} pendiente(s))`, 4500);

    return of(new HttpResponse({
      status: 202,
      body: {
        queuedOffline: true,
        pending: queued,
        message: 'Solicitud encolada para sincronizar al reconectar'
      }
    }));
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const networkFailure = error.status === 0;
      if (!networkFailure) {
        return throwError(() => error);
      }

      if (!offline.canQueueBody(req.body)) {
        return throwError(() => error);
      }

      const headers: Record<string, string> = {};
      req.headers.keys().forEach((key) => {
        const value = req.headers.get(key);
        if (value !== null) headers[key] = value;
      });

      const queued = offline.enqueue({
        method: req.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: req.url,
        body: req.body,
        headers
      });

      toast.info(`Conexion interrumpida: solicitud guardada en cola (${queued} pendiente(s))`, 4500);

      return of(new HttpResponse({
        status: 202,
        body: {
          queuedOffline: true,
          pending: queued,
          message: 'Solicitud encolada tras fallo de red'
        }
      }));
    })
  );
};
