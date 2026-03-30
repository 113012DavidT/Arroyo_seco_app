import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { OfflineSyncService } from '../services/offline-sync.service';
import { OfflineCacheService } from '../services/offline-cache.service';
import { ToastService } from '../../shared/services/toast.service';
import { of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHEABLE_GET_DENY = [/\/auth\//i, /\/login$/i, /\/register$/i, /\/me$/i];

function canCacheGet(url: string): boolean {
  return !CACHEABLE_GET_DENY.some((pattern) => pattern.test(url));
}

export const offlineQueueInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const offline = inject(OfflineSyncService);
  const cache = inject(OfflineCacheService);
  const toast = inject(ToastService);

  const isApiRequest = req.url.startsWith(api.baseUrl);
  if (!isApiRequest) {
    return next(req);
  }

  const method = req.method.toUpperCase();
  const isMutation = MUTATION_METHODS.has(method);
  const isGet = method === 'GET';

  if (isGet && canCacheGet(req.url)) {
    const cacheKey = cache.keyFromUrl(req.urlWithParams);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = cache.get<any>(cacheKey);
      if (cached !== null) {
        return of(new HttpResponse({ status: 200, body: cached }));
      }
      return throwError(() => new HttpErrorResponse({
        status: 0,
        url: req.url,
        error: { message: 'Sin conexion y sin datos en cache local' }
      }));
    }

    return next(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && event.ok) {
          cache.set(cacheKey, event.body, 1000 * 60 * 60 * 6);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 0) return throwError(() => error);

        const cached = cache.get<any>(cacheKey);
        if (cached !== null) {
          return of(new HttpResponse({ status: 200, body: cached }));
        }

        return throwError(() => error);
      })
    );
  }

  if (!isMutation) {
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
