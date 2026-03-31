import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GastronomiaService, EstablecimientoDto, FotoEstablecimientoDto, MenuDto, MenuItemDto, MesaDto } from '../../services/gastronomia.service';
import { ToastService } from '../../../shared/services/toast.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-detalle-establecimiento-oferente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './detalle-establecimiento-oferente.component.html',
  styleUrl: './detalle-establecimiento-oferente.component.scss'
})
export class DetalleEstablecimientoOferenteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gastronomiaService = inject(GastronomiaService);
  private toast = inject(ToastService);

  establecimiento: EstablecimientoDto | null = null;
  loading = true;
  
  // Modales
  modalMenuAbierto = false;
  modalItemAbierto = false;
  modalMesaAbierto = false;
  
  // Formularios
  nuevoMenu = { nombre: '' };
  menuSeleccionado: MenuDto | null = null;
  
  nuevoItem: MenuItemDto = { nombre: '', descripcion: '', precio: 0 };
  
  nuevaMesa: MesaDto = { numero: 1, capacidad: 2, disponible: true };
  subiendoFotos = false;
  eliminandoFotoId: number | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadEstablecimiento(Number(id));
    }
  }

  private loadEstablecimiento(id: number) {
    this.loading = true;
    this.gastronomiaService.getById(id).pipe(first()).subscribe({
      next: (data) => {
        console.log('Establecimiento cargado:', data);
        console.log('Menús recibidos:', data.menus);
        console.log('Mesas recibidas:', data.mesas);
        data.fotosUrls = this.galleryUrls(data);
        this.establecimiento = data;
        this.loading = false;
      },
      error: () => {
        this.toast.error('Error al cargar establecimiento');
        this.router.navigate(['/oferente/gastronomia/establecimientos']);
        this.loading = false;
      }
    });
  }

  // ========== MENÚS ==========
  abrirModalMenu() {
    this.nuevoMenu = { nombre: '' };
    this.modalMenuAbierto = true;
  }

  cerrarModalMenu() {
    this.modalMenuAbierto = false;
  }

  agregarMenu() {
    if (!this.nuevoMenu.nombre.trim()) {
      this.toast.error('Ingresa un nombre para el menú');
      return;
    }

    if (!this.establecimiento?.id) return;

    console.log('Agregando menú:', this.nuevoMenu, 'al establecimiento:', this.establecimiento.id);
    this.gastronomiaService.createMenu(this.establecimiento.id, this.nuevoMenu).pipe(first()).subscribe({
      next: (response) => {
        console.log('Menú creado exitosamente:', response);
        
        // Agregar el menú localmente
        if (this.establecimiento) {
          if (!this.establecimiento.menus) {
            this.establecimiento.menus = [];
          }
          const nuevoMenuConId: MenuDto = {
            ...this.nuevoMenu,
            id: typeof response === 'number' ? response : response?.id,
            establecimientoId: this.establecimiento.id,
            items: []
          };
          this.establecimiento.menus.push(nuevoMenuConId);
        }
        
        this.toast.success('Menú agregado exitosamente');
        this.cerrarModalMenu();
        
        // Recargar para sincronizar
        this.loadEstablecimiento(this.establecimiento!.id!);
      },
      error: (err) => {
        console.error('Error al agregar menú:', err);
        this.toast.error('Error al agregar menú: ' + (err.error?.message || err.message));
      }
    });
  }

  // ========== ITEMS DE MENÚ ==========
  abrirModalItem(menu: MenuDto) {
    this.menuSeleccionado = menu;
    this.nuevoItem = { nombre: '', descripcion: '', precio: 0 };
    this.modalItemAbierto = true;
  }

  cerrarModalItem() {
    this.modalItemAbierto = false;
    this.menuSeleccionado = null;
  }

  agregarItem() {
    if (!this.nuevoItem.nombre.trim() || this.nuevoItem.precio < 1) {
      this.toast.error('Completa los campos y usa un precio mayor o igual a 1.00');
      return;
    }

    if (!this.establecimiento?.id || !this.menuSeleccionado?.id) return;

    console.log('Agregando item:', this.nuevoItem, 'al menú:', this.menuSeleccionado.id, 'del establecimiento:', this.establecimiento.id);
    this.gastronomiaService
      .addMenuItem(this.establecimiento.id, this.menuSeleccionado.id, this.nuevoItem)
      .pipe(first())
      .subscribe({
        next: (response) => {
          console.log('Item creado exitosamente:', response);
          
          // Agregar el item localmente al menú para mostrarlo inmediatamente
          const nuevoItemConId: MenuItemDto = {
            ...this.nuevoItem,
            id: typeof response === 'number' ? response : response?.id,
            menuId: this.menuSeleccionado!.id
          };
          
          // Buscar el menú en el establecimiento y agregar el item
          const menuEnEstablecimiento = this.establecimiento?.menus?.find(m => m.id === this.menuSeleccionado?.id);
          if (menuEnEstablecimiento) {
            if (!menuEnEstablecimiento.items) {
              menuEnEstablecimiento.items = [];
            }
            menuEnEstablecimiento.items.push(nuevoItemConId);
            console.log('Item agregado localmente al menú. Total items:', menuEnEstablecimiento.items.length);
          }
          
          this.toast.success('Item agregado al menú');
          this.cerrarModalItem();
          
          // Opción 2: Recargar desde el backend para asegurar sincronización
          console.log('Recargando establecimiento con ID:', this.establecimiento!.id);
          this.loadEstablecimiento(this.establecimiento!.id!);
        },
        error: (err) => {
          console.error('Error al agregar item:', err);
          this.toast.error('Error al agregar item: ' + (err.error?.message || err.message));
        }
      });
  }

  // ========== MESAS ==========
  abrirModalMesa() {
    this.nuevaMesa = { numero: this.getNextMesaNumber(), capacidad: 2, disponible: true };
    this.modalMesaAbierto = true;
  }

  cerrarModalMesa() {
    this.modalMesaAbierto = false;
  }

  agregarMesa() {
    if (this.nuevaMesa.numero <= 0 || this.nuevaMesa.capacidad <= 0) {
      this.toast.error('Número y capacidad deben ser mayores a 0');
      return;
    }

    if (!this.establecimiento?.id) return;

    console.log('Agregando mesa:', this.nuevaMesa, 'al establecimiento:', this.establecimiento.id);
    this.gastronomiaService.createMesa(this.establecimiento.id, this.nuevaMesa).pipe(first()).subscribe({
      next: (response: any) => {
        console.log('Mesa creada exitosamente:', response);

        // Agregar la mesa localmente tambien cuando queda en cola offline.
        if (this.establecimiento) {
          if (!this.establecimiento.mesas) {
            this.establecimiento.mesas = [];
          }
          const isQueuedOffline = !!response?.queuedOffline;
          const nuevaMesaConId: MesaDto = {
            ...this.nuevaMesa,
            id: isQueuedOffline ? Date.now() : (typeof response === 'number' ? response : response?.id),
            establecimientoId: this.establecimiento.id
          };
          this.establecimiento.mesas.push(nuevaMesaConId);
        }

        if (response?.queuedOffline) {
          this.toast.info('Sin internet: mesa agregada localmente y pendiente de sincronizacion');
        } else {
          this.toast.success('Mesa agregada exitosamente');
        }

        this.cerrarModalMesa();

        if (!response?.queuedOffline) {
          // Recargar solo cuando la API confirmo guardado real.
          this.loadEstablecimiento(this.establecimiento!.id!);
        }
      },
      error: (err) => {
        console.error('Error al agregar mesa:', err);
        this.toast.error('Error al agregar mesa: ' + (err.error?.message || err.message));
      }
    });
  }

  toggleDisponibilidadMesa(mesa: MesaDto) {
    if (!this.establecimiento?.id || !mesa.id) return;

    const nuevaDisponibilidad = !mesa.disponible;

    this.gastronomiaService
      .updateDisponibilidadMesa(this.establecimiento.id, mesa.id, nuevaDisponibilidad)
      .pipe(first())
      .subscribe({
        next: () => {
          mesa.disponible = nuevaDisponibilidad;
          this.toast.success(
            nuevaDisponibilidad ? 'Mesa marcada como disponible' : 'Mesa marcada como no disponible'
          );
        },
        error: () => {
          this.toast.error('Error al actualizar disponibilidad');
        }
      });
  }

  onFotosSeleccionadas(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length || !this.establecimiento?.id) {
      return;
    }

    const invalidFiles = files.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length) {
      this.toast.error('Solo se permiten archivos de imagen');
      input.value = '';
      return;
    }

    this.subiendoFotos = true;
    this.gastronomiaService.uploadFotos(this.establecimiento.id, files).pipe(first()).subscribe({
      next: (fotos) => {
        if (!this.establecimiento) {
          return;
        }

        this.establecimiento.fotos = [...(this.establecimiento.fotos || []), ...fotos];
        this.establecimiento.fotosUrls = this.galleryUrls(this.establecimiento);
        if (!this.establecimiento.fotoPrincipal && this.establecimiento.fotosUrls.length) {
          this.establecimiento.fotoPrincipal = this.establecimiento.fotosUrls[0];
        }
        this.subiendoFotos = false;
        input.value = '';
        this.toast.success('Fotos agregadas correctamente');
      },
      error: () => {
        this.subiendoFotos = false;
        this.toast.error('No se pudieron subir las fotos');
      }
    });
  }

  eliminarFoto(foto: FotoEstablecimientoDto) {
    if (!this.establecimiento?.id || !foto.id) {
      return;
    }

    this.eliminandoFotoId = foto.id;
    this.gastronomiaService.deleteFoto(this.establecimiento.id, foto.id).pipe(first()).subscribe({
      next: () => {
        if (!this.establecimiento) {
          return;
        }

        this.establecimiento.fotos = (this.establecimiento.fotos || []).filter((item) => item.id !== foto.id);
        this.establecimiento.fotosUrls = this.galleryUrls(this.establecimiento);
        if (this.establecimiento.fotoPrincipal === foto.url) {
          this.establecimiento.fotoPrincipal = this.establecimiento.fotosUrls[0] || '';
        }
        this.eliminandoFotoId = null;
        this.toast.success('Foto eliminada');
      },
      error: () => {
        this.eliminandoFotoId = null;
        this.toast.error('No se pudo eliminar la foto');
      }
    });
  }

  usarComoPortada(url: string) {
    if (!this.establecimiento?.id) {
      return;
    }

    this.gastronomiaService.update(this.establecimiento.id, {
      fotoPrincipal: url,
      fotosUrls: this.galleryUrls(this.establecimiento)
    }).pipe(first()).subscribe({
      next: () => {
        if (this.establecimiento) {
          this.establecimiento.fotoPrincipal = url;
        }
        this.toast.success('Portada actualizada');
      },
      error: () => this.toast.error('No se pudo actualizar la portada')
    });
  }

  get fotosGaleria(): FotoEstablecimientoDto[] {
    return [...(this.establecimiento?.fotos || [])].sort((left, right) => (left.orden || 0) - (right.orden || 0));
  }

  private galleryUrls(establecimiento: EstablecimientoDto): string[] {
    const urls = [
      establecimiento.fotoPrincipal,
      ...(establecimiento.fotos || []).map((foto) => foto.url),
      ...(establecimiento.fotosUrls || [])
    ].filter((value): value is string => !!value);

    return [...new Set(urls)];
  }

  private getNextMesaNumber(): number {
    if (!this.establecimiento?.mesas || this.establecimiento.mesas.length === 0) {
      return 1;
    }
    const maxNumero = Math.max(...this.establecimiento.mesas.map(m => m.numero || 0));
    return maxNumero + 1;
  }

  volver() {
    this.router.navigate(['/oferente/gastronomia/establecimientos']);
  }
}
