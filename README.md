# Hospital Billing OS 🏥💳
> **El sistema definitivo de facturación, caja y reportes clínicos para redes locales (LAN) fuera de línea.**

---

Hospital Billing OS es un producto de software premium diseñado específicamente para clínicas, consultorios y hospitales que requieren alta disponibilidad, velocidad y operatividad al 100% sin depender de una conexión a internet. La aplicación opera localmente, permitiendo conectar múltiples estaciones de trabajo (clientes) a una computadora servidor a través de la red local.

---

## 🎨 Características UI/UX Premium & Identidad Visual

- **Diseño Ultra-Moderno:** Interfaz intuitiva y elegante optimizada para cajeros y personal médico, con transiciones fluidas, animaciones micro-interactivas y soporte nativo para **Modo Oscuro** (toggled al instante).
- **Personalización de Marca:** Panel de administración donde puedes subir el logotipo oficial de tu hospital/clínica y seleccionar paletas de colores dinámicas (Teal, Blue, Green, Indigo, Rose) que re-estilizan la aplicación en tiempo real.
- **POS Rápido y Eficiente (Punto de Venta):** 
  - Emisión de facturas en menos de 10 segundos.
  - Búsqueda predictiva de servicios y filtrado instantáneo por categorías.
  - Soporte completo para lectores de código de barras y códigos QR.
  - Atajos de teclado nativos para velocidad extrema (`Ctrl+N` para Paciente, `Ctrl+Enter` para Emitir y cobrar, `Esc` para Limpiar).
- **Eritropoyetina Gratis:** Regla inteligente integrada de subsidio para pacientes con diálisis (Eritropoyetina L.25 gratuita al marcar receta).

---

## 📊 Reportes Avanzados & Motor de Exportación en Excel

- **Dashboard Ejecutivo:** Gráficos estadísticos e interactivos usando **Recharts**:
  - Tendencias de ingresos de los últimos 7 días.
  - Distribución de ventas por método de pago (Efectivo, Tarjeta, Transferencia).
  - Listado de servicios más vendidos e ingresos acumulados.
  - KPIs con micro-gráficos de tendencias (Sparklines).
- **Exportación Profesional a Excel (.xlsx):**
  - Hojas de cálculo formateadas profesionalmente con estilos corporativos.
  - Gráficos nativos incrustados directamente en Excel para ingresos, servicios y categorías.
  - Criterio de negocio inalterable: los históricos se calculan sobre snapshots de la factura, protegiendo reportes del cambio de precios en el catálogo.

---

## 🔐 Seguridad, Concurrencia y Resiliencia LAN

- **Control de Acceso Basado en Roles (RBAC):** Permisos granulares para Administradores, Supervisores y Cajeros. Auditoría completa de acciones críticas (reimpresiones, anulaciones, exportaciones).
- **Control Antifraude de Caja:** Ningún cajero puede operar o cobrar sin abrir un turno de caja. El cierre de caja valida montos teóricos contra montos reportados.
- **Preparado para Alta Concurrencia:** Lógica de bloqueos a nivel de base de datos (`SELECT FOR UPDATE`) para evitar la duplicación de números de factura secuenciales y la sobreescritura de caja en horas pico.
- **Copias de Seguridad Offline:** Panel de backup manual e instalador de tareas programadas automáticas para Windows, garantizando que tus datos financieros estén siempre a salvo de fallos de hardware.
- **Impresión Térmica Flexible:** Soporte configurable para anchos estándar de papel térmico (80mm y 58mm).

---

## ⚙️ Estructura del Stack Tecnológico

El sistema está construido con tecnologías modernas y robustas diseñadas para alto rendimiento local:
1. **Frontend:** React + TypeScript + Tailwind CSS v4 + Radix UI.
2. **Backend:** Laravel 10 (PHP 8.2+) con MySQL/MariaDB robusto y rápido.
3. **Reportes:** ExcelJS para la construcción de reportes visuales avanzados en cliente sin sobrecargar el servidor.

---

## 🚀 Guía de Instalación y Despliegue LAN

### Requisitos Previos (Servidor)
- Servidor local Windows con **XAMPP** (PHP 8.2+, MySQL/MariaDB) o **Docker**.
- Node.js 18+ para compilación y desarrollo.

### Configuración del Servidor LAN

1. **Instalar Dependencias:**
   ```bash
   # Backend
   cd backend
   composer install
   cp .env.example .env
   php artisan key:generate
   php artisan migrate --seed

   # Frontend
   cd ../frontend
   npm install
   npm run build
   ```

2. **Iniciar Servidor Local:**
   Puedes usar el servidor local Apache/MySQL de XAMPP y apuntar el VirtualHost al directorio `/public` de Laravel.
   Alternativamente, inicia de forma reproducible usando Docker Compose:
   ```bash
   docker compose up -d
   docker compose exec app php artisan migrate --seed
   ```

### Acceso de Clientes LAN
Para que otras computadoras en la misma clínica/hospital utilicen el sistema:
1. Obtén la dirección IP del servidor local (ej. `192.168.1.150`).
2. Configura los hosts o accede directamente en los navegadores de las computadoras cliente ingresando:
   `http://192.168.1.150:8000` (o el puerto configurado en Apache/Docker).
3. ¡Listo! El sistema funciona instantáneamente compartiendo la misma base de datos local de forma segura.

---

## 🛡️ Licencia

Este software se rige bajo una **Licencia Comercial Propietaria**. Queda prohibida la redistribución no autorizada o copia del código fuente fuera de la instalación clínica autorizada. Consulte el archivo [LICENSE](file:///LICENSE) para más detalles.
