# Correcciones de entrega

Objetivo: corregir impresión, contraste y reportes sin alterar usuarios, cajas ni datos del servidor en uso. Especificación: AGENTS.md y defectos reproducidos en la validación de entrega.

- [x] Impresión: reproducir en tests; guardar opciones básicas sin payload técnico innecesario; exigir motivo para cambios técnicos y mostrar el error. Corregir dimensiones de formato personalizado.
- [x] Reportes: reproducir403 inicial; garantizar el turno propio en consultas y exportaciones del cajero, también al cambiar sesión o filtros URL; conservar filtros de administrador.
- [x] Contraste: reproducir con axe real y corregir colores mínimos hasta AA, sin desactivar reglas. El usuario amplió a tema claro hospitalario global.
- [x] Integración: revisar diffs, TypeScript, ESLint, Vitest y navegador contra build separado y una base MariaDB nueva. Repetir flujos financieros solo en el laboratorio nuevo.
- [x] Entrega: publicar estáticos y corrección backend tras verificar, conservando assets anteriores y sesiones persistidas; documentar resultados y límites.

Alcance actualizado por el usuario: tema claro blanco/azul y gestión de catálogo
para administrador y supervisor. Detalle en `2026-10-22-hospital-light-ui.md`.
No modificar credenciales, cuentas, cajas ni comprobantes de18462. Añadir únicamente
`catalog.manage` al rol supervisor solicitado; no sincronizar roles completos.
No reconstruir sobre dist activo ni borrar assets anteriores. El arreglo backend
se publica después de QA aislado, recargando PHP con el mismo entorno y sesiones
persistidas, sin detener Caddy ni ejecutar migraciones/seeders sobre el servidor.
