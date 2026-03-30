import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  direccion: string;
  sexo: string;
  role?: string;
}

export interface CompletarPerfilPayload {
  direccion: string;
  sexo: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly tokenKey = 'as_token';
  private readonly pendingLoginKey = 'as_pending_login';

  constructor() { }

  private saveToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }

  setToken(token: string) {
    this.saveToken(token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const payload = this.decodeJwt(token);
    if (!payload) {
      this.logout();
      return false;
    }
    // Verificar expiración (claim estándar "exp")
    const expClaimNames = ['exp', 'EXP', 'Exp'];
    let expValue: number | null = null;
    for (const key of expClaimNames) {
      if (payload[key]) {
        expValue = Number(payload[key]);
        break;
      }
    }
    if (expValue && !isNaN(expValue)) {
      const nowSeconds = Date.now() / 1000;
      if (nowSeconds >= expValue) {
        // Token expirado
        this.logout();
        return false;
      }
    }
    return true;
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.pendingLoginKey);
  }

  // --- Roles & user info helpers from JWT ---
  private decodeJwt(token: string): any | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
      try {
        // Fallback without unicode handling
        return JSON.parse(atob(token.split('.')[1]));
      } catch {
        return null;
      }
    }
  }

  getRoles(): string[] {
    const token = this.getToken();
    if (!token) return [];
    const payload = this.decodeJwt(token);
    if (!payload) return [];
    const roleClaimKeys = [
      'role',
      'roles',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
    ];
    for (const key of roleClaimKeys) {
      const value = payload[key];
      if (!value) continue;
      if (Array.isArray(value)) return value.map((v: any) => String(v));
      return [String(value)];
    }
    return [];
  }

  isAdmin(): boolean {
    return this.getRoles().some(r => /admin/i.test(r));
  }

  getTipoNegocio(): number | null {
    const token = this.getToken();
    if (!token) return null;
    const payload = this.decodeJwt(token);
    if (!payload) return null;

    // Buscar en diferentes posibles nombres de claim
    const tipo = payload['TipoOferente'] ||
                 payload['tipoOferente'] ||
                 payload['tipo_oferente'] ||
                 payload['Tipo'];

    return tipo ? Number(tipo) : null;
  }

  getUserId(): string | null {
    const token = this.getToken();
    if (!token) return null;
    const payload = this.decodeJwt(token);
    if (!payload) return null;

    const keys = [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      'nameidentifier',
      'sub',
      'userId',
      'UsuarioId',
      'id'
    ];

    for (const key of keys) {
      if (payload[key]) return String(payload[key]);
    }

    return null;
  }

  requiereCambioPassword(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const payload = this.decodeJwt(token);
    if (!payload) return false;
    
    const requiere = payload['RequiereCambioPassword'] || 
                     payload['requiereCambioPassword'] || 
                     payload['requiresPasswordChange'];
    
    return requiere === 'True' || requiere === true || requiere === 'true';
  }

  login(payload: LoginPayload): Observable<any> {
    return this.api.post<any>('/auth/login', payload).pipe(
      tap(res => {
        const token = res?.token || res?.accessToken || res?.jwt;
        if (token) this.saveToken(token);
      })
    );
  }

  register(payload: RegisterPayload): Observable<any> {
    return this.api.post<any>('/auth/register', payload);
  }

  completarPerfil(payload: CompletarPerfilPayload): Observable<any> {
    return this.api.put<any>('/auth/perfil', payload);
  }

  savePendingLogin(email: string): void {
    sessionStorage.setItem(this.pendingLoginKey, JSON.stringify({ email }));
  }

  getPendingLogin(): { email: string } | null {
    try {
      const raw = sessionStorage.getItem(this.pendingLoginKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.email) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  clearPendingLogin(): void {
    sessionStorage.removeItem(this.pendingLoginKey);
  }

  me(): Observable<any> {
    return this.api.get<any>('/Auth/me');
  }
}
