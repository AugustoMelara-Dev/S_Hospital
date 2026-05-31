import {
  Archive,
  Banknote,
  ClipboardCheck,
  HelpCircle,
  LifeBuoy,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';

const guides = [
  {
    title: 'Abrir caja',
    icon: WalletCards,
    steps: ['Entre a Caja', 'Revise el cajero responsable', 'Registre el efectivo inicial', 'Confirme que la caja quede abierta'],
  },
  {
    title: 'Nueva factura',
    icon: ReceiptText,
    steps: ['Escriba primero el nombre del paciente', 'Busque servicios por nombre o area', 'Revise el carrito y total', 'Emita solo cuando todo este correcto'],
  },
  {
    title: 'Cobrar',
    icon: Banknote,
    steps: ['Seleccione el metodo de pago', 'Digite monto recibido y referencia si aplica', 'Revise cambio o saldo pendiente', 'Confirme una sola vez'],
  },
  {
    title: 'Imprimir recibo',
    icon: Printer,
    steps: ['Abra la vista de recibo', 'Revise paciente, numero, total y cajero', 'Use papel media carta, carta o A5', 'Entregue original y conserve copia si corresponde'],
  },
  {
    title: 'Reimprimir',
    icon: RefreshCw,
    steps: ['Entre a Historial', 'Busque por paciente, fecha o numero', 'Abra la factura correcta', 'Registre motivo de reimpresion'],
  },
  {
    title: 'Reportes',
    icon: Search,
    steps: ['Entre a Reportes', 'Seleccione rango y area si aplica', 'Revise facturado, cobrado y saldos', 'Exporte solo si su rol lo permite'],
  },
  {
    title: 'Respaldos',
    icon: Archive,
    steps: ['Entre a Respaldos', 'Revise si dice Protegido, Pendiente o Error', 'Cree respaldo antes de cambios grandes', 'Avise si aparece Error'],
  },
  {
    title: 'Cierre de turno',
    icon: ClipboardCheck,
    steps: ['Revise pagos por metodo', 'Compare efectivo esperado y contado', 'Registre diferencias con motivo', 'Cierre caja solo al final del turno'],
  },
  {
    title: 'Pedir soporte',
    icon: LifeBuoy,
    steps: ['Anote que pantalla estaba usando', 'No repita facturas ni cobros', 'Abra Respaldos si es administrador', 'Comparta el diagnostico o el mensaje visible'],
  },
];

const incidentGuides = [
  {
    title: 'Servidor no disponible',
    answer: 'Revise que la computadora servidor este encendida y que el cliente use la direccion local correcta. Si persiste, avise al responsable del sistema.',
  },
  {
    title: 'Impresora no responde',
    answer: 'No repita la factura ni el cobro. Abra el recibo desde Historial, verifique la impresora y reimprima con motivo cuando el supervisor lo autorice.',
  },
  {
    title: 'Falla la red',
    answer: 'Detenga nuevas facturas desde computadoras cliente. Use solo la computadora servidor si administracion lo autoriza.',
  },
  {
    title: 'Se fue la luz o reinicio la PC',
    answer: 'Abra el sistema nuevamente y revise Caja e Historial antes de repetir facturas o pagos. Si la caja quedo abierta, cierre con conteo real y nota.',
  },
  {
    title: 'Caja quedo abierta',
    answer: 'No abra otra caja para ocultarlo. Revise pagos pendientes, efectivo contado y solicite al supervisor cerrar con observacion.',
  },
  {
    title: 'Diferencia de caja',
    answer: 'No cierre sin revisar pagos, anulaciones, movimientos y efectivo contado. Registre la diferencia y solicite revision.',
  },
  {
    title: 'Respaldo fallido',
    answer: 'No borre archivos ni repita restauraciones. Pida al administrador revisar espacio, cola de trabajos y ultimo error.',
  },
  {
    title: 'Sesion vencida',
    answer: 'Ingrese de nuevo. Si estaba cobrando, revise Historial antes de intentar otra vez.',
  },
  {
    title: 'Sin permiso',
    answer: 'No use la cuenta de otra persona. Pida al supervisor revisar su rol y permisos.',
  },
];

const roleGuides = [
  {
    title: 'Cajero',
    answer: 'Abre caja, crea facturas, registra pagos, imprime recibos y reporta diferencias antes de cerrar turno.',
  },
  {
    title: 'Supervisor',
    answer: 'Revisa anulaciones, reimpresiones, diferencias de caja y autorizaciones especiales durante el turno.',
  },
  {
    title: 'Administrador',
    answer: 'Gestiona usuarios, catalogo, configuracion fiscal, respaldos y restauraciones. No use la base de produccion para practicas.',
  },
];

export function HelpView() {
  return (
    <section className="space-y-6" aria-labelledby="help-title">
      <PageHeader
        title="Ayuda institucional"
        description="Guia rapida para operar caja, facturacion, recibos, reportes y respaldos."
        actions={
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
            <HelpCircle aria-hidden="true" className="size-4" />
            Manual operativo
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {guides.map((guide) => {
          const Icon = guide.icon;

          return (
            <Card key={guide.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{guide.title}</CardTitle>
                    <CardDescription>Pasos principales</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {guide.steps.map((step, index) => (
                    <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff aria-hidden="true" className="size-5 text-secondary" />
            Incidentes durante el turno
          </CardTitle>
          <CardDescription>Acciones seguras antes de continuar facturando.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {incidentGuides.map((item) => (
            <div key={item.title} className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsabilidades por rol</CardTitle>
          <CardDescription>Referencia corta para saber quien debe actuar en cada caso.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {roleGuides.map((item) => (
            <div key={item.title} className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacitacion segura</CardTitle>
          <CardDescription>Practique sin afectar facturas, caja ni respaldos reales.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">Checklist diario</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cajero: abrir caja, facturar, cobrar, imprimir y cerrar. Supervisor: revisar diferencias y anulaciones.
              Administrador: revisar usuarios, respaldos, espacio y pruebas de restauracion.
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">Modo practica</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Si no existe un entorno de practica aislado, capacite en una instalacion separada o una base descartable.
              No use la base de produccion para ensayar anulaciones, restauraciones o cobros ficticios.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
