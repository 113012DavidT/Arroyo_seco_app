import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { SwUpdateComponent } from './shared/components/sw-update/sw-update.component';
import { LoadingService } from './core/services/loading.service';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { PwaPushService } from './core/services/pwa-push.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, ToastContainerComponent, ConfirmModalComponent, SwUpdateComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  loading$ = inject(LoadingService).loading$;
  private readonly _offlineSync = inject(OfflineSyncService);
  private readonly _push = inject(PwaPushService);
  private readonly _auth = inject(AuthService);

  constructor() {
    queueMicrotask(() => {
      if (!this._auth.isAuthenticated()) return;
      this._push.syncExistingSubscription().catch(() => {
        // No-op: this sync is opportunistic.
      });
    });
  }
}
