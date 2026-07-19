import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Banknote, ClipboardCheck, ClipboardList, HelpCircle, Keyboard, LifeBuoy, LogIn, Monitor, Printer, ReceiptText, RefreshCw, Search, WalletCards, WifiOff } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/design-system/components/PageHeader';
import { type ShortcutScope, shortcutLabel, shortcutsByScope } from '../../lib/shortcuts';
import { buildClientIssueSupportSummary, getClientIssues } from '../../lib/support/clientIssueLog';


const guides = [
  {
    title: 'Abrir el sistema',
    icon: Monitor,
    steps: ['Use el acceso institucional del escritorio', 'Espere a que cargue Hospital San Isidro', 'Confirme que no aparezca error de servidor', 'Si no abre, avise antes de intentar cambios'],
  },
  {
    title: 'Iniciar sesión',
    icon: LogIn,
    steps: ['Use su propio usuario', 'No comparta contraseña ni cuenta de turno', 'Si la sesión vence, ingrese de nuevo', 'Si falta permiso, pida revisión de rol'],
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
    steps: ['Abra la vista de recibo', 'Revise paciente, número, total y cajero', 'Use papel carta, media carta o A5', 'Entregue original y conserve copia si corresponde'],
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
    answer: 'Detenga nuevas facturas hasta confirmar que el sistema local responde. Revise Caja e Historial antes de intentar de nuevo.',
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
    answer: 'No borre archivos ni intente recuperar datos desde la app. Pida al administrador revisar espacio, cola de trabajos y último error.',
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
    answer: 'Abra el acceso institucional de nuevo. Revise Caja e Historial antes de repetir una factura, cobro o reimpresión.',
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
    answer: 'Gestiona usuarios, catálogo, configuración fiscal y respaldos. La recuperación de datos se coordina con soporte desde el servidor local.',
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
      'Revisar facturas pendientes y pagos por método.',
      'Comparar efectivo esperado contra efectivo contado.',
      'Anotar diferencias antes de cerrar.',
      'Crear o confirmar respaldo si el supervisor lo solicita.',
    ],
  },
  {
    title: 'Supervisor - revisión diaria',
    items: [
      'Confirmar que cada cajero opera con su propio usuario.',
      'Revisar cajas abiertas, diferencias y facturas pendientes.',
      'Autorizar reimpresiones o anulaciones solo con motivo claro.',
      'Pedir resumen seguro de Ayuda si hubo red, impresora o permisos fallando.',
    ],
  },
  {
    title: 'Administrador - revisión diaria',
    items: [
      'Revisar Estado operativo en Respaldos.',
      'Confirmar ultimo respaldo protegido.',
      'Revisar espacio en disco y cola de trabajos.',
      'Guardar evidencia si hubo fallas de red, impresión o energía.',
    ],
  },
];

const delicateActions = [
  {
    title: 'Anulación',
    warning: 'Solo supervisor o administrador. Revise factura, pago y motivo antes de confirmar.',
  },
  {
    title: 'Restauración de respaldo',
    warning: 'Nunca restaure sobre datos reales sin respaldo reciente, autorización y base aislada de prueba.',
  },
  {
    title: 'Cierre con diferencia',
    warning: 'No cierre para ocultar errores. Registre conteo real, motivo y pida revisión.',
  },
  {
    title: 'Cambio de equipo o servidor',
    warning: 'No cambie direcciones al azar. Valide el acceso local y el recibo de prueba antes de operar.',
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
  const detailsId = 'support-evidence-details';
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
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Evidencia local para soporte</h2>
        <p className="text-sm text-muted-foreground">Mensajes seguros guardados en este navegador cuando una pantalla o conexión falla.</p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Incidentes guardados: <span className="font-semibold text-foreground">{issues.length}</span>. No incluye contraseñas, tokens ni claves.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handlePrepareSummary}>
              <ClipboardList aria-hidden="true" className="size-4" />
              Preparar resumen
            </Button>
            <Button
              type="button"
              size="sm"
              aria-controls={detailsId}
              aria-expanded={showDetails}
              onClick={() => setShowDetails((current) => !current)}
            >
              {showDetails ? 'Ocultar evidencia' : 'Ver evidencia'}
            </Button>
          </div>
        </div>
        {copyStatus ? <p role="status" aria-live="polite" className="text-sm font-medium text-secondary">{copyStatus}</p> : null}

        {showSummary ? (
          <Textarea
            aria-label="Resumen seguro para soporte"
            readOnly
            value={supportSummary}
            className="min-h-48 break-words font-mono text-xs leading-5"
          />
        ) : null}

        {showDetails ? (
          <div id={detailsId}>
            {latestIssues.length > 0 ? (
            <ul className="space-y-2">
              {latestIssues.map((issue) => (
                <li key={`${issue.occurred_at}-${issue.action ?? 'acción'}`} className="border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{issue.module ?? 'sistema'} - {issue.action ?? 'acción no indicada'}</p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{issue.safe_message}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{issue.route} - {new Date(issue.occurred_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
            ) : (
            <p className="border border-border p-3 text-sm text-muted-foreground">
              No hay incidentes guardados en este navegador.
            </p>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function HelpView() {
  const [taskQuery, setTaskQuery] = useState('');
  const normalizedQuery = normalizeHelpText(taskQuery);
  const visibleGuides = normalizedQuery
    ? guides.filter((guide) => normalizeHelpText(`${guide.title} ${guide.steps.join(' ')}`).includes(normalizedQuery))
    : guides;
  const visibleIncidents = normalizedQuery
    ? incidentGuides.filter((guide) => normalizeHelpText(`${guide.title} ${guide.answer}`).includes(normalizedQuery))
    : incidentGuides;
  const resultCount = visibleGuides.length + visibleIncidents.length;
  const guideItems = visibleGuides.map((guide) => {
    const guideId = helpGuideId(guide.title);

    return {
      key: guideId,
      label: <span id={guideId}>{guide.title}</span>,
      forceRender: true,
      children: (
        <div className="space-y-3">
          <ol className="space-y-2">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a href="#help-task-index" className="text-sm font-semibold text-secondary">Volver al índice</a>
        </div>
      ),
    };
  });

  return (
    <section className="space-y-6" aria-label="Ayuda institucional">
      <PageHeader
        title="Ayuda institucional"
        description="Guía rápida para operar caja, facturación, recibos, reportes y respaldos."
        actions={<div className="inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold">
            <HelpCircle aria-hidden="true" className="size-4" />
            Manual operativo
          </div>}
      />

      <div className="border border-border bg-card p-5">
        <label htmlFor="help-task-search" className="text-sm font-semibold text-foreground">¿Qué necesita hacer?</label>
        <div className="relative mt-2 max-w-2xl">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            id="help-task-search"
            type="search"
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            placeholder="Buscar: cobrar, cerrar caja, imprimir, respaldo…"
            className="min-h-14 pl-10 text-base"
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground" role={normalizedQuery ? 'status' : undefined} aria-live="polite">
          {normalizedQuery ? `${resultCount} guía${resultCount === 1 ? '' : 's'} relacionada${resultCount === 1 ? '' : 's'}.` : 'Seleccione una tarea o busque el problema visible en pantalla.'}
        </p>
      </div>

      <nav id="help-task-index" aria-label="Índice de tareas" className="border border-border p-4">
        <h2 className="mb-3 text-base font-semibold">Índice de tareas</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {visibleGuides.map((guide) => (
            <a key={guide.title} href={`#${helpGuideId(guide.title)}`} className="text-sm font-semibold text-secondary">
              {guide.title}
            </a>
          ))}
        </div>
      </nav>

      <section aria-label="Guías por tarea" className="border border-border">
        <Accordion type="single" collapsible>
          {guideItems.map((item) => <AccordionItem key={item.key} value={item.key}><AccordionTrigger>{item.label}</AccordionTrigger><AccordionContent forceMount>{item.children}</AccordionContent></AccordionItem>)}
        </Accordion>
      </section>

      <Card>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Keyboard aria-hidden="true" className="size-5 text-secondary" />
            Atajos de teclado
          </h2>
          <p className="text-sm text-muted-foreground">Referencia para operar con teclado sin memorizar comandos externos.</p>
        </div>
        <div className="grid gap-3">
          {shortcutSections.map((section) => (
            <div key={section.scope} className="border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.helper}</p>
              <dl className="mt-4 space-y-3">
                {shortcutsByScope(section.scope).map((shortcut) => (
                  <div key={`${section.scope}-${shortcut.scope}-${shortcutLabel(shortcut)}`} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 border border-border bg-card px-2 py-1 font-mono text-xs font-semibold text-foreground">
                      {shortcutLabel(shortcut)}
                    </dt>
                    <dd className="text-right text-sm leading-5 text-muted-foreground">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <WifiOff aria-hidden="true" className="size-5 text-secondary" />
            Incidentes durante el turno
          </h2>
          <p className="text-sm text-muted-foreground">Acciones seguras antes de continuar facturando.</p>
        </div>
        <div>
          <Accordion type="single" collapsible>
            {visibleIncidents.map((item) => <AccordionItem key={item.title} value={item.title}><AccordionTrigger>{item.title}</AccordionTrigger><AccordionContent forceMount><p className="leading-6 text-muted-foreground">{item.answer}</p></AccordionContent></AccordionItem>)}
          </Accordion>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Responsabilidades por rol</h2>
          <p className="text-sm text-muted-foreground">Referencia corta para saber quién debe actuar en cada caso.</p>
        </div>
        <div className="grid gap-3">
          {roleGuides.map((item) => (
            <div key={item.title} className="border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck aria-hidden="true" className="size-5 text-secondary" />
            Checklist diario por rol
          </h2>
          <p className="text-sm text-muted-foreground">Pasos cortos para iniciar, cerrar y revisar el turno sin depender de soporte técnico.</p>
        </div>
        <div className="grid gap-3">
          {dailyChecklists.map((checklist) => (
            <div key={checklist.title} className="border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">{checklist.title}</h3>
              <ul className="mt-3 space-y-2">
                {checklist.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                    <span aria-hidden="true" className="mt-2 shrink-0 bg-secondary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle aria-hidden="true" className="size-5 text-warning" />
            Acciones delicadas
          </h2>
          <p className="text-sm text-muted-foreground">Advertencias antes de tocar datos, caja, respaldos o configuración de red.</p>
        </div>
        <div className="grid gap-3">
          {delicateActions.map((item) => (
            <div key={item.title} className="border p-4">
              <h3 className="text-sm font-semibold text-warning">{item.title}</h3>
              <p className="mt-2 text-sm leading-6">{item.warning}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Capacitación segura</h2>
          <p className="text-sm text-muted-foreground">Practique sin afectar facturas, caja ni respaldos reales.</p>
        </div>
        <div className="grid gap-3">
          <div className="border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Checklist diario</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cajero: abrir caja, facturar, cobrar, imprimir y cerrar. Supervisor: revisar diferencias y anulaciones.
              Administrador: revisar usuarios, respaldos, espacio y evidencia de respaldos; la recuperación de datos se coordina con soporte.
            </p>
          </div>
          <div className="border p-4">
            <h3 className="text-sm font-semibold text-warning">Modo práctica</h3>
            <p className="mt-2 text-sm leading-6">
              Si no existe un entorno de práctica aislado, capacite en una instalación separada o una base descartable.
              No use la base de producción para ensayar anulaciones, recuperación de datos o cobros ficticios.
            </p>
          </div>
        </div>
      </Card>

      <SupportEvidenceCard />
    </section>
  );
}

function normalizeHelpText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function helpGuideId(title: string): string {
  return `help-guide-${normalizeHelpText(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
