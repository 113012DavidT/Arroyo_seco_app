# 🗺️ Implementación de Google Maps - Guía Completa

## ✅ Lo que ya está hecho (Alojamientos):

### Frontend:
- ✅ Campo de búsqueda con Google Places Autocomplete
- ✅ Captura automática de coordenadas (latitud/longitud)
- ✅ Validación para asegurar que se seleccione una dirección
- ✅ Actualización del servicio `AlojamientoDto` con campos de ubicación

### Backend necesario:
```csharp
// Ya implementado según tu screenshot
public class Alojamiento {
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }
    public string Direccion { get; set; }
}
```

---

## 📋 Pendiente: Gastronomía

Necesitas actualizar el componente `form-establecimiento` igual que lo hice con alojamientos.

### Actualizar servicio de gastronomía:

**Archivo:** `src/app/gastronomia/services/gastronomia.service.ts`

```typescript
export interface EstablecimientoDto {
  id?: number;
  nombre: string;
  ubicacion: string;
  latitud?: number | null;      // ← AGREGAR
  longitud?: number | null;     // ← AGREGAR
  direccion?: string;           // ← AGREGAR
  descripcion?: string;
  fotoPrincipal?: string;
  // ... otros campos
}
```

### Actualizar componente TypeScript:

**Archivo:** `src/app/gastronomia/components/form-establecimiento/form-establecimiento.component.ts`

Agregar después de la línea `submitting = false;`:

```typescript
autocomplete: any;
busquedaDireccion = '';
```

Agregar estos métodos al final de la clase:

```typescript
loadGoogleMapsScript() {
  if ((window as any).google) {
    this.initAutocomplete();
    return;
  }
  
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_CONFIG.apiKey}&libraries=places&language=es`;
  script.async = true;
  script.defer = true;
  script.onload = () => this.initAutocomplete();
  document.head.appendChild(script);
}

initAutocomplete() {
  setTimeout(() => {
    const input = document.getElementById('autocomplete-input-gastro') as HTMLInputElement;
    if (!input) return;
    
    const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
      types: ['address'],
      componentRestrictions: { country: 'mx' }
    });
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (place.geometry && place.geometry.location) {
        this.establecimiento.latitud = place.geometry.location.lat();
        this.establecimiento.longitud = place.geometry.location.lng();
        this.establecimiento.direccion = place.formatted_address || '';
        this.establecimiento.ubicacion = place.formatted_address || '';
        this.busquedaDireccion = place.formatted_address || '';
        
        this.toast.success('Ubicación capturada correctamente');
      }
    });
    
    this.autocomplete = autocomplete;
  }, 500);
}
```

Modificar `ngOnInit()` - agregar la primera línea:

```typescript
ngOnInit(): void {
  this.loadGoogleMapsScript();  // ← AGREGAR ESTA LÍNEA
  
  const id = this.route.snapshot.paramMap.get('id');
  // ... resto del código
}
```

Modificar `loadEstablecimiento()` - agregar línea para busquedaDireccion:

```typescript
next: (data) => {
  this.establecimiento = data;
  this.busquedaDireccion = data.direccion || data.ubicacion || '';  // ← AGREGAR
},
```

Modificar `submit()` - agregar validación después de la primera validación:

```typescript
if (!this.establecimiento.latitud || !this.establecimiento.longitud) {
  this.toast.error('Por favor selecciona una dirección del buscador');
  return;
}
```

### Actualizar HTML:

**Archivo:** `src/app/gastronomia/components/form-establecimiento/form-establecimiento.component.html`

Reemplazar el campo de "Ubicación" con:

```html
<label>
  📍 Buscar Dirección
  <input 
    id="autocomplete-input-gastro"
    type="text" 
    name="busquedaDireccion" 
    [(ngModel)]="busquedaDireccion"
    placeholder="Escribe la dirección del restaurante"
    required 
  />
  <small class="hint" *ngIf="establecimiento.latitud && establecimiento.longitud">
    ✅ Ubicación capturada: {{ establecimiento.latitud?.toFixed(6) }}, {{ establecimiento.longitud?.toFixed(6) }}
  </small>
  <small class="hint warning" *ngIf="!establecimiento.latitud || !establecimiento.longitud">
    ⚠️ Selecciona una dirección de las sugerencias
  </small>
</label>
```

Agregar en los estilos SCSS:

```scss
.hint {
  font-size: 0.85rem;
  font-weight: 400;
  color: #10b981;
  margin-top: -0.25rem;
  
  &.warning {
    color: #f59e0b;
  }
}
```

---

## 🚀 Cómo funciona:

1. **Usuario escribe en el campo** → Google Places Autocomplete muestra sugerencias
2. **Usuario selecciona una dirección** → Se capturan automáticamente:
   - Latitud
   - Longitud  
   - Dirección formateada
3. **Al guardar** → Se envían las coordenadas al backend
4. **En el detalle** → Botón "Cómo llegar" usa esas coordenadas

---

## 📍 Siguiente paso: Botón "Cómo llegar"

Una vez que tengas las coordenadas guardadas, podemos agregar el botón en las vistas de detalle:

```typescript
abrirDirecciones(lat: number, lng: number) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
}
```

```html
<button (click)="abrirDirecciones(alojamiento.latitud, alojamiento.longitud)" class="btn-direcciones">
  🗺️ Cómo llegar
</button>
```

---

## 🎯 Estado Actual:

✅ **Alojamientos**: Formulario completo con autocompletado
⏳ **Gastronomía**: Pendiente (sigue los pasos de arriba)
⏳ **Vistas de detalle**: Agregar botón "Cómo llegar"

¿Quieres que implemente el resto ahora?
