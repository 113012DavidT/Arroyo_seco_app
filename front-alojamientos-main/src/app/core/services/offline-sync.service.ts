import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { HttpBackend } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ToastService } from '../../shared/services/toast.service';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, finalize, map, tap } from 'rxjs/operators';

interface QueuedRequest {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: any;
  headers: Record<string, string>;
  createdAt: number;
  retries: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly storageKey = 'offline-request-queue-v1';
  private readonly maxRetries = 3;
  private readonly toast = inject(ToastService);
  private readonly http = new HttpClient(inject(HttpBackend));
  private syncing = false;

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.flushQueue().subscribe();
    });

    // Attempt sync after boot if there are pending requests.
    setTimeout(() => {
      this.flushQueue().subscribe();
    }, 2000);
  }

  canQueueBody(body: unknown): boolean {
    return !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer);
  }

  enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'retries'>): number {
    const queue = this.readQueue();
    queue.push({
      ...req,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: Date.now(),
      retries: 0
    });
    this.writeQueue(queue);
    return queue.length;
  }

  queueSize(): number {
    return this.readQueue().length;
  }

  getQueuedRequests(): Array<Pick<QueuedRequest, 'method' | 'url' | 'body' | 'createdAt'>> {
    return this.readQueue().map((r) => ({
      method: r.method,
      url: r.url,
      body: r.body,
      createdAt: r.createdAt
    }));
  }

  flushQueue(): Observable<number> {
    if (this.syncing || typeof navigator === 'undefined' || !navigator.onLine) {
      return of(0);
    }

    const queue = this.readQueue();
    if (!queue.length) return of(0);

    this.syncing = true;
    let sent = 0;

    return from(queue).pipe(
      concatMap((request) => this.sendQueuedRequest(request).pipe(
        tap((ok) => {
          if (ok) sent += 1;
        })
      )),
      finalize(() => {
        this.syncing = false;
        const remaining = this.queueSize();
        if (sent > 0) {
          this.toast.success(`Sincronizacion completada: ${sent} solicitud(es) enviada(s)`);
        }
        if (remaining > 0) {
          this.toast.warning(`Quedaron ${remaining} solicitud(es) pendientes por sincronizar`);
        }
      }),
      map(() => sent),
      catchError(() => {
        this.syncing = false;
        return of(sent);
      })
    );
  }

  private sendQueuedRequest(request: QueuedRequest): Observable<boolean> {
    const headers = new HttpHeaders(request.headers || {});

    return this.http.request(request.method, request.url, {
      body: request.body,
      headers,
      observe: 'response'
    }).pipe(
      map((response: HttpResponse<unknown>) => {
        if (response.ok) {
          this.removeQueuedRequest(request.id);
          return true;
        }
        this.markRetry(request.id);
        return false;
      }),
      catchError(() => {
        this.markRetry(request.id);
        return of(false);
      })
    );
  }

  private markRetry(id: string): void {
    const queue = this.readQueue();
    const idx = queue.findIndex((r) => r.id === id);
    if (idx < 0) return;

    queue[idx].retries += 1;
    // No eliminar automaticamente: mantenemos la cola para reintentar al reconectar.
    if (queue[idx].retries > this.maxRetries) {
      queue[idx].retries = this.maxRetries;
    }
    this.writeQueue(queue);
  }

  private removeQueuedRequest(id: string): void {
    const queue = this.readQueue().filter((r) => r.id !== id);
    this.writeQueue(queue);
  }

  private readQueue(): QueuedRequest[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedRequest[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
  }
}
