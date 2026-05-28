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

## 🚀 Arquitectura de Despliegue & Guía de Instalación LAN

### 📋 Arquitectura LAN Recomendada para el Hospital
Para garantizar la integridad fiscal y la sincronización de la caja, el sistema debe operarse en una estructura de **Cliente-Servidor local**:
1. **1 Computadora Servidor Central (LAN):** Aloja el backend, base de datos MariaDB/MySQL, el SPA compilado y realiza las copias de seguridad locales programadas. Debe tener una **IP LAN Estática** configurada.
2. **Estaciones Cliente (Caja, Admisión, Consultorio):** No instalan nada. Acceden exclusivamente a través del navegador web moderno (Chrome o Edge) apuntando a la IP del Servidor.
3. **⚠️ ADVERTENCIA:** *Instalar el sistema localmente por completo en múltiples computadoras individuales (Bare-Metal individual) está estrictamente prohibido para producción hospitalaria.* Esto rompería la coherencia del catálogo, duplicaría los números fiscales e impediría un control de caja unificado.

---

### ⚙️ Requisitos del Servidor
- **Opción Docker (Recomendada):** Docker Desktop para Windows instalado y corriendo.
- **Opción Bare-Metal:** Windows 10/11 o Server, PHP 8.2+ (con extensiones pdo_mysql, intl, gd, zip, mbstring) y MySQL/MariaDB.
- **Privilegios:** Cuenta con privilegios de Administrador para abrir puertos del firewall y programar backups.

---

### 📥 Proceso de Instalación en el Servidor (Fácil y Automatizado)

El sistema incluye un script automatizado que realiza pre-diagnósticos de red, DHCP, firewall y puertos antes de configurar el entorno de forma idempotente y segura:

1. **Descargar / Copiar** los archivos del proyecto a la carpeta final en el Servidor.
2. Haz clic derecho sobre el archivo **[setup.bat](file:///setup.bat)** en la raíz del proyecto.
3. Selecciona **"Ejecutar como administrador"** (obligatorio para configurar el firewall y backups).
4. Sigue el asistente interactivo en pantalla:
   - **Opción 1 (Docker):** Levantará la arquitectura de contenedores aislados con Nginx, MariaDB y PHP-FPM, optimizada para producción con secrets autogenerados.
   - **Opción 2 (Bare-Metal):** Validará tu motor de PHP local, solicitará credenciales de base de datos MySQL de forma interactiva (conservando otros valores locales en el `.env`) y registrará automáticamente las tareas en el **Windows Task Scheduler**.
5. Configura la cuenta del primer Administrador de Hospital y guarda la URL web LAN de acceso.

---

### 🌐 Conexión de Estaciones Cliente
1. Conecta la estación cliente (Caja, Admisión) a la misma red local (LAN/WiFi) del servidor.
2. Abre Google Chrome o Microsoft Edge en la estación cliente.
3. Ingresa la URL LAN del servidor, por ejemplo: `http://192.168.1.15:8000` (reemplaza `192.168.1.15` por la IP fija del servidor).
4. Inicia sesión con la cuenta asignada. La impresora térmica se conecta directamente a la estación cliente y el navegador procesará las impresiones de 80mm o 58mm nativamente.


---

## 🛡️ Licencia

Este software se rige bajo una **Licencia Comercial Propietaria**. Queda prohibida la redistribución no autorizada o copia del código fuente fuera de la instalación clínica autorizada. Consulte el archivo [LICENSE](file:///LICENSE) para más detalles.
