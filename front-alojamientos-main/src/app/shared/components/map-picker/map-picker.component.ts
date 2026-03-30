import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GOOGLE_MAPS_CONFIG } from '../../../config/maps.config';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

declare global {
  interface Window {
    google?: any;
    __asGoogleMapsPromise?: Promise<any>;
  }
}

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-picker">
      <div class="map-info">
        <p *ngIf="!latitud || !longitud">📍 Haz click en el mapa para marcar la ubicación</p>
        <div *ngIf="latitud && longitud" class="coords">
          <p class="address" *ngIf="direccionCapturada">
            ✅ <strong>{{ direccionCapturada }}</strong>
          </p>
          <p class="coords-detail">
            Coordenadas: {{ latitud.toFixed(6) }}, {{ longitud.toFixed(6) }}
          </p>
        </div>
        <p *ngIf="buscandoDireccion" class="loading">🔍 Buscando dirección...</p>
        <p *ngIf="cargandoMapa" class="loading">🗺️ Cargando Google Maps...</p>
        <p *ngIf="errorMapa" class="loading">⚠️ {{ errorMapa }}</p>
      </div>
      <div [id]="mapId" style="height: 400px; width: 100%; border-radius: 8px;"></div>
    </div>
  `,
  styles: [`
    .map-picker {
      margin: 1rem 0;
    }
    .map-info {
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: #dbeafe;
      color: #1e40af;
      font-size: 0.9rem;
    }
    .coords {
      background: #d1fae5;
      color: #065f46;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .address {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
    }
    .coords-detail {
      margin: 0;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .loading {
      background: #fef3c7;
      color: #92400e;
      padding: 0.75rem;
      border-radius: 8px;
    }
  `]
})
export class MapPickerComponent implements AfterViewInit {
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  @Output() locationSelected = new EventEmitter<LocationData>();

  readonly mapId = `map-picker-${Math.random().toString(36).slice(2, 10)}`;

  private map?: any;
  private marker?: any;
  private geocoder?: any;

  cargandoMapa = false;
  errorMapa = '';
  direccionCapturada = '';
  buscandoDireccion = false;

  ngAfterViewInit(): void {
    this.initMap().catch((error) => {
      console.error('Error inicializando Google Maps:', error);
      this.errorMapa = 'No se pudo cargar Google Maps. Verifica la API key.';
    });
  }

  private async initMap(): Promise<void> {
    this.cargandoMapa = true;
    await this.loadGoogleMaps();

    const defaultLat = this.latitud || 21.2569;
    const defaultLng = this.longitud || -99.9897;

    this.map = new window.google.maps.Map(document.getElementById(this.mapId), {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy'
    });

    this.geocoder = new window.google.maps.Geocoder();

    if (this.latitud && this.longitud) {
      this.addMarker(this.latitud, this.longitud);
      await this.getDireccion(this.latitud, this.longitud);
    }

    this.map.addListener('click', async (event: any) => {
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return;
      }

      this.addMarker(lat, lng);
      await this.getDireccion(lat, lng);
    });

    this.cargandoMapa = false;
  }

  private addMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setMap(null);
    }

    this.marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: this.map
    });

    this.latitud = lat;
    this.longitud = lng;
  }

  private async getDireccion(lat: number, lng: number): Promise<void> {
    this.buscandoDireccion = true;
    this.direccionCapturada = '';

    try {
      if (!this.geocoder) {
        throw new Error('Geocoder no disponible');
      }

      const result = await this.geocoder.geocode({ location: { lat, lng } });
      this.direccionCapturada = result?.results?.[0]?.formatted_address || '';

      this.locationSelected.emit({
        lat,
        lng,
        address: this.direccionCapturada
      });
    } catch (error) {
      console.error('Error al obtener dirección:', error);
      this.direccionCapturada = 'No se pudo obtener la dirección';
      this.locationSelected.emit({ lat, lng });
    } finally {
      this.buscandoDireccion = false;
    }
  }

  private async loadGoogleMaps(): Promise<any> {
    if (window.google?.maps) {
      return window.google.maps;
    }

    if (window.__asGoogleMapsPromise) {
      return window.__asGoogleMapsPromise;
    }

    const apiKey = GOOGLE_MAPS_CONFIG.apiKey;
    if (!apiKey || apiKey === 'TU_API_KEY_AQUI') {
      throw new Error('GOOGLE_MAPS_API_KEY no configurada');
    }

    const libraries = (GOOGLE_MAPS_CONFIG.libraries || []).join(',');
    const language = GOOGLE_MAPS_CONFIG.language || 'es';
    const src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}&language=${language}&v=weekly`;

    window.__asGoogleMapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google?.maps);
      script.onerror = () => reject(new Error('No se pudo cargar el script de Google Maps'));
      document.head.appendChild(script);
    });

    return window.__asGoogleMapsPromise;
  }
}
