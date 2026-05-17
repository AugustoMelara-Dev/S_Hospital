# Offline LAN Install - Hospital Billing OS

## Proposito

Este documento separa el entorno Docker de desarrollo de una instalacion de produccion offline LAN. Docker Compose facilita desarrollo reproducible, pero produccion no debe depender de descargar paquetes desde internet al arrancar.

## Topologia de produccion

- Una PC servidor ejecuta Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes usan navegador en la red local.
- Los clientes no deben usar `localhost` para entrar al sistema, porque `localhost` apunta a la computadora cliente.
- Usar IP fija o nombre local del servidor, por ejemplo `http://192.168.1.10`.
- El despliegue recomendado para produccion es same-origin: frontend compilado y API publicados bajo el mismo host/puerto o dominio LAN.

## Desarrollo con Docker

Docker Compose en este repositorio es solo para desarrollo:

```bash
docker compose config
docker compose up -d
```

Servicios:

- `backend`: Laravel en `http://localhost:8000`.
- `frontend`: Vite React en `http://localhost:5173`.
- `mysql`: MariaDB local para desarrollo.

El servicio frontend puede ejecutar `npm install` y el backend puede ejecutar `composer install` al iniciar en desarrollo. Esa estrategia no es aceptable como requisito de produccion offline.

## Produccion offline LAN

Antes de instalar en el hospital:

1. Preparar artefactos con internet en una maquina de build controlada.
2. Ejecutar `composer install --no-dev --optimize-autoloader` para backend.
3. Ejecutar `npm ci` y `npm run build` para frontend.
4. Copiar backend, `vendor/`, frontend compilado y configuracion al servidor.
5. Instalar MySQL/MariaDB local en el servidor.
6. Configurar `.env` real fuera del repositorio con secretos locales.
7. Generar `APP_KEY` en el servidor.
8. Ejecutar migraciones y seeders aprobados.
9. Publicar por IP fija LAN o nombre local.
10. Validar `/up`, `/login` y `/verify-email`.

## Red local

- Configurar IP fija en el servidor.
- Permitir HTTP/HTTPS en firewall local.
- No abrir el sistema a internet salvo decision explicita posterior.
- Si se configura HTTPS local, instalar certificado confiable para los clientes.

## Backups

- Programar backup diario.
- Permitir backup manual desde admin en fases posteriores.
- Guardar una copia externa en USB o disco externo.
- Probar restore en entorno de prueba antes de operar en produccion.

## Riesgos

- Si el servidor se apaga, ningun cliente puede facturar.
- IP dinamica rompe acceso de clientes.
- Cortes de energia pueden afectar datos; se recomienda UPS.
- Sin restore probado, los backups no deben considerarse completos.

