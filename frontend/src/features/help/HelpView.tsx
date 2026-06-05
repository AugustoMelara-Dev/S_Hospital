import { useMemo, useState } from 'react';
import {
  Archive,
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  ClipboardList,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  LogIn,
  Monitor,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { type ShortcutScope, shortcutLabel, shortcutsByScope } from '../../lib/shortcuts';
import { buildClientIssueSupportSummary, getClientIssues } from '../../lib/support/clientIssueLog';

const guides = [
  {
    title: 'Abrir el sistema',
    icon: Monitor,
    steps: ['Use el acceso institucional del escritorio', 'Espere a que cargue Hospital San Isidro', 'Confirme que no aparezca error de servidor', 'Si no abre, avise antes de intentar cambios'],
  },
  {
    title: 'Iniciar sesion',
    icon: LogIn,
    steps: ['Use su propio usuario', 'No comparta contrasena ni cuenta de turno', 'Si la sesion vence, ingrese de nuevo', 'Si falta permiso, pida revision de rol'],
  },
  {
    title: 'Abrir caja',
    icon: WalletCards,
    steps: ['Entre a Caja', 'Revise el cajero responsable', 'Registre el efectivo inicial', 'Confirme que la caja quede abierta'],
  },
  {
    title: 'Nueva factura',
    icon: ReceiptText,
    steps: ['Escriba primero el nombre del paciente', 'Busque servicios por nombre o área', 'Revise el carrito y total', 'Emita solo cuando todo esté correcto'],
  },
  {
    title: 'Cobrar',
    icon: Banknote,
    steps: ['Seleccione el método de pago', 'Digite monto recibido y referencia si aplica', 'Revise cambio o saldo pendiente', 'Confirme una sola vez'],
  },
  {
    title: 'Imprimir recibo',
    icon: Printer,
    steps: ['Abra la vista de recibo', 'Revise paciente, número, total y cajero', 'Use papel media carta, carta o A5', 'Entregue original y conserve copia si corresponde'],
  },
  {
    title: 'Reimprimir',
    icon: RefreshCw,
    steps: ['Entre a Historial', 'Busque por paciente, fecha o número', 'Abra la factura correcta', 'Registre motivo de reimpresión'],
  },
  {
    title: 'Reportes',
    icon: Search,
    steps: ['Entre a Reportes', 'Seleccione rango y área si aplica', 'Revise facturado, cobrado y saldos', 'Exporte solo si su rol lo permite'],
  },
  {
    title: 'Respaldos',
    icon: Archive,
    steps: ['Entre a Respaldos', 'Revise si dice Todo bien, Requiere revisión o Error', 'Cree respaldo antes de cambios grandes', 'Avise si aparece Error'],
  },
  {
    title: 'Cierre de turno',
    icon: ClipboardCheck,
    steps: ['Revise pagos por método', 'Compare efectivo esperado y contado', 'Registre diferencias con motivo', 'Cierre caja solo al final del turno'],
  },
  {
    title: 'Pedir soporte',
    icon: LifeBuoy,
    steps: ['Anote qué pantalla estaba usando', 'No repita facturas ni cobros', 'Abra Respaldos si es administrador', 'Comparta el diagnóstico o el mensaje visible'],
  },
];

const incidentGuides = [
  {
    title: 'Servidor no disponible',
    answer: 'Revise que la computadora servidor esté encendida y que el cliente use la dirección local correcta. Si persiste, avise al responsable del sistema.',
  },
  {
    title: 'Impresora no responde',
    answer: 'No repita la factura ni el cobro. Abra el recibo desde Historial, verifique la impresora y reimprima con motivo cuando el supervisor lo autorice.',
  },
  {
    title: 'Falla la red',
    answer: 'Detenga nuevas facturas desde computadoras cliente. Use solo la computadora servidor si administración lo autoriza.',
  },
  {
    title: 'Se fue la luz o reinició la PC',
    answer: 'Abra el sistema nuevamente y revise Caja e Historial antes de repetir facturas o pagos. Si la caja quedó abierta, cierre con conteo real y nota.',
  },
  {
    title: 'Caja quedó abierta',
    answer: 'No abra otra caja para ocultarlo. Revise pagos pendientes, efectivo contado y solicite al supervisor cerrar con observación.',
  },
  {
    title: 'Diferencia de caja',
    answer: 'No cierre sin revisar pagos, anulaciones, movimientos y efectivo contado. Registre la diferencia y solicite revisión.',
  },
  {
    title: 'Respaldo fallido',
    answer: 'No borre archivos ni repita restauraciones. Pida al administrador revisar espacio, estado de respaldos y último error.',
  },
  {
    title: 'Base de datos necesita restaurarse',
    answer: 'Detenga facturación nueva, conserve el respaldo más reciente y pida al administrador validar primero en una base aislada. Nunca restaure producción sin autorización y evidencia.',
  },
  {
    title: 'Sesión vencida',
    answer: 'Ingrese de nuevo. Si estaba cobrando, revise Historial antes de intentar otra vez.',
  },
  {
    title: 'Sin permiso',
    answer: 'No use la cuenta de otra persona. Pida al supervisor revisar su rol y permisos.',
  },
  {
    title: 'Se cerro el navegador',
    answer: 'Abra el acceso institucional de nuevo. Revise Caja e Historial antes de repetir una factura, cobro o reimpresion.',
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
    answer: 'Gestiona usuarios, catálogo, configuración fiscal, respaldos y restauraciones. No use la base de producción para prácticas.',
  },
];

const dailyChecklists = [
  {
    title: 'Cajero - inicio de turno',
    items: [
      'Abrir el sistema desde el acceso institucional.',
      'Entrar con su propio usuario.',
      'Abrir caja con monto inicial real.',
      'Confirmar que impresora y papel esten listos.',
    ],
  },
  {
    title: 'Antes de cerrar turno',
    items: [
      'Revisar facturas pendientes y pagos por metodo.',
      'Comparar efectivo esperado contra efectivo contado.',
      'Anotar diferencias antes de cerrar.',
      'Crear o confirmar respaldo si el supervisor lo solicita.',
    ],
  },
  {
    title: 'Supervisor - revision diaria',
    items: [
      'Confirmar que cada cajero opera con su propio usuario.',
      'Revisar cajas abiertas, diferencias y facturas pendientes.',
      'Autorizar reimpresiones o anulaciones solo con motivo claro.',
      'Pedir resumen seguro de Ayuda si hubo red, impresora o permisos fallando.',
    ],
  },
  {
    title: 'Administrador - revision diaria',
    items: [
      'Revisar Estado operativo en Respaldos.',
      'Confirmar ultimo respaldo protegido.',
      'Revisar espacio en disco y respaldos pendientes o con error.',
      'Guardar evidencia si hubo fallas de red, impresion o energia.',
    ],
  },
];

const delicateActions = [
  {
    title: 'Anulacion',
    warning: 'Solo supervisor o administrador. Revise factura, pago y motivo antes de confirmar.',
  },
  {
    title: 'Restauracion de respaldo',
    warning: 'Nunca restaure sobre datos reales sin respaldo reciente, autorizacion y base aislada de prueba.',
  },
  {
    title: 'Cierre con diferencia',
    warning: 'No cierre para ocultar errores. Registre conteo real, motivo y pida revision.',
  },
  {
    title: 'Cambio de red o servidor',
    warning: 'No cambie direcciones al azar. Valide acceso LAN desde una segunda computadora antes de operar.',
  },
];

const shortcutSections: Array<{ title: string; scope: ShortcutScope; helper: string }> = [
  {
    title: 'Caja y facturacion',
    scope: 'pos',
    helper: 'Use estos atajos durante el trabajo de alto volumen. No activan acciones mientras escribe en campos de texto.',
  },
  {
    title: 'Caja',
    scope: 'cash',
    helper: 'Accesos rapidos para abrir o revisar caja cuando el turno esta activo.',
  },
  {
    title: 'Historial y reportes',
    scope: 'history',
    helper: 'Ayudan a navegar sin perder el contexto de la factura o turno.',
  },
];

function SupportEvidenceCard() {
  const [showDetails, setShowDetails] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const issues = useMemo(() => getClientIssues(), []);
  const latestIssues = issues.slice(0, 3);
  const supportSummary = useMemo(
    () => buildClientIssueSupportSummary(issues, {
      app_origin: window.location.origin,
      current_route: window.location.pathname,
    }),
    [issues],
  );

  const handlePrepareSummary = async () => {
    setShowSummary(true);

    if (!navigator.clipboard?.writeText) {
      setCopyStatus('Resumen listo para mostrar al responsable de soporte.');
      return;
    }

    try {
      await navigator.clipboard.writeText(supportSummary);
      setCopyStatus('Resumen copiado. Puede pegarlo en el mensaje de soporte.');
    } catch {
      setCopyStatus('Resumen listo para mostrar al responsable de soporte.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidencia local para soporte</CardTitle>
        <CardDescription>Mensajes seguros guardados en este navegador cuando una pantalla o conexión falla.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Incidentes guardados: <span className="font-semibold text-foreground">{issues.length}</span>. No incluye contraseñas, tokens ni claves.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handlePrepareSummary}>
              <ClipboardList aria-hidden="true" className="size-4" />
              Preparar resumen
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowDetails((current) => !current)}>
              {showDetails ? 'Ocultar evidencia' : 'Ver evidencia'}
            </Button>
          </div>
        </div>
        {copyStatus ? <p className="text-sm font-medium text-secondary">{copyStatus}</p> : null}

        {showSummary ? (
          <Textarea
            aria-label="Resumen seguro para soporte"
            readOnly
            value={supportSummary}
            className="min-h-48 font-mono text-xs leading-5"
          />
        ) : null}

        {showDetails ? (
          latestIssues.length > 0 ? (
            <ul className="space-y-2">
              {latestIssues.map((issue) => (
                <li key={`${issue.occurred_at}-${issue.action ?? 'acción'}`} className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">{issue.module ?? 'sistema'} - {issue.action ?? 'acción no indicada'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.safe_message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{issue.route} - {new Date(issue.occurred_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              No hay incidentes guardados en este navegador.
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

export function HelpView() {
  return (
    <section className="space-y-6" aria-labelledby="help-title">
      <PageHeader
        title="Ayuda institucional"
        description="Guía rápida para operar caja, facturación, recibos, reportes y respaldos."
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
            <Keyboard aria-hidden="true" className="size-5 text-secondary" />
            Atajos de teclado
          </CardTitle>
          <CardDescription>Referencia para operar con teclado sin memorizar comandos externos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {shortcutSections.map((section) => (
            <div key={section.scope} className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.helper}</p>
              <dl className="mt-4 space-y-3">
                {shortcutsByScope(section.scope).map((shortcut) => (
                  <div key={`${section.scope}-${shortcut.scope}-${shortcutLabel(shortcut)}`} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs font-semibold text-foreground">
                      {shortcutLabel(shortcut)}
                    </dt>
                    <dd className="text-right text-sm leading-5 text-muted-foreground">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </CardContent>
      </Card>

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
          <CardDescription>Referencia corta para saber quién debe actuar en cada caso.</CardDescription>
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
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck aria-hidden="true" className="size-5 text-secondary" />
            Checklist diario por rol
          </CardTitle>
          <CardDescription>Pasos cortos para iniciar, cerrar y revisar el turno sin depender de soporte local.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {dailyChecklists.map((checklist) => (
            <div key={checklist.title} className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">{checklist.title}</h3>
              <ul className="mt-3 space-y-2">
                {checklist.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 text-amber-700" />
            Acciones delicadas
          </CardTitle>
          <CardDescription>Advertencias antes de tocar datos, caja, respaldos o configuracion de red.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {delicateActions.map((item) => (
            <div key={item.title} className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-amber-900">{item.warning}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacitación segura</CardTitle>
          <CardDescription>Practique sin afectar facturas, caja ni respaldos reales.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">Checklist diario</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cajero: abrir caja, facturar, cobrar, imprimir y cerrar. Supervisor: revisar diferencias y anulaciones.
              Administrador: revisar usuarios, respaldos, espacio y pruebas de restauración.
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">Modo práctica</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Si no existe un entorno de práctica aislado, capacite en una instalación separada o una base descartable.
              No use la base de producción para ensayar anulaciones, restauraciones o cobros ficticios.
            </p>
          </div>
        </CardContent>
      </Card>

      <SupportEvidenceCard />
    </section>
  );
}
