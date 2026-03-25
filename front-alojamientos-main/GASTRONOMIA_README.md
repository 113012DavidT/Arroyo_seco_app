# Módulo de Gastronomía - ArroyoSeco Frontend

## Resumen de Implementación

Se ha implementado un módulo completo de gastronomía para la plataforma ArroyoSeco, similar al módulo de alojamiento pero adaptado para restaurantes y reservas de mesas.

## 🆕 Sistema de Tipo de Negocio

El sistema ahora soporta que los oferentes especifiquen su tipo de negocio al enviar la solicitud:

### Frontend ✅ Implementado
- **Formulario de solicitud** (`oferente-solicitud.component`) incluye selector de tipo de negocio
- **Opciones**: "Alojamiento / Hospedaje" o "Gastronomía / Restaurante"
- **Login automático**: Al hacer login, el oferente es redirigido al dashboard correspondiente según su tipo de negocio
- **Selectores de módulo**: Si un oferente no tiene tipo definido, puede elegir manualmente en `/oferente/home`

### Backend ⏳ Pendiente
Ver archivo `BACKEND_TIPO_NEGOCIO.md` para instrucciones detalladas de implementación en .NET

## Componentes Creados

### 🏠 Home Selector
- **`home-selector.component`**: Componente que permite al cliente elegir entre Alojamiento o Gastronomía después de iniciar sesión
  - Ruta: `/cliente/home`
  
- **`admin-home-selector.component`**: Selector para administradores
  - Ruta: `/admin/home`
  - Permite elegir entre gestión de Alojamiento o Gastronomía
  
- **`oferente-home-selector.component`**: Selector para oferentes
  - Ruta: `/oferente/home`
  - Permite elegir entre gestión de Alojamiento o Gastronomía
  - Se muestra si el oferente no tiene `tipoNegocio` definido en el JWT

### 🔧 Componentes de Admin

#### Dashboard
- **`admin-dashboard-gastronomia`**: Dashboard de gastronomía para admin
  - Estadísticas de establecimientos, reservas
  - Lista de establecimientos pendientes de aprobación
  - Acciones rápidas

### 👥 Componentes de Cliente

#### Layout y Navegación
- **`cliente-layout-gastronomia`**: Layout principal para clientes de gastronomía
- **`cliente-navbar-gastronomia`**: Barra de navegación con enlaces a restaurantes, reservas, notificaciones
- **`cliente-footer-gastronomia`**: Pie de página personalizado

#### Funcionalidades
- **`lista-gastronomia`**: Listado de restaurantes con búsqueda y filtros
- **`detalle-gastronomia`**: Vista detallada de un restaurante con menús, mesas y formulario de reserva
- **`cliente-reservas-gastronomia`**: Gestión de reservas del cliente (activas e historial)

### 🏢 Componentes de Oferente

#### Layout y Navegación
- **`oferente-layout-gastronomia`**: Layout para el panel de oferente
- **`oferente-navbar-gastronomia`**: Navegación del oferente
- **`oferente-footer-gastronomia`**: Pie de página del oferente

#### Funcionalidades
- **`oferente-dashboard-gastronomia`**: Dashboard con estadísticas y accesos rápidos
- **`gestion-establecimientos`**: Lista y gestión de restaurantes del oferente
- **`form-establecimiento`**: Formulario para crear/editar establecimientos
- **`oferente-reservas-gastronomia`**: Gestión de reservas (confirmar/rechazar)

### ⚙️ Servicios

#### `gastronomia.service.ts`
Endpoints implementados:
- `GET /api/Gastronomias` - Listar todos los establecimientos
- `GET /api/Gastronomias/{id}` - Detalle de establecimiento
- `GET /api/Gastronomias/{id}/menus` - Menús del establecimiento
- `GET /api/Gastronomias/{id}/disponibilidad` - Verificar disponibilidad
- `POST /api/Gastronomias` - Crear establecimiento (oferente)
- `PUT /api/Gastronomias/{id}` - Actualizar establecimiento
- `DELETE /api/Gastronomias/{id}` - Eliminar establecimiento
- `POST /api/Gastronomias/{id}/menus` - Crear menú
- `POST /api/Gastronomias/{id}/menus/{menuId}/items` - Agregar item al menú
- `POST /api/Gastronomias/{id}/mesas` - Crear mesa
- `PUT /api/Gastronomias/{id}/mesas/{mesaId}/disponible` - Cambiar disponibilidad
- `GET /api/Gastronomias/{id}/reservas` - Reservas del establecimiento
- `POST /api/Gastronomias/{id}/reservas` - Crear reserva (cliente)

#### `reservas-gastronomia.service.ts`
Endpoints de reservas:
- `GET /ReservasGastronomia/cliente/{id}` - Reservas del cliente
- `GET /ReservasGastronomia/activas` - Reservas activas
- `GET /ReservasGastronomia/historial` - Historial de reservas
- `PATCH /ReservasGastronomia/{id}/estado` - Cambiar estado
- Métodos helper: `confirmar()`, `cancelar()`

## Interfaces TypeScript

```typescript
interface EstablecimientoDto {
  id?: number;
  oferenteId?: string;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  fotoPrincipal?: string;
  menus?: MenuDto[];
  mesas?: MesaDto[];
}

interface MenuDto {
  id?: number;
  establecimientoId?: number;
  nombre: string;
  items?: MenuItemDto[];
}

interface MenuItemDto {
  id?: number;
  menuId?: number;
  nombre: string;
  descripcion: string;
  precio: number;
}

interface MesaDto {
  id?: number;
  establecimientoId?: number;
  numero: number;
  capacidad: number;
  disponible?: boolean;
}

interface ReservaGastronomiaDto {
  id?: number;
  usuarioId?: string;
  establecimientoId?: number;
  mesaId?: number;
  fecha: string;
  numeroPersonas: number;
  estado?: string;
  total?: number;
}
```

## Rutas Configuradas

### Selector de Login
- `/login` - Selector general (admin/oferente/cliente)
- `/oferente/solicitud` - Formulario de solicitud (incluye selección de tipo de negocio)

### Cliente
- `/cliente/home` - Selector de módulo (Alojamiento/Gastronomía)
- `/cliente/gastronomia` - Lista de restaurantes
- `/cliente/gastronomia/:id` - Detalle de restaurante
- `/cliente/gastronomia/reservas` - Mis reservas de restaurantes

### Oferente
- `/oferente/home` - Selector de módulo (si no tiene tipo de negocio definido)
- `/oferente/dashboard` - Dashboard de alojamiento
- `/oferente/gastronomia/dashboard` - Dashboard de gastronomía
- `/oferente/gastronomia/establecimientos` - Gestión de restaurantes
- `/oferente/gastronomia/establecimientos/agregar` - Nuevo restaurante
- `/oferente/gastronomia/establecimientos/:id/editar` - Editar restaurante
- `/oferente/gastronomia/reservas` - Gestión de reservas
- `/oferente/gastronomia/notificaciones` - Notificaciones
- `/oferente/gastronomia/configuracion` - Configuración

### Admin
- `/admin/home` - Selector de módulo (Alojamiento/Gastronomía)
- `/admin/dashboard` - Dashboard de alojamiento
- `/admin/gastronomia/dashboard` - Dashboard de gastronomía
- `/admin/gastronomia/establecimientos` - Gestión de establecimientos
- `/admin/gastronomia/reservas` - Gestión de reservas

## Características Implementadas

### Para Clientes
✅ Búsqueda y filtrado de restaurantes
✅ Vista detallada con menús completos
✅ Sistema de reservas con selección de fecha, hora y número de personas
✅ Selección opcional de mesa específica
✅ Gestión de reservas (ver activas, historial, cancelar)
✅ Navegación entre módulos de alojamiento y gastronomía

### Para Oferentes
✅ Dashboard con estadísticas
✅ CRUD completo de establecimientos
✅ Gestión de menús y items
✅ Gestión de mesas y disponibilidad
✅ Gestión de reservas (confirmar/rechazar)
✅ Visualización de reservas pendientes y confirmadas

### Características del Sistema
✅ Componentes standalone (no requieren módulo)
✅ Diseño responsive
✅ Servicios con tipado TypeScript
✅ Manejo de errores y estados de carga
✅ Toasts para notificaciones al usuario
✅ Layouts personalizados por rol
✅ Temática visual diferenciada (amarillo/naranja para gastronomía vs cyan para alojamiento)

## Flujo de Usuario

### Oferente (Nuevo)
1. Visita `/oferente/solicitud`
2. **Selecciona tipo de negocio**: Alojamiento o Gastronomía
3. Completa formulario con nombre, teléfono y contexto
4. Admin aprueba la solicitud y crea usuario con el `tipoNegocio`
5. Oferente hace login → Automáticamente redirigido al dashboard correspondiente
   - Si `tipoNegocio = "gastronomia"` → `/oferente/gastronomia/dashboard`
   - Si `tipoNegocio = "alojamiento"` → `/oferente/dashboard`
   - Si no tiene tipo → `/oferente/home` (selector manual)

### Cliente
1. Login → `/cliente/home`
2. Selecciona "Gastronomía"
3. Ve la lista de restaurantes → `/cliente/gastronomia`
4. Hace clic en un restaurante → `/cliente/gastronomia/:id`
5. Ve el menú y detalles
6. Hace una reserva (selecciona fecha, hora, personas, opcionalmente mesa)
7. Puede ver sus reservas en → `/cliente/gastronomia/reservas`
8. Puede cancelar reservas si es necesario

### Oferente
1. Login → `/oferente/gastronomia/dashboard`
2. Puede agregar un nuevo restaurante
3. Configura menús, items y mesas
4. Recibe reservas de clientes
5. Confirma o rechaza reservas desde el panel
6. Gestiona la disponibilidad de mesas

## Próximas Mejoras Sugeridas

- [ ] Componente de admin para aprobar establecimientos
- [ ] Sistema de calificaciones y reseñas
- [ ] Galería de fotos por establecimiento
- [ ] Filtros avanzados (tipo de cocina, rango de precios)
- [ ] Mapa de ubicación de restaurantes
- [ ] Integración con servicio de notificaciones push
- [ ] Reportes y estadísticas para oferentes
- [ ] Sistema de promociones y descuentos

## Notas Técnicas

- Todos los componentes son **standalone**, facilitando lazy loading si se requiere
- Los errores de compilación de TypeScript son esperados hasta que se ejecute `npm install`
- El módulo sigue la misma arquitectura que el módulo de alojamiento para mantener consistencia
- Se utilizan las mismas guardias de autenticación (cuando estén habilitadas)
- Compatible con el sistema de toasts y notificaciones existente

## Integración con Backend

Asegúrate de que tu backend de .NET tenga configurados los endpoints según la documentación proporcionada en:
- `arroyoSeco/Controllers/GastronomiasController.cs`
- Migraciones aplicadas para las entidades de gastronomía
- CORS configurado para permitir peticiones desde el frontend
