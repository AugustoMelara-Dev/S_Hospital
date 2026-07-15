# Inspección visual de progreso — shell 1366×768

Fecha: 15 de julio de 2026.  
Frontend: worktree `codex/operational-ux` en Vite 8.0.16.  
API: servidor LAN local con datos de validación.

Captura: [`shell-1366x768.png`](shell-1366x768.png).

## Confirmado visualmente

- rail de 224 px con contenido principal más ancho;
- nombre `Hospital General San Isidro` legible en dos líneas;
- wordmark y estado `Identidad provisional` visibles;
- navegación activa y grupos legibles;
- tarjeta de usuario eliminada del pie del rail;
- encabezado reducido a ubicación, caja, búsqueda, ayuda y usuario;
- sin scroll horizontal en el viewport inspeccionado.

## Defectos que permanecen abiertos

- `Nueva factura` aparece en la barra de contexto y en el encabezado propio de
  la página; se resolverá al compactar la composición de facturación;
- el aviso de caja, el bloque editorial de paciente y el resumen verde siguen
  sobredimensionados;
- esta captura no valida tablet, móvil ni zoom; esas comparaciones se realizan
  después del bloque responsive de facturación.

La captura aprueba únicamente la dirección del shell. No es evidencia de cierre
de facturación ni una captura canónica final de `after/`.
