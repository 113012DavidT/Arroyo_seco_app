# Deploy en Google Cloud VM

## 1. Preparar la VM

Ejecuta desde la VM:

```bash
curl -fsSL https://raw.githubusercontent.com/113012DavidT/Arroyo_seco_app/main/scripts/gce-bootstrap.sh -o gce-bootstrap.sh
chmod +x gce-bootstrap.sh
./gce-bootstrap.sh
```

## 2. Crear variables del backend

Archivo: `~/back-alojamientos/back-alojamientos-main/.env`

```env
DB_PASSWORD=CAMBIAR
JWT_KEY=CAMBIAR_CON_SECRETO_LARGO
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=CAMBIAR_PASSWORD_FUERTE
EMAIL_USERNAME=
EMAIL_PASSWORD=
API_IMAGE=ghcr.io/113012davidt/arroyo-seco-api:latest
```

## 3. Crear variables del frontend

Archivo: `~/back-alojamientos/front-alojamientos-main/.env`

```env
API_BASE_URL=http://TU_IP_PUBLICA:8080
FRONT_IMAGE=ghcr.io/113012davidt/arroyo-seco-front:latest
```

## 4. Iniciar servicios manualmente

Backend:

```bash
cd ~/back-alojamientos/back-alojamientos-main
docker compose pull
docker compose up -d
```

Frontend:

```bash
cd ~/back-alojamientos/front-alojamientos-main
docker compose pull
docker compose up -d
```

## 5. Secrets requeridos en GitHub

- `GCE_HOST`
- `GCE_USER`
- `GCE_SSH_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

## 6. Flujo de deploy

- `push` con cambios en `back-alojamientos-main/**` despliega backend.
- `push` con cambios en `front-alojamientos-main/**` despliega frontend.
- `push` con cambios en `back-alojamientos-main/neurona/**` despliega neurona.