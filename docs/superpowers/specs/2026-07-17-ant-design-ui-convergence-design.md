# Convergencia total de UI sobre Ant Design

Fecha: 2026-07-17
Estado: diseño autorizado para ejecución sin nuevas preguntas

## Decisión

S_Hospital usará Ant Design 6 como única biblioteca de componentes de
interacción. La dependencia ya existe, el proveedor institucional ya envuelve
la aplicación y 98 archivos TSX ya importan Ant Design directamente. No se
añadirá otra librería ni se reescribirá React, Tailwind o AG Grid.

Tailwind 4 seguirá limitado a composición, responsive y utilidades basadas en
tokens institucionales. AG Grid y ECharts conservarán sus adaptadores dentro
del design system. El backend y los contratos API no cambian.

## Dirección visual

La interfaz será una consola clínica utilitaria: IBM Plex Sans local, números
tabulares, superficies planas, geometría rectangular, un acento hospitalario,
densidad operativa controlada y foco visible. No habrá gradientes, sombras
decorativas, animaciones distractoras, dependencias remotas ni patrones de
marketing.

Ant Design aportará comportamiento, estados, accesibilidad base y tokens. El
design system institucional aportará la semántica hospitalaria y configurará
Ant Design; no duplicará widgets generales.

## Alcance

### Componentes de aplicación

- Sustituir botones, controles colapsables y activadores manuales por
  `Button`, `Collapse`, `Dropdown`, `Menu`, `List`, `Table`, `Typography` y
  otros componentes Ant equivalentes.
- Convertir los contenedores institucionales genéricos a composiciones de
  `Card`, `Statistic`, `Flex`, `Space` y `Typography` cuando Ant ya resuelva el
  mismo propósito.
- Mantener AG Grid exclusivamente para grillas operativas con columnas,
  filtros y virtualización.
- Centralizar variaciones visuales en `createInstitutionalTheme` y los tokens
  CSS, no en colores o radios locales.

### Excepciones semánticas

Se permite HTML nativo cuando es el contenido, no un widget visual alterno:

- tablas del recibo institucional y de su vista previa imprimible;
- tablas alternativas accesibles que acompañan gráficos;
- estructura semántica como `nav`, `main`, `section`, `dl`, `ul` y encabezados;
- inputs y botones sintéticos dentro de tests.

Las excepciones se enumerarán en el guard con archivo y motivo. No se aceptará
una exclusión global ni comentarios vagos.

## Arquitectura

### Proveedor y tema

`DesignSystemProvider` seguirá siendo el único punto de `ConfigProvider`. El
tema institucional conservará modo claro/oscuro, color configurable, densidad,
radio cero, motion desactivado y z-index centralizado. Se ampliarán tokens de
componentes solo cuando una migración demuestre una necesidad común.

### Guard de convergencia

El auditor de UI distinguirá:

- imports de librerías legacy;
- wrappers visuales manuales;
- controles HTML interactivos en código productivo;
- tablas de aplicación fuera de la lista semántica permitida;
- estilos locales que contradicen el tema.

El modo `final` deberá quedar con cero violaciones. Sus reglas tendrán tests
unitarios que prueben casos válidos, inválidos y excepciones exactas.

### Migración por zonas

1. Shell y navegación: menú de usuario, paleta de comandos y navegación móvil.
2. Estados compartidos: detalles de error y contenedores institucionales.
3. Operación: filtros de servicio, acciones de historial, carrito y matriz de
   permisos.
4. Certificación: tests de componente, accesibilidad, E2E responsive y bundle.

Cada zona tendrá un commit independiente y deberá dejar su suite focalizada
verde.

## Accesibilidad y UX

- Conservar nombres accesibles, `aria-current`, retorno de foco y navegación
  completa por teclado.
- Usar targets mínimos de 44 CSS px en acciones táctiles.
- Mantener estados loading, empty, error y disabled con texto operativo.
- Evitar scroll horizontal a 320, 390, 768, 1024, 1366 y 1440 px.
- No cambiar reglas fiscales, permisos, dinero, impresión o secuencia de cobro.

## Rendimiento

- No agregar dependencias.
- Conservar carga diferida de AG Grid, ECharts y rutas.
- Mantener bundle inicial por debajo de 488.3 KiB gzip y bundle total por debajo
  de 1074.2 KiB gzip.
- Preferir imports nombrados y componentes ya incluidos en el chunk Ant
  existente.

## Pruebas y aceptación

1. `check:ui-legacy:final` reporta cero violaciones con el guard ampliado.
2. No quedan controles HTML interactivos manuales en producción fuera de las
   excepciones exactas documentadas.
3. TypeScript, ESLint, Vitest y build pasan.
4. Los E2E de shell, facturación, historial, catálogo y administración pasan.
5. Axe no reporta violaciones críticas, serias, moderadas o menores en los
   flujos mantenidos.
6. Los presupuestos de bundle se mantienen.
7. El E2E ordinario no modifica evidencia QA rastreada.
8. La auditoría viva registra métricas antes/después, cambios, descartes y
   excepciones justificadas.

## Riesgos y mitigaciones

- **Regresión visual amplia:** migración por zonas y capturas responsive.
- **Cambio de semántica:** tests de roles y nombres accesibles antes y después.
- **Bundle mayor:** gate de presupuesto obligatorio.
- **Pérdida de densidad:** tokens compactos y pruebas a 1366x768.
- **Sobrescritura de cambios locales:** no tocar ni incluir el lockfile y las
  capturas QA preexistentes del usuario.

## Alternativas descartadas

- **Añadir shadcn, MUI o Chakra:** duplica dependencias y estilos sin resolver
  un problema que Ant Design ya cubre.
- **Eliminar Tailwind de una vez:** mezcla una migración de composición con la
  de widgets y aumenta el riesgo sin beneficio operativo inmediato.
- **Reescribir todas las pantallas:** el sistema actual tiene pruebas y flujos
  correctos; la convergencia dirigida reduce riesgo y código duplicado.
