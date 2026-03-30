import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="map-view" [id]="mapId"></div>',
  styles: [`
    .map-view {
      width: 100%;
      min-height: 280px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
    }
  `]
})
export class MapViewComponent implements AfterViewInit, OnChanges {
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  @Input() zoom = 15;

  readonly mapId = `map-view-${Math.random().toString(36).slice(2, 10)}`;
  private map?: L.Map;
  private marker?: L.Marker;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) {
      return;
    }

    if (changes['latitud'] || changes['longitud'] || changes['zoom']) {
      this.renderMarker();
    }
  }

  private initMap(): void {
    const lat = this.latitud ?? 21.2569;
    const lng = this.longitud ?? -99.9897;

    this.map = L.map(this.mapId, {
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false
    }).setView([lat, lng], this.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.initialized = true;
    this.renderMarker();

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private renderMarker(): void {
    if (!this.map || this.latitud == null || this.longitud == null) {
      return;
    }

    const position: L.LatLngExpression = [this.latitud, this.longitud];
    this.map.setView(position, this.zoom);

    if (!this.marker) {
      this.marker = L.marker(position).addTo(this.map);
      return;
    }

    this.marker.setLatLng(position);
  }
}