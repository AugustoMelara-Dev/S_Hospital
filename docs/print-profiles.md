# Perfiles de impresión institucional

## Regla operativa

El usuario selecciona Carta, Media carta o A5. El sistema aplica el perfil
institucional completo. No existe autoimpresión ni configuración de márgenes,
fuentes, medidas o escala dentro de la aplicación.

Imprimir, descargar o reimprimir siempre requiere una acción explícita. La
primera impresión y cada reimpresión institucional generan el evento de
auditoría correspondiente antes de abrir el documento.

## Papeles disponibles

| Papel | Código operativo | Uso |
|---|---|---|
| Carta | `carta_horizontal` | Documento institucional completo |
| Media carta | `media_carta_horizontal` | Recibo institucional predeterminado |
| A5 | `a5_horizontal` | Documento institucional compacto |

El selector normal contiene exactamente estas tres opciones. Orientación,
tamaño, márgenes, tipografía, escala y saltos de página pertenecen al perfil
interno versionado, no al formulario del hospital.

## Controles permitidos

La pantalla de recibos permite:

- seleccionar Carta, Media carta o A5;
- elegir la cantidad de copias;
- reservar espacio para sello o firma;
- mostrar un logo institucional autorizado;
- generar una impresión de prueba;
- guardar el perfil elegido.

La impresión de prueba lleva la marca `PRUEBA - SIN VALIDEZ` y no consume
correlativo.

## Compatibilidad histórica

Los códigos `thermal_80mm`, `thermal_58mm` y
`recibo_pequeno_personalizado` pueden seguir existiendo en bases instaladas y
en snapshots históricos. No se eliminan ni se reinterpretan. La aplicación no
los presenta como opciones de operación y normaliza cualquier valor heredado a
Media carta cuando necesita resolver un papel institucional actual.

El backend conserva validación defensiva para solicitudes antiguas con campos
técnicos. Esa compatibilidad no constituye una interfaz de configuración para
usuarios del hospital.

## Garantías de impresión

- El recibo principal no incluye QR, códigos de barras ni códigos internos.
- Las filas de servicios y totales evitan cortes de página.
- La firma y el sello mantienen espacio reservado.
- Sidebar, topbar, botones y mensajes de la aplicación no se imprimen.
- El resultado usa fondo blanco, tinta oscura y números tabulares.
- Los activos y las fuentes requeridas se sirven localmente.

## Cobertura automatizada

- `paperPolicy.test.ts` protege el catálogo público de tres papeles.
- `institutionalReceiptPaper.test.ts` protege la normalización histórica.
- `InstitutionalReceiptSettingsView.test.tsx` impide que regresen controles
  técnicos a la aplicación.
- `ReceiptPreview.test.tsx` impide que una propiedad heredada active impresión.
- `InstitutionalReceiptPdfTest.php` verifica el PDF institucional del backend.
- Playwright cubre selección de papel, PDF de prueba e impresión explícita.

## Validación física

El software puede verificar HTML, CSS y PDF automáticamente. La aceptación de
una impresora concreta requiere imprimir Carta, Media carta y A5 en el hardware
del hospital y registrar el resultado en `docs/manual-qa-checklist.md`.
