import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SwPush } from '@angular/service-worker';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

interface PublicKeyResponse {
  publicKey: string;
}

@Injectable({ providedIn: 'root' })
export class PwaPushService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private vapidPublicKey: string | null = null;

  isSupported(): boolean {
    return this.swPush.isEnabled && typeof Notification !== 'undefined';
  }

  async hasActiveSubscription(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const sub = await firstValueFrom(this.swPush.subscription);
    return !!sub;
  }

  async enablePush(): Promise<boolean> {
    if (!this.isSupported() || !this.auth.isAuthenticated()) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const key = await this.getPublicKey();
    if (!key) return false;

    let sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) {
      sub = await this.swPush.requestSubscription({ serverPublicKey: key });
    }

    await firstValueFrom(this.api.post('/push/subscribe', this.toSubscriptionDto(sub)));
    return true;
  }

  async disablePush(): Promise<boolean> {
    if (!this.isSupported() || !this.auth.isAuthenticated()) return false;

    const sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) return true;

    await firstValueFrom(this.api.post('/push/unsubscribe', { endpoint: sub.endpoint }));
    await sub.unsubscribe();
    return true;
  }

  async syncExistingSubscription(): Promise<void> {
    if (!this.isSupported() || !this.auth.isAuthenticated()) return;
    if (Notification.permission !== 'granted') return;

    const sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) return;

    await firstValueFrom(this.api.post('/push/subscribe', this.toSubscriptionDto(sub)));
  }

  async sendTest(): Promise<void> {
    await firstValueFrom(this.api.post('/push/test', {}));
  }

  private async getPublicKey(): Promise<string | null> {
    if (this.vapidPublicKey) return this.vapidPublicKey;

    const res = await firstValueFrom(this.api.get<PublicKeyResponse>('/push/public-key'));
    const key = (res?.publicKey || '').trim();
    this.vapidPublicKey = key || null;
    return this.vapidPublicKey;
  }

  private toSubscriptionDto(sub: PushSubscription) {
    const json = sub.toJSON();
    const keys = (json?.keys || {}) as Record<string, string | undefined>;
    return {
      endpoint: sub.endpoint,
      p256dh: keys['p256dh'] || '',
      auth: keys['auth'] || '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };
  }
}
