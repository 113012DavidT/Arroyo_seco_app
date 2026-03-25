# 🔐 Guía de Prueba - Sistema de Cambio de Contraseña Obligatorio

## ✅ Sistema Implementado Completo

### Backend (.NET)
- ✅ Modelo `ApplicationUser` con `RequiereCambioPassword` y `FechaPrimerLogin`
- ✅ Migración aplicada a base de datos
- ✅ Creación de oferentes marca `RequiereCambioPassword = true`
- ✅ JWT incluye claim "RequiereCambioPassword"
- ✅ Endpoint `POST /api/auth/cambiar-password`

### Frontend (Angular)
- ✅ Componente `cambiar-password-forzado`
- ✅ Guard `cambioPasswordGuard` en todas las rutas protegidas
- ✅ Método `requiereCambioPassword()` en `AuthService`
- ✅ Ruta `/cambiar-password` disponible

---

## 🧪 Pasos para Probar

### 1. Crear un Oferente de Prueba

Como **Administrador**, crea un nuevo oferente:

**Opción A - Admin crea oferente:**
```
Email: prueba@oferente.com
Contraseña: Hola.123
Rol: Oferente
Tipo: Alojamiento o Gastronomía
```

**Opción B - Registro automático de oferente:**
```
Email: autoregistro@oferente.com
Contraseña: Temporal.123
Rol: Oferente
```

El backend automáticamente marca `RequiereCambioPassword = true` para ambos casos.

---

### 2. Hacer Login como el Oferente

1. Ve a: https://arroyosecoservices.vercel.app/oferente/login
2. Ingresa las credenciales según cómo fue creado:
   - **Si fue creado por admin:** Email + `Hola.123`
   - **Si fue auto-registro:** Email + `Temporal.123`
3. Haz clic en **Iniciar Sesión**

---

### 3. Verificar Redirección Automática

**Comportamiento esperado:**

🔄 Después del login exitoso, el sistema debe:
1. Detectar que `RequiereCambioPassword = true` en el token JWT
2. **Redirigir automáticamente** a `/cambiar-password`
3. Mostrar pantalla con candado 🔒 y formulario de cambio

❌ **NO debería** poder acceder a ninguna otra ruta (dashboard, hospedajes, etc.)

---

### 4. Cambiar la Contraseña

En la pantalla `/cambiar-password`:

1. **Contraseña Temporal Actual:** `Hola.123` o `Temporal.123` (según cómo fue creado)
2. **Nueva Contraseña:** `MiPassword123!` (o cualquier otra segura)
3. **Confirmar Nueva Contraseña:** `MiPassword123!`
4. Haz clic en **Cambiar Contraseña**

---

### 5. Verificar Cierre de Sesión Automático

**Comportamiento esperado:**

1. Mensaje de éxito: "Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente."
2. Cierre de sesión automático
3. Redirección a `/oferente/login` después de 1.5 segundos

---

### 6. Segundo Login con Nueva Contraseña

1. En el login, usa:
   - **Email:** `prueba@oferente.com`
   - **Password:** `MiPassword123!` (la nueva contraseña)
2. Haz clic en **Iniciar Sesión**

**Comportamiento esperado:**

✅ Login exitoso
✅ Redirige a `/oferente/home` (selector de módulo)
✅ **NO** redirige a `/cambiar-password`
✅ Puede navegar normalmente por toda la aplicación

---

## 🔍 Verificaciones Técnicas

### Inspeccionar el Token JWT

Abre la consola del navegador (F12) y ejecuta:

```javascript
const token = localStorage.getItem('as_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('RequiereCambioPassword:', payload.RequiereCambioPassword);
```

**Primer login (antes del cambio):**
```
RequiereCambioPassword: "True"
```

**Segundo login (después del cambio):**
```
RequiereCambioPassword: "False"
```

---

## 🎯 Casos de Uso

### ✅ Escenario 1: Oferente Nuevo
1. Admin crea oferente → `RequiereCambioPassword = true`
2. Oferente hace login → Forzado a cambiar contraseña
3. Cambia contraseña → `RequiereCambioPassword = false`
4. Próximo login → Acceso normal

### ✅ Escenario 2: Oferente Existente
1. Oferente con contraseña ya cambiada
2. Login normal → `RequiereCambioPassword = false`
3. Acceso directo al dashboard

### ✅ Escenario 3: Intento de Bypass
1. Oferente con contraseña temporal intenta ir directo a `/oferente/dashboard`
2. Guard intercepta → Redirección a `/cambiar-password`
3. No puede acceder hasta cambiar contraseña

---

## 🚨 Posibles Errores y Soluciones

### Error: "Error al cambiar la contraseña"

**Causa:** Contraseña actual incorrecta

**Solución:** 
- Si fue creado por admin, usa: `Hola.123`
- Si fue auto-registro, usa: `Temporal.123`

---

### Error: No redirige a cambiar-password

**Causa:** Token JWT no incluye el claim

**Solución:** 
1. Verifica que el backend esté actualizado
2. Borra el localStorage: `localStorage.clear()`
3. Haz login nuevamente

---

### Error: Loop infinito de redirección

**Causa:** Guard mal configurado

**Solución:** Verifica que la ruta `/cambiar-password` NO tenga el guard aplicado

---

## 📊 Endpoint del Backend

### POST /api/auth/cambiar-password

**Headers:**
```
Authorization: Bearer {tu-token-jwt}
Content-Type: application/json
```

**Body:**
```json
{
  "passwordActual": "Hola.123",  // o "Temporal.123"
  "passwordNueva": "MiPassword123!"
}
```

**Respuesta Exitosa (200):**
```json
{
  "message": "Contraseña actualizada exitosamente"
}
```

**Respuesta Error (400):**
```json
{
  "message": "Contraseña actual incorrecta"
}
```

---

## 🎨 Interfaz Visual

La pantalla de cambio de contraseña incluye:

- 🔒 Ícono de candado animado
- Formulario de 3 campos (actual, nueva, confirmar)
- Validaciones en tiempo real
- Consejos de seguridad
- Diseño responsive y moderno
- Gradiente morado/violeta

---

## ✅ Checklist de Verificación

- [ ] Admin puede crear oferentes (contraseña: `Hola.123`)
- [ ] Oferente nuevo hace login con su contraseña temporal
- [ ] Redirige automáticamente a `/cambiar-password`
- [ ] No puede acceder a otras rutas
- [ ] Puede cambiar contraseña exitosamente
- [ ] Cierra sesión automáticamente
- [ ] Segundo login con nueva contraseña funciona
- [ ] No vuelve a pedir cambio de contraseña
- [ ] Token JWT tiene claim `RequiereCambioPassword: False`

---

## 🚀 Deploy

El frontend ya está desplegado en:
**https://arroyosecoservices.vercel.app**

Los cambios se aplicaron automáticamente con el último commit:
- Commit: `1b67237`
- Mensaje: "Mejorar flujo de cambio de contraseña: cerrar sesión y redirigir a login después del cambio"

---

## 📞 Soporte

Si encuentras algún problema:

1. Verifica que el backend tenga la migración aplicada
2. Revisa la consola del navegador (F12) para errores
3. Verifica el Network tab para ver la respuesta del API
4. Comprueba que el token JWT incluya el claim

---

**Estado:** ✅ Sistema completamente funcional y desplegado
