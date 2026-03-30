import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, firstValueFrom, tap } from 'rxjs';

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

interface PasskeyCredentialResponse {
  token?: string;
  accessToken?: string;
  jwt?: string;
}

export interface PasskeyAvailability {
  supported: boolean;
  hasCredential: boolean;
  reason?: string;
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

  supportsPasskeys(): boolean {
    return typeof window !== 'undefined' &&
      typeof PublicKeyCredential !== 'undefined' &&
      !!navigator.credentials;
  }

  async canUsePlatformAuthenticator(): Promise<boolean> {
    if (!this.supportsPasskeys()) return false;

    const checker = (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof checker !== 'function') {
      return true;
    }

    try {
      return await checker.call(PublicKeyCredential);
    } catch {
      return false;
    }
  }

  async checkPasskeyAvailability(email: string): Promise<PasskeyAvailability> {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail) {
      return {
        supported: this.supportsPasskeys(),
        hasCredential: false,
        reason: 'EMAIL_REQUIRED'
      };
    }

    if (!this.supportsPasskeys()) {
      return {
        supported: false,
        hasCredential: false,
        reason: 'WEB_AUTHN_NOT_SUPPORTED'
      };
    }

    const canUsePlatform = await this.canUsePlatformAuthenticator();
    if (!canUsePlatform) {
      return {
        supported: false,
        hasCredential: false,
        reason: 'PLATFORM_AUTHENTICATOR_NOT_AVAILABLE'
      };
    }

    try {
      const options = await firstValueFrom(
        this.api.post<any>('/auth/passkey/login/options', { email: trimmedEmail })
      );

      const allowCredentials = Array.isArray(options?.allowCredentials)
        ? options.allowCredentials.length
        : 0;

      return {
        supported: true,
        hasCredential: allowCredentials > 0,
        reason: allowCredentials > 0 ? undefined : 'NO_REGISTERED_PASSKEY'
      };
    } catch {
      return {
        supported: true,
        hasCredential: false,
        reason: 'PASSKEY_LOOKUP_FAILED'
      };
    }
  }

  async loginWithPasskey(email: string): Promise<PasskeyCredentialResponse> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('El email es obligatorio para iniciar con biometria');

    const options = await firstValueFrom(
      this.api.post<any>('/auth/passkey/login/options', { email: trimmedEmail })
    );

    const credential = await navigator.credentials.get({
      publicKey: this.toPublicKeyRequestOptions(options)
    }) as PublicKeyCredential | null;

    if (!credential) throw new Error('No se pudo obtener la credencial biometrica');

    const assertionPayload = this.serializeAssertionCredential(credential);
    const response = await firstValueFrom(
      this.api.post<PasskeyCredentialResponse>('/auth/passkey/login/verify', {
        email: trimmedEmail,
        credential: assertionPayload
      })
    );

    const token = response?.token || response?.accessToken || response?.jwt;
    if (token) this.saveToken(token);

    return response;
  }

  async registerCurrentDevicePasskey(deviceName: string): Promise<any> {
    const name = (deviceName || 'Dispositivo biometrico').trim();

    const options = await firstValueFrom(
      this.api.post<any>('/auth/passkey/register/options', { deviceName: name })
    );

    const credential = await navigator.credentials.create({
      publicKey: this.toPublicKeyCreationOptions(options)
    }) as PublicKeyCredential | null;

    if (!credential) throw new Error('No se pudo registrar la credencial biometrica');

    const attestationPayload = this.serializeAttestationCredential(credential);

    return await firstValueFrom(
      this.api.post<any>('/auth/passkey/register/verify', {
        deviceName: name,
        credential: attestationPayload
      })
    );
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

  private toPublicKeyCreationOptions(options: any): PublicKeyCredentialCreationOptions {
    return {
      ...options,
      challenge: this.base64UrlToArrayBuffer(options.challenge),
      user: {
        ...options.user,
        id: this.base64UrlToArrayBuffer(options.user.id)
      },
      excludeCredentials: (options.excludeCredentials || []).map((cred: any) => ({
        ...cred,
        id: this.base64UrlToArrayBuffer(cred.id)
      }))
    };
  }

  private toPublicKeyRequestOptions(options: any): PublicKeyCredentialRequestOptions {
    return {
      ...options,
      challenge: this.base64UrlToArrayBuffer(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((cred: any) => ({
        ...cred,
        id: this.base64UrlToArrayBuffer(cred.id)
      }))
    };
  }

  private serializeAttestationCredential(credential: PublicKeyCredential): any {
    const response = credential.response as AuthenticatorAttestationResponse;
    return {
      id: credential.id,
      rawId: this.arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        attestationObject: this.arrayBufferToBase64Url(response.attestationObject)
      }
    };
  }

  private serializeAssertionCredential(credential: PublicKeyCredential): any {
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      id: credential.id,
      rawId: this.arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.arrayBufferToBase64Url(response.clientDataJSON),
        authenticatorData: this.arrayBufferToBase64Url(response.authenticatorData),
        signature: this.arrayBufferToBase64Url(response.signature),
        userHandle: response.userHandle ? this.arrayBufferToBase64Url(response.userHandle) : null
      }
    };
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
