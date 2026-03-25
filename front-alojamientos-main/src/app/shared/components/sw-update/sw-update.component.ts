import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sw-update',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sw-update-banner" *ngIf="updateAvailable">
      <span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Hay una nueva versión disponible
      </span>
      <button (click)="recargar()">Actualizar ahora</button>
    </div>
  `,
  styles: [`
    .sw-update-banner {
      position: fixed;
      bottom: 1.25rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: #1f2937;
      color: #fff;
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      font-size: 0.9rem;
      white-space: nowrap;
    }
    .sw-update-banner span {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .sw-update-banner button {
      background: #E31B23;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.4rem 0.9rem;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .sw-update-banner button:hover {
      background: #c41019;
    }
  `]
})
export class SwUpdateComponent implements OnInit {
  private swUpdate = inject(SwUpdate);
  updateAvailable = false;

  ngOnInit() {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')
    ).subscribe(() => {
      this.updateAvailable = true;
    });
  }

  recargar() {
    this.swUpdate.activateUpdate().then(() => window.location.reload());
  }
}
