import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GastronomiaService, EstablecimientoDto } from '../../services/gastronomia.service';
import { ToastService } from '../../../shared/services/toast.service';
import { first } from 'rxjs/operators';
import { MapPickerComponent } from '../../../shared/components/map-picker/map-picker.component';

@Component({
  selector: 'app-form-establecimiento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapPickerComponent],
  templateUrl: './form-establecimiento.component.html',
  styleUrl: './form-establecimiento.component.scss'
})
export class FormEstablecimientoComponent implements OnInit {
  readonly nombrePattern = "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s.'-]{3,120}$";
  readonly minDescripcionLength = 15;
  readonly maxDescripcionLength = 1000;

  establecimiento: EstablecimientoDto = {
    nombre: '',
    ubicacion: '',
    descripcion: '',
    fotoPrincipal: ''
  };
  
  isEdit = false;
  submitting = false;
  subiendoFotos = false;

  readonly tiposEstablecimiento = [
    { key: 'restaurante', label: 'Restaurante' },
    { key: 'bar', label: 'Bar' },
    { key: 'antro', label: 'Antro' },
    { key: 'cafe', label: 'Cafe' },
    { key: 'desayunos', label: 'Desayunos' },
    { key: 'comida-corrida', label: 'Comida corrida' },
    { key: 'cena', label: 'Cena' },
    { key: 'antojitos', label: 'Antojitos' }
  ];

  readonly amenidadesDisponibles = [
    { key: 'wifi', label: 'WiFi' },
    { key: 'terraza', label: 'Terraza' },
    { key: 'estacionamiento', label: 'Estacionamiento' },
    { key: 'pet-friendly', label: 'Pet friendly' },
    { key: 'reservas', label: 'Acepta reservas' },
    { key: 'musica-en-vivo', label: 'Musica en vivo' },
    { key: 'accesible', label: 'Acceso para silla de ruedas' },
    { key: 'entrega-a-domicilio', label: 'Entrega a domicilio' },
    { key: 'para-llevar', label: 'Para llevar' },
    { key: 'tarjeta', label: 'Pago con tarjeta' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gastronomiaService: GastronomiaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.loadEstablecimiento(Number(id));
    }
  }

  private loadEstablecimiento(id: number) {
    this.gastronomiaService.getById(id).pipe(first()).subscribe({
      next: (data) => {
        data.fotosUrls = [data.fotoPrincipal, ...(data.fotos || []).map((foto) => foto.url), ...(data.fotosUrls || [])]
          .filter((value): value is string => !!value)
          .filter((value, index, array) => array.indexOf(value) === index);
        this.establecimiento = data;
      },
      error: () => {
        this.toast.error('Error al cargar establecimiento');
        this.router.navigate(['/oferente/gastronomia/establecimientos']);
      }
    });
  }

  submit() {
    if (!this.establecimiento.nombre || !this.establecimiento.ubicacion) {
      this.toast.error('Completa los campos obligatorios');
      return;
    }

    const nombre = (this.establecimiento.nombre || '').trim();
    if (!new RegExp(this.nombrePattern).test(nombre)) {
      this.toast.error('El nombre del establecimiento debe tener entre 3 y 120 caracteres válidos');
      return;
    }

    const descripcion = (this.establecimiento.descripcion || '').trim();
    if (descripcion.length < this.minDescripcionLength || descripcion.length > this.maxDescripcionLength) {
      this.toast.error(`La descripcion debe tener entre ${this.minDescripcionLength} y ${this.maxDescripcionLength} caracteres`);
      return;
    }

    this.establecimiento.nombre = nombre;
    this.establecimiento.descripcion = descripcion;

    // Las coordenadas son opcionales ahora
    if (!this.establecimiento.latitud || !this.establecimiento.longitud) {
      console.warn('Sin coordenadas, guardando solo con ubicación de texto');
    }

    this.submitting = true;
    const request = this.isEdit && this.establecimiento.id
      ? this.gastronomiaService.update(this.establecimiento.id, this.establecimiento)
      : this.gastronomiaService.create(this.establecimiento);

    request.pipe(first()).subscribe({
      next: () => {
        this.toast.success(this.isEdit ? 'Establecimiento actualizado' : 'Establecimiento creado');
        this.router.navigate(['/oferente/gastronomia/establecimientos']);
      },
      error: () => {
        this.toast.error('Error al guardar');
        this.submitting = false;
      }
    });
  }

  onLocationSelected(data: { lat: number; lng: number; address?: string }) {
    this.establecimiento.latitud = data.lat;
    this.establecimiento.longitud = data.lng;
    if (data.address) {
      this.establecimiento.direccion = data.address;
      this.establecimiento.ubicacion = data.address;
      this.toast.success(`📍 ${data.address}`);
    } else {
      this.toast.success('📍 Ubicación marcada en el mapa');
    }
  }

  onFotosSeleccionadas(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) {
      return;
    }

    const invalidFiles = files.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length) {
      this.toast.error('Solo se permiten archivos de imagen');
      input.value = '';
      return;
    }

    this.subiendoFotos = true;
    let pendientes = files.length;

    files.forEach((file) => {
      this.gastronomiaService.uploadTempFoto(file).pipe(first()).subscribe({
        next: ({ url }) => {
          this.establecimiento.fotosUrls = [...(this.establecimiento.fotosUrls || []), url];
          if (!this.establecimiento.fotoPrincipal) {
            this.establecimiento.fotoPrincipal = url;
          }
          pendientes -= 1;
          if (pendientes === 0) {
            this.subiendoFotos = false;
            this.toast.success('Fotos cargadas correctamente');
          }
        },
        error: () => {
          pendientes -= 1;
          if (pendientes === 0) {
            this.subiendoFotos = false;
          }
          this.toast.error('No se pudo subir una de las fotos');
        }
      });
    });

    input.value = '';
  }

  eliminarFoto(index: number) {
    const fotos = [...(this.establecimiento.fotosUrls || [])];
    const [removed] = fotos.splice(index, 1);
    this.establecimiento.fotosUrls = fotos;

    if (this.establecimiento.fotoPrincipal === removed) {
      this.establecimiento.fotoPrincipal = fotos[0] || '';
    }
  }

  usarComoPortada(url: string) {
    this.establecimiento.fotoPrincipal = url;
  }

  toggleAmenidad(key: string) {
    const set = new Set(this.establecimiento.amenidades || []);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    this.establecimiento.amenidades = Array.from(set);
  }

  tieneAmenidad(key: string): boolean {
    return (this.establecimiento.amenidades || []).includes(key);
  }

  get previewImagen(): string {
    return this.establecimiento.fotoPrincipal
      || this.establecimiento.fotosUrls?.[0]
      || 'assets/images/hero-oferentes.svg';
  }

  get previewUbicacion(): string {
    return this.establecimiento.direccion || this.establecimiento.ubicacion || 'Ubicacion por definir';
  }
}
