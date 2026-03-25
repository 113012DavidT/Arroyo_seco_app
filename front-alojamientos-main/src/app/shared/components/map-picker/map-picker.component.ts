import { Component, EventEmitter, Input, OnInit, Output, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
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
      </div>
      <div id="map" style="height: 400px; width: 100%; border-radius: 8px;"></div>
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

  private map!: L.Map;
  private marker?: L.Marker;
  
  direccionCapturada = '';
  buscandoDireccion = false;

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    // Centro predeterminado: Arroyo Seco, Querétaro
    const defaultLat = this.latitud || 21.2569;
    const defaultLng = this.longitud || -99.9897;

    this.map = L.map('map').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Si ya hay coordenadas, agregar marcador
    if (this.latitud && this.longitud) {
      this.addMarker(this.latitud, this.longitud);
      this.getDireccion(this.latitud, this.longitud);
    }

    // Click en el mapa para agregar/mover marcador
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.addMarker(lat, lng);
      this.getDireccion(lat, lng);
    });
  }

  private addMarker(lat: number, lng: number): void {
    // Remover marcador anterior si existe
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Agregar nuevo marcador
    this.marker = L.marker([lat, lng]).addTo(this.map);
    this.latitud = lat;
    this.longitud = lng;
  }

  private async getDireccion(lat: number, lng: number): Promise<void> {
    this.buscandoDireccion = true;
    this.direccionCapturada = '';

    try {
      // Geocodificación inversa con Nominatim (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener dirección');
      }

      const data = await response.json();
      
      // Construir dirección legible
      const address = data.address;
      const partes = [];
      
      if (address.road) partes.push(address.road);
      if (address.house_number) partes[0] = `${address.road} ${address.house_number}`;
      if (address.suburb || address.neighbourhood) partes.push(address.suburb || address.neighbourhood);
      if (address.city || address.town || address.village) partes.push(address.city || address.town || address.village);
      if (address.state) partes.push(address.state);

      this.direccionCapturada = partes.join(', ') || data.display_name;

      // Emitir evento con coordenadas y dirección
      this.locationSelected.emit({
        lat,
        lng,
        address: this.direccionCapturada
      });

    } catch (error) {
      console.error('Error al obtener dirección:', error);
      this.direccionCapturada = 'No se pudo obtener la dirección';
      
      // Emitir solo con coordenadas
      this.locationSelected.emit({ lat, lng });
    } finally {
      this.buscandoDireccion = false;
    }
  }
}
