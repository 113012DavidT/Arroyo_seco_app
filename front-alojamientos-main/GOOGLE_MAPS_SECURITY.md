# 🔐 Configuración Segura de Google Maps API

## ⚠️ IMPORTANTE - SEGURIDAD

La API key de Google Maps **NO debe estar en el código fuente** para evitar:
- ✗ Exposición pública en GitHub
- ✗ Uso no autorizado por terceros
- ✗ Cargos inesperados en tu cuenta de Google Cloud

## 📋 Configuración (Primera vez)

### 1. Crear tu archivo de configuración

```bash
# Copia el archivo de ejemplo
cp src/app/config/maps.config.example.ts src/app/config/maps.config.ts
```

### 2. Editar con tu API key

Abre `src/app/config/maps.config.ts` y reemplaza `TU_API_KEY_AQUI`:

```typescript
export const GOOGLE_MAPS_CONFIG = {
   apiKey: 'TU_API_KEY_AQUI',
  libraries: ['places'],
  language: 'es'
};
```

### 3. Verificar .gitignore

El archivo `maps.config.ts` debe estar en `.gitignore`:

```
# Configuración sensible - NO SUBIR A GITHUB
src/app/config/maps.config.ts
```

## 🔒 Seguridad en Google Cloud Console

1. Ve a https://console.cloud.google.com/apis/credentials
2. Selecciona tu API key
3. Configura **Restricciones de aplicación**:
   - Tipo: **Referentes HTTP (sitios web)**
   - Agrega:
     - `localhost:4200/*`
     - `arroyosecoservices.vercel.app/*`

4. Configura **Restricciones de API**:
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✗ (desmarca todo lo demás)

## 🚀 Deploy en Vercel

Para producción, configura la API key como variable de entorno:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - Name: `GOOGLE_MAPS_API_KEY`
   - Value: Tu API key
   - Environment: Production

## ✅ Verificación

- ✓ `maps.config.ts` NO aparece en `git status`
- ✓ `maps.config.example.ts` SÍ está en el repositorio
- ✓ La API key tiene restricciones configuradas
- ✓ El autocompletado funciona en localhost

## 🆘 Si la key se expuso

1. **REVOCA inmediatamente** la key en Google Cloud Console
2. Crea una nueva key con restricciones
3. Actualiza `maps.config.ts` localmente (nunca en GitHub)
