import { ArchiveIcon as Archive, BanknoteIcon as Banknote, ClipboardCheckIcon as ClipboardCheck, GraduationCapIcon as GraduationCap, PrinterIcon as Printer, ReceiptTextIcon as ReceiptText, RefreshCwIcon as RefreshCw, WifiOffIcon as WifiOff } from 'lucide-react';

export const roleChecklists = {
  cajero: [
    'Entrar con usuario propio y confirmar caja abierta.',
    'Verificar paciente, servicios y total antes de emitir.',
    'Cobrar solo con caja activa y metodo correcto.',
    'Imprimir o guardar recibo institucional al finalizar.',
    'Cerrar caja con conteo fisico y nota si hay diferencia.',
  ],
  supervisor: [
    'Revisar cajas abiertas y facturas pendientes.',
    'Autorizar anulaciones o reversiones solo con motivo claro.',
    'Confirmar reporte diario antes de cierre administrativo.',
    'Escalar problemas tecnicos con hora, pantalla y usuario afectado.',
  ],
  admin: [
    'Confirmar respaldos diarios y espacio disponible.',
    'Mantener datos fiscales e institucionales actualizados.',
    'Crear usuarios reales y desactivar accesos que ya no apliquen.',
    'Ejecutar pruebas de restore solo en base descartable.',
  ],
};

export const supportPlaybooks = [
  {
    title: 'Servidor o red local no responde',
    icon: WifiOff,
    steps: ['Verificar que la PC servidor este encendida', 'Ejecutar reparacion segura', 'Abrir el sistema desde la IP LAN', 'Registrar hora y pantalla si persiste'],
  },
  {
    title: 'Caja no permite cobrar',
    icon: Banknote,
    steps: ['Confirmar caja abierta del cajero actual', 'Revisar que la factura no este anulada o pagada', 'Actualizar la pantalla', 'Solicitar supervisor si es factura historica'],
  },
  {
    title: 'Factura emitida dos veces',
    icon: ReceiptText,
    steps: ['No borrar registros', 'Buscar por paciente y hora', 'Anular solo con permiso y motivo', 'Registrar hallazgo para auditoria'],
  },
  {
    title: 'Recibo no imprime',
    icon: Printer,
    steps: ['Abrir vista previa del recibo', 'Confirmar impresora predeterminada', 'Reintentar reimpresion desde historial', 'Guardar evidencia para soporte'],
  },
  {
    title: 'Respaldos',
    icon: Archive,
    steps: ['Revisar ultimo respaldo completado', 'Crear respaldo manual antes de cambios grandes', 'No restaurar sobre base real sin autorizacion', 'Validar restore en base descartable'],
  },
  {
    title: 'Cierre diario',
    icon: ClipboardCheck,
    steps: ['Revisar pagos por metodo', 'Confirmar diferencias de caja', 'Revisar anulaciones y reimpresiones', 'Crear respaldo final del dia'],
  },
  {
    title: 'Reimpresion',
    icon: RefreshCw,
    steps: ['Buscar factura en historial', 'Confirmar paciente y total', 'Registrar motivo de reimpresion', 'Entregar copia marcada como corresponde'],
  },
  {
    title: 'Capacitacion segura',
    icon: GraduationCap,
    steps: ['No practicar con pacientes reales', 'Usar entorno local o base descartable autorizada', 'No ejecutar reset en servidor real', 'Crear respaldo antes de cualquier simulacro'],
  },
];
