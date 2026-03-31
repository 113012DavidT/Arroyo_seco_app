import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GOOGLE_MAPS_CONFIG } from '../../../config/maps.config';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

const ARROYO_SECO_POLYGON: Array<{ lat: number; lng: number }> = [
  { lat: 21.8080, lng: -100.0480 },
  { lat: 21.8120, lng: -99.9940 },
  { lat: 21.8030, lng: -99.9360 },
  { lat: 21.7810, lng: -99.8770 },
  { lat: 21.7520, lng: -99.8220 },
  { lat: 21.7280, lng: -99.7770 },
  { lat: 21.7010, lng: -99.7330 },
  { lat: 21.6710, lng: -99.6910 },
  { lat: 21.6390, lng: -99.6610 },
  { lat: 21.6070, lng: -99.6440 },
  { lat: 21.5790, lng: -99.6380 },
  { lat: 21.5480, lng: -99.6460 },
  { lat: 21.5210, lng: -99.6670 },
  { lat: 21.4950, lng: -99.7030 },
  { lat: 21.4730, lng: -99.7480 },
  { lat: 21.4560, lng: -99.8010 },
  { lat: 21.4470, lng: -99.8610 },
  { lat: 21.4510, lng: -99.9140 },
  { lat: 21.4680, lng: -99.9650 },
  { lat: 21.4940, lng: -100.0060 },
  { lat: 21.5310, lng: -100.0360 },
  { lat: 21.5690, lng: -100.0530 },
  { lat: 21.6160, lng: -100.0600 },
  { lat: 21.6630, lng: -100.0570 },
  { lat: 21.7050, lng: -100.0460 },
  { lat: 21.7430, lng: -100.0340 },
  { lat: 21.7760, lng: -100.0280 },
  { lat: 21.8080, lng: -100.0480 }
];

const ARROYO_SECO_BOUNDS = {
  north: Math.max(...ARROYO_SECO_POLYGON.map((p) => p.lat)),
  south: Math.min(...ARROYO_SECO_POLYGON.map((p) => p.lat)),
  west: Math.min(...ARROYO_SECO_POLYGON.map((p) => p.lng)),
  east: Math.max(...ARROYO_SECO_POLYGON.map((p) => p.lng))
};

const ARROYO_SECO_CENTER = {
  lat: 21.62,
  lng: -99.77
};

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
        <p *ngIf="!latitud || !longitud">📍 Haz click en el mapa para marcar la ubicación dentro de Arroyo Seco</p>
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

    const defaultLat = this.latitud || ARROYO_SECO_CENTER.lat;
    const defaultLng = this.longitud || ARROYO_SECO_CENTER.lng;

    this.map = new window.google.maps.Map(document.getElementById(this.mapId), {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      restriction: {
        latLngBounds: ARROYO_SECO_BOUNDS,
        strictBounds: true
      }
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

      if (!this.isInsideArroyoSeco(lat, lng)) {
        this.errorMapa = 'Solo puedes seleccionar ubicaciones dentro de Arroyo Seco, Querétaro.';
        return;
      }

      this.errorMapa = '';

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

  private isInsideArroyoSeco(lat: number, lng: number): boolean {
    if (lat < ARROYO_SECO_BOUNDS.south || lat > ARROYO_SECO_BOUNDS.north || lng < ARROYO_SECO_BOUNDS.west || lng > ARROYO_SECO_BOUNDS.east) {
      return false;
    }

    let inside = false;
    let j = ARROYO_SECO_POLYGON.length - 1;

    for (let i = 0; i < ARROYO_SECO_POLYGON.length; i++) {
      const xi = ARROYO_SECO_POLYGON[i].lng;
      const yi = ARROYO_SECO_POLYGON[i].lat;
      const xj = ARROYO_SECO_POLYGON[j].lng;
      const yj = ARROYO_SECO_POLYGON[j].lat;

      const intersects = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);

      if (intersects) {
        inside = !inside;
      }

      j = i;
    }

    return inside;
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
