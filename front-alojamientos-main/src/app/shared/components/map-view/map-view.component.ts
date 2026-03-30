import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <iframe
      class="map-view"
      [src]="mapUrl"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen>
    </iframe>
  `,
  styles: [`
    .map-view {
      width: 100%;
      min-height: 280px;
      border: 0;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
    }
  `]
})
export class MapViewComponent {
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  @Input() zoom = 15;

  constructor(private readonly sanitizer: DomSanitizer) {}

  get mapUrl(): SafeResourceUrl {
    const lat = this.latitud ?? 21.2569;
    const lng = this.longitud ?? -99.9897;
    const z = Math.max(3, Math.min(20, this.zoom));
    const url = `https://www.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
