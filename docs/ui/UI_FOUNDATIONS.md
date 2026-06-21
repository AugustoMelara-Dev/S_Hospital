# UI Foundations - S_Hospital

## Proposito

El sistema visual de S_Hospital define una base institucional, sobria y compatible con patrones shadcn/ui para una aplicacion de caja y facturacion hospitalaria offline LAN. Esta fase solo consolida tokens y primitivas compartidas; las pantallas de dominio se migraran por fases.

## Tokens semanticos

Base:

- `background`
- `foreground`
- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`
- `muted`
- `muted-foreground`
- `accent`
- `accent-foreground`

Superficie:

- `card`
- `card-foreground`
- `popover`
- `popover-foreground`
- `border`
- `input`

Interaccion:

- `ring`

Estado:

- `destructive`
- `destructive-foreground`
- `success`
- `success-foreground`
- `warning`
- `warning-foreground`
- `info`
- `info-foreground`

Navegacion:

- `sidebar`
- `sidebar-foreground`
- `sidebar-primary`
- `sidebar-primary-foreground`
- `sidebar-accent`
- `sidebar-accent-foreground`
- `sidebar-border`
- `sidebar-ring`

## Light y dark mode

Los tokens existen para light mode y `html.dark`. No se deben crear colores crudos por pantalla si existe un token semantico. El dark mode se conserva para operadores y debe mantener contraste suficiente en texto, bordes, inputs, foco y estados.

## Colores de estado

`success`, `warning`, `info` y `destructive` comunican estado operativo, no severidad clinica. No deben usarse para diagnostico medico. Cuando un estado sea critico, el texto visible tambien debe explicar la situacion; no depender solo del color.

## Iconos

Los iconos dentro de componentes compartidos deben marcarse con `data-icon` cuando sea posible:

```tsx
<CheckCircle data-icon aria-hidden="true" />
```

`Button` tambien normaliza hijos SVG sin clase de tamano explicita. Los iconos decorativos deben usar `aria-hidden="true"`; los botones de solo icono deben tener `aria-label`.

## Espaciado

Los componentes nuevos deben preferir `gap` en contenedores flex/grid. Evitar acumular `space-y-*` en estructuras complejas porque se vuelve fragil al insertar mensajes, errores o acciones.

## Focus visible

No se debe eliminar `outline` o `focus-visible` sin reemplazo. El token `ring` es la fuente visual para foco por teclado. Inputs, botones, tabs, selects, dialogs y tablas con scroll deben tener foco visible.

## Formularios

Usar `Label`, `Input`, `Textarea`, `Select`, `Checkbox` y `FormField` para conservar asociaciones accesibles. Los controles invalidos deben exponer `aria-invalid`. Los errores inline deben estar conectados con `aria-describedby` y `role="alert"` cuando correspondan.

## Tablas

Usar la primitiva `Table` para mantener estructura `table`, `thead`, `tbody`, `tr`, `th` y `td`. El wrapper permite scroll horizontal. Montos y columnas numericas pueden usar `tabular-nums` o `data-numeric="true"`.

## Dialogs

`Dialog`, `Sheet`, `ConfirmDialog` y `AlertDialog` deben conservar overlay, portal, cierre por Escape y navegacion por teclado de Radix. Todo dialog debe tener titulo accesible y descripcion visible o `sr-only`.

## Compatibilidad hacia atras

Las APIs existentes de los componentes compartidos se conservan. Las nuevas propiedades y exports son opcionales. No se deben reemplazar componentes completos generados por CLI ni cambiar imports existentes sin una fase dedicada.

## Que no debe hacerse

- No ejecutar `shadcn init`, `shadcn add`, `shadcn apply` ni `npx shadcn`.
- No instalar dependencias visuales nuevas en esta fase.
- No usar gradientes, glassmorphism ni sombras pesadas.
- No inventar logo, marca, nombre legal o datos fiscales.
- No mover logica de negocio al frontend.
- No modificar facturacion, pagos, caja, recibos, PDF, rutas ni permisos desde componentes visuales.

## Componentes disponibles

- `Button`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
- `Badge`
- `Alert`, `AlertTitle`, `AlertDescription`
- `Input`
- `Textarea`
- `Label`
- `Checkbox`
- `Select`, `NativeSelect` y subcomponentes Radix locales
- `Dialog`
- `ConfirmDialog`
- `AlertDialog` y subcomponentes
- `Sheet`
- `Table` y subcomponentes
- `Tabs` y subcomponentes
- `FormField`
- `LoadingState`, `EmptyState`, `ErrorState`, `Skeleton`
- `Toaster`, `notify`, `toast`

## Ejemplos breves

```tsx
<Button>
  <Save data-icon aria-hidden="true" />
  Guardar
</Button>
```

```tsx
<FormField id="patient-name" label="Nombre del paciente" error={error}>
  {({ id, describedBy, invalid }) => (
    <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
  )}
</FormField>
```

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="danger">Anular</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmar anulacion</AlertDialogTitle>
      <AlertDialogDescription>Esta accion requiere motivo y auditoria.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction>Confirmar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Migracion por fases

Las pantallas completas no se redisenan en esta fase. Fases posteriores deben migrar AppShell, navegacion, formularios largos, tablas de dominio y flujos criticos con pruebas especificas y commits separados.
