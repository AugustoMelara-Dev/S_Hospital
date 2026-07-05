/**
 * Spanish (Honduras) strings used across the cashier / hospital
 * billing UI.
 *
 * The dictionary is intentionally small. New views can keep their
 * copy inline while a `t()` call acts as a marker for translators
 * to find the surface area. The build step stays simple: there is
 * no runtime dependency on a translation framework because the
 * hospital deploys a single locale and a heavier i18n layer would
 * add attack surface for no operational benefit.
 */

export const STRINGS = {
  app: {
    name: 'Sistema de Caja Hospitalaria',
    tagline: 'Facturacion, caja y reportes para el hospital',
  },
  nav: {
    dashboard: 'Inicio',
    billing: 'Facturacion',
    cashbox: 'Caja',
    catalog: 'Catálogo',
    invoices: 'Historial',
    reports: 'Reportes',
    backups: 'Respaldos',
    users: 'Usuarios',
    settings: 'Configuración',
    help: 'Ayuda',
    logout: 'Cerrar sesión',
  },
  login: {
    title: 'Iniciar sesión',
    username: 'Usuario o correo',
    password: 'Contraseña',
    submit: 'Ingresar',
    ready: 'Listo para iniciar sesion local.',
    changePasswordRequired: 'Debe cambiar su contraseña antes de operar.',
    sessionExpired: 'Sesión vencida. Vuelva a iniciar sesión para continuar.',
    permissionDenied: 'Su usuario no tiene permiso para esta acción. Solicite a un supervisor que revise su rol; no repita la operación varias veces.',
    tooManyAttempts: 'Demasiados intentos. Por seguridad local LAN, su acceso ha sido bloqueado temporalmente. Por favor espere 60 segundos antes de intentar de nuevo.',
  },
  pos: {
    title: 'Nueva factura',
    tagline: 'Factura y cobro en caja',
    openCashFirst: 'Abra caja antes de emitir y cobrar una factura.',
    patientRequired: 'Ingrese el nombre del paciente para emitir.',
    needItems: 'Agregue al menos un servicio.',
    issued: (invoiceNumber: string) => `Factura emitida ${invoiceNumber}.`,
    paymentOpen: (invoiceNumber: string) => `Factura emitida ${invoiceNumber}. Cobro abierto.`,
    receiptReady: (invoiceNumber: string) => `Factura emitida ${invoiceNumber}. Recibo listo para imprimir.`,
    paymentRegisteredPreview: (invoiceNumber: string) => `Pago registrado. Vista previa ${invoiceNumber} lista.`,
    paymentRegisteredPrint: (invoiceNumber: string) => `Pago registrado. Recibo ${invoiceNumber} enviado a impresión.`,
    pendingInvoice: (invoiceNumber: string) => `Factura ${invoiceNumber} emitida. Quedo pendiente de cobro; puede cobrarla desde este panel o desde Historial.`,
    cartEmpty: 'Agregue servicios',
    cartConfirm: 'Emitir y cobrar',
    cartConfirmOnly: 'Emitir factura',
    clearCart: 'Carrito limpiado.',
  },
  cashbox: {
    title: 'Caja',
    open: 'Abrir caja',
    close: 'Cerrar caja',
    openingAmount: 'Monto inicial',
    closingAmount: 'Monto contado',
    notes: 'Notas',
    needDifferenceNote: 'Explique la diferencia de caja antes de cerrar.',
    pendingInvoices: (count: number, amount: string) => `No se puede cerrar la caja con ${count} factura(s) pendientes o parciales por L ${amount}. Revise los cobros antes de cerrar.`,
  },
  invoices: {
    title: 'Historial de facturas',
    void: 'Anular',
    reprint: 'Reimprimir',
    confirmVoid: 'Indique el motivo de anulación.',
    receipt: 'Recibo',
  },
  errors: {
    serverUnavailable: 'No se pudo conectar con el servidor LAN. Revise que el servidor local este encendido y vuelva a intentar.',
    serverError: 'El servidor LAN no pudo completar la operación. Revise el servidor local e intente de nuevo.',
    conflict: 'La acción no se pudo completar porque el estado actual cambió. Actualice la pantalla e intente de nuevo.',
    locked: 'Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.',
  },
  units: {
    lempiras: 'L',
    invoice: 'Factura',
    invoices: 'Facturas',
    payment: 'Pago',
    payments: 'Pagos',
  },
} as const;

export type Strings = typeof STRINGS;

export function t(): Strings {
  return STRINGS;
}
