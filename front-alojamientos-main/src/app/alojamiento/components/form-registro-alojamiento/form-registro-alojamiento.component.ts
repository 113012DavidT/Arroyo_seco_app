import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AlojamientoService, AlojamientoDto } from '../../services/alojamiento.service';
import { first } from 'rxjs/operators';
import { MapPickerComponent } from '../../../shared/components/map-picker/map-picker.component';

interface AlojamientoForm {
  nombre: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  direccion: string;
  huespedes: number;
  habitaciones: number;
  banos: number;
  precio: number;
  fotos: string[];
}

@Component({
  selector: 'app-form-registro-alojamiento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapPickerComponent],
  templateUrl: './form-registro-alojamiento.component.html',
  styleUrl: './form-registro-alojamiento.component.scss'
})
export class FormRegistroAlojamientoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private alojamientosService = inject(AlojamientoService);

  idEdicion: string | null = null;
  formModel: AlojamientoForm = {
    nombre: '',
    ubicacion: '',
    latitud: null,
    longitud: null,
    direccion: '',
    huespedes: 1,
    habitaciones: 1,
    banos: 1,
    precio: 0,
    fotos: []
  };
  
  autocomplete: any;
  busquedaDireccion = '';

  constructor() {
    this.idEdicion = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit(): void {
    // Ya no cargamos Google Maps - usamos campos simples
    if (this.idEdicion) {
      const id = parseInt(this.idEdicion, 10);
      if (id) {
        this.alojamientosService.getById(id).pipe(first()).subscribe({
          next: (a: AlojamientoDto) => {
            this.formModel = {
              nombre: a.nombre,
              ubicacion: a.ubicacion,
              latitud: a.latitud || null,
              longitud: a.longitud || null,
              direccion: a.direccion || a.ubicacion,
              huespedes: a.maxHuespedes,
              habitaciones: a.habitaciones,
              banos: a.banos,
              precio: a.precioPorNoche,
              fotos: [a.fotoPrincipal, ...(a.fotosUrls || [])].filter(Boolean) as string[]
            };
            this.busquedaDireccion = a.direccion || a.ubicacion;
          },
          error: () => this.toastService.error('No se pudo cargar el alojamiento')
        });
      }
    }
  }
  
  get modoTitulo(): string {
    return this.idEdicion ? 'Editar Alojamiento' : 'Agregar Alojamiento';
  }

  onLocationSelected(data: { lat: number; lng: number; address?: string }) {
    this.formModel.latitud = data.lat;
    this.formModel.longitud = data.lng;
    if (data.address) {
      this.formModel.direccion = data.address;
      this.formModel.ubicacion = data.address;
      this.toastService.success(`📍 ${data.address}`);
    } else {
      this.toastService.success('📍 Ubicación marcada en el mapa');
    }
  }

  agregarFoto(url: string) {
    if (!url) return;
    this.formModel.fotos.push(url);
  }

  eliminarFoto(idx: number) {
    this.formModel.fotos.splice(idx, 1);
  }

  onSubmit(form: NgForm) {
    if (form.invalid) return;
    
    // Las coordenadas son opcionales
    if (!this.formModel.latitud || !this.formModel.longitud) {
      console.warn('Sin coordenadas GPS, guardando solo con ubicación de texto');
    }
    
    const payload: AlojamientoDto = {
      nombre: this.formModel.nombre,
      ubicacion: this.formModel.ubicacion,
      latitud: this.formModel.latitud,
      longitud: this.formModel.longitud,
      direccion: this.formModel.direccion,
      maxHuespedes: this.formModel.huespedes,
      habitaciones: this.formModel.habitaciones,
      banos: this.formModel.banos,
      precioPorNoche: this.formModel.precio,
      fotoPrincipal: this.formModel.fotos[0] || '',
      fotosUrls: this.formModel.fotos.slice(1)
    };
    const obs = this.idEdicion
      ? this.alojamientosService.update(parseInt(this.idEdicion!, 10), payload)
      : this.alojamientosService.create(payload);

    obs.pipe(first()).subscribe({
      next: () => {
        const accion = this.idEdicion ? 'actualizado' : 'registrado';
        this.toastService.success(`Alojamiento ${accion} exitosamente`);
        this.router.navigateByUrl('/oferente/hospedajes');
      },
      error: () => this.toastService.error('No se pudo guardar el alojamiento')
    });
  }
}
