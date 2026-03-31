import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

declare global {
  interface Window {
    __env?: {
      API_BASE_URL?: string;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  // Runtime backend URL for Docker/servers. Fallback keeps local behavior.
  readonly backendUrl = this.resolveBackendUrl();
  readonly baseUrl = this.backendUrl.toLowerCase().endsWith('/api')
    ? this.backendUrl
    : `${this.backendUrl}/api`;

  constructor() { }

  private resolveBackendUrl(): string {
    const runtime = window.__env?.API_BASE_URL?.trim();
    const configured = runtime || '/api';
    return configured.replace(/\/+$/, '');
  }

  private url(path: string) {
    // Ensure no double slashes
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  toPublicAssetUrl(path: string | null | undefined): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path) || path.startsWith('assets/')) {
      return path;
    }

    if (path.startsWith('/comprobantes/')) {
      const relativePath = path.replace(/^\/comprobantes\//i, '');
      return `${this.baseUrl}/Storage/public/${relativePath}`;
    }

    if (path.startsWith('/')) {
      const apiRoot = this.baseUrl.replace(/\/api$/i, '');
      return `${apiRoot}${path}`;
    }

    return `${this.baseUrl}/Storage/public/${path.replace(/^\/+/, '')}`;
  }

  get<T>(path: string, params?: HttpParams | { [key: string]: string | number | boolean }, headers?: HttpHeaders): Observable<T> {
    return this.http.get<T>(this.url(path), { params: params as any, headers });
  }

  // Descarga de binarios (e.g., comprobantes)
  getBlob(path: string): Observable<Blob> {
    return this.http.get(this.url(path), { responseType: 'blob' as 'json' }) as any;
  }

  post<T>(path: string, body: any, headers?: HttpHeaders): Observable<T> {
    return this.http.post<T>(this.url(path), body, { headers });
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  patch<T>(path: string, body: any): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }
}
