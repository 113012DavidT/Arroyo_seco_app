# Cambios Backend - Tipo de Negocio Oferente

## 📋 Resumen

Para diferenciar entre oferentes de **Alojamiento** y **Gastronomía**, se usa el campo `TipoOferente` con valores numéricos del enum.

## 🔢 Enum TipoOferente

```csharp
public enum TipoOferente
{
    Alojamiento = 1,
    Gastronomia = 2,
    Ambos = 3
}
```

---

## 🔧 Cambios Necesarios en Backend (.NET)

### 1. Actualizar Modelo de Solicitud de Oferente

**Archivo**: `Models/SolicitudOferente.cs` (o similar)

```csharp
public class SolicitudOferente
{
    public int Id { get; set; }
    public string Nombre { get; set; }
    public string Telefono { get; set; }
    public string Contexto { get; set; }
    
    // NUEVO CAMPO
    public string TipoNegocio { get; set; } // "alojamiento" o "gastronomia"
    
    public DateTime FechaSolicitud { get; set; }
    public string Estado { get; set; } // "Pendiente", "Aprobado", "Rechazado"
}
```

### 2. Actualizar Tabla de Usuario/Oferente

**Archivo**: `Models/ApplicationUser.cs` o `Models/Oferente.cs`

```csharp
public class ApplicationUser : IdentityUser
{
    // ... campos existentes
    
    // NUEVO CAMPO
    public string TipoNegocio { get; set; } // "alojamiento" o "gastronomia"
}
```

**Migración necesaria**:
```bash
dotnet ef migrations add AddTipoNegocioToOferente
dotnet ef database update
```

### 3. Actualizar Endpoint de Solicitud

**Archivo**: `Controllers/SolicitudesController.cs`

```csharp
[HttpPost]
public async Task<IActionResult> CrearSolicitud([FromBody] SolicitudOferenteDto dto)
{
    var solicitud = new SolicitudOferente
    {
        Nombre = dto.Nombre,
        Telefono = dto.Telefono,
        Contexto = dto.Contexto,
        TipoNegocio = dto.TipoNegocio, // NUEVO
        FechaSolicitud = DateTime.Now,
        Estado = "Pendiente"
    };
    
    _context.Solicitudes.Add(solicitud);
    await _context.SaveChangesAsync();
    
    return Ok(new { message = "Solicitud registrada" });
}
```

**DTO**:
```csharp
public class SolicitudOferenteDto
{
    [Required]
    public string Nombre { get; set; }
    
    [Required]
    public string Telefono { get; set; }
    
    [Required]
    public string Contexto { get; set; }
    
    [Required]
    public string TipoNegocio { get; set; } // "alojamiento" o "gastronomia"
}
```

### 4. Agregar Claim al JWT

**Archivo**: `Services/AuthService.cs` o donde se genera el JWT

```csharp
private string GenerateJwtToken(ApplicationUser user, IList<string> roles)
{
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id),
        new Claim(ClaimTypes.Email, user.Email),
        // NUEVO CLAIM
        new Claim("TipoNegocio", user.TipoNegocio ?? "alojamiento")
    };
    
    // Agregar roles
    foreach (var role in roles)
    {
        claims.Add(new Claim(ClaimTypes.Role, role));
    }
    
    // ... resto del código para generar token
}
```

### 5. Endpoint de Login - Incluir TipoNegocio en la respuesta

**Archivo**: `Controllers/AuthController.cs`

```csharp
[HttpPost("login")]
public async Task<IActionResult> Login([FromBody] LoginDto dto)
{
    var user = await _userManager.FindByEmailAsync(dto.Email);
    if (user == null) return Unauthorized();
    
    var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
    if (!result.Succeeded) return Unauthorized();
    
    var roles = await _userManager.GetRolesAsync(user);
    var token = GenerateJwtToken(user, roles);
    
    return Ok(new
    {
        token = token,
        tipoNegocio = user.TipoNegocio, // NUEVO - devolver en respuesta
        roles = roles
    });
}
```

---

## 📤 Endpoints Actualizados

### POST `/api/Solicitudes`

**Request Body**:
```json
{
  "nombre": "Juan Pérez",
  "telefono": "442334559",
  "contexto": "Restaurante familiar con 10 mesas",
  "tipoNegocio": 2
}
```

**Valores permitidos**:
- `1` - Alojamiento
- `2` - Gastronomía
- `3` - Ambos (opcional, por defecto)

### POST `/api/Auth/login`

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tipoNegocio": 2,
  "roles": ["Oferente"]
}
```

**Nota**: `tipoNegocio` debe ser un número (1, 2 o 3)

---

## 🎯 Valores Permitidos

- `1` - **Alojamiento** - Para hospedajes, cabañas, hoteles
- `2` - **Gastronomía** - Para restaurantes, cafeterías
- `3` - **Ambos** - Puede gestionar ambos tipos (valor por defecto)

---

## ✅ Checklist de Implementación Backend

- [ ] Agregar campo `TipoNegocio` al modelo `SolicitudOferente`
- [ ] Agregar campo `TipoNegocio` al modelo `ApplicationUser` o `Oferente`
- [ ] Crear y aplicar migración de base de datos
- [ ] Actualizar endpoint POST `/api/Solicitudes` para recibir `tipoNegocio`
- [ ] Actualizar lógica de aprobación para copiar `tipoNegocio` al usuario
- [ ] Agregar claim `TipoNegocio` en generación de JWT
- [ ] Devolver `tipoNegocio` en respuesta de login
- [ ] Validar que solo acepte valores 1, 2 o 3

---

## 📱 Frontend - Ya Implementado

El frontend ya está completamente preparado para trabajar con el enum `TipoOferente`:

### Formulario de Solicitud
- Envía `tipoNegocio` como número (`1` o `2`)
- Select con valores: `1 = Alojamiento`, `2 = Gastronomía`

### Login de Oferente
- Lee el claim `TipoOferente` del JWT
- Redirige automáticamente:
  - `1` → `/oferente/dashboard` (Alojamiento)
  - `2` → `/oferente/gastronomia/dashboard` (Gastronomía)
  - `3` o `null` → `/oferente/home` (Selector manual)

### Admin - Listas Separadas
- `/admin/oferentes` → Usa `GET /Oferentes/alojamiento`
- `/admin/gastronomia/establecimientos` → Usa `GET /Oferentes/gastronomia`
- Cada lista muestra solo los oferentes correspondientes al módulo

### Endpoints que usa el Frontend
- `GET /Oferentes/alojamiento` - Oferentes con Tipo 1 o 3
- `GET /Oferentes/gastronomia` - Oferentes con Tipo 2 o 3
- `PUT /Oferentes/{id}/tipo` - Cambiar tipo de oferente (admin)

---

## 🔄 Flujo Completo

1. **Usuario envía solicitud** → Frontend envía `tipoNegocio`
2. **Backend guarda solicitud** → Se guarda en tabla Solicitudes
3. **Admin aprueba solicitud** → Se crea usuario Oferente con el `tipoNegocio`
4. **Oferente hace login** → JWT incluye claim `TipoNegocio`
5. **Frontend lee el token** → Extrae `tipoNegocio` y redirige al dashboard correspondiente

---

## 🚀 Próximo Paso

Una vez implementados estos cambios en el backend, el frontend ya está preparado para:
- Enviar el `tipoNegocio` en la solicitud ✅ (ya implementado)
- Leer el `tipoNegocio` del login y redirigir apropiadamente (siguiente paso en frontend)
