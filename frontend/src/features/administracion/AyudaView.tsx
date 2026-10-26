import { Link } from 'react-router-dom';
import { ArrowRightIcon, ChevronDownIcon } from 'lucide-react';
import { AdminEmpty, AdminPageHeader, AdminPanel } from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import { adminRoutePaths, hasAdminPermissions, type AdminPermissionMode } from '@/navigation/adminNavigation';

type HelpTopic = {
  id: string;
  title: string;
  body: string;
  to: string;
  linkLabel: string;
  steps: string[];
  permissions?: string[];
  permissionMode?: AdminPermissionMode;
};

const DAILY_TOPICS: HelpTopic[] = [
  {
    id: 'sin-cobro', title: 'Emitir sin cobro',
    body: 'Una operación con total cero se emite sin registrar un pago ni una entrada de efectivo.',
    to: adminRoutePaths.cobrar, linkLabel: 'Preparar emisión sin cobro',
    permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'], permissionMode: 'all',
    steps: ['Abra su caja, escriba el nombre del paciente y agregue los conceptos autorizados.', 'Revise el total cero y confirme Emitir sin cobro una sola vez.', 'Compruebe el documento en Recibos; no registre un pago para completar una emisión gratuita.'],
  },
  {
    id: 'dialisis', title: 'Eritropoyetina con receta de diálisis',
    body: 'La gratuidad afecta sólo la línea elegible de eritropoyetina; los demás productos y servicios se cobran normalmente.',
    to: adminRoutePaths.cobrar, linkLabel: 'Revisar cuenta con diálisis',
    permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'], permissionMode: 'all',
    steps: ['Agregue el medicamento elegible y confirme la receta de diálisis en la cuenta.', 'Revise el beneficio de esa línea y el importe de los demás conceptos.', 'Confirme Emitir sin cobro si todo el total es cero; si queda saldo, cobre ese saldo.'],
  },
  {
    id: 'anulacion', title: 'Anular una operación',
    body: 'La anulación requiere permiso y motivo; una operación cobrada requiere revisar la reversión.',
    to: adminRoutePaths.recibos, linkLabel: 'Revisar operación para anular',
    permissions: ['invoices.view', 'invoices.void'], permissionMode: 'all',
    steps: ['Busque la operación y abra su detalle para comprobar paciente, estado e importe.', 'Use Anular sólo si la operación es elegible y escriba el motivo real.', 'Confirme y compruebe el estado anulado; no borre ni reemplace el comprobante original.'],
  },
  {
    id: 'reversion', title: 'Revertir una operación cobrada',
    body: 'Revise primero el pago y el turno; la reversión deja trazabilidad de la operación y del ajuste autorizado.',
    to: adminRoutePaths.recibos, linkLabel: 'Revisar operación para revertir',
    permissions: ['invoices.view', 'invoices.reverse'], permissionMode: 'all',
    steps: ['Abra el detalle de la operación cobrada y compruebe su pago, caja y cajero.', 'Seleccione Revertir cuando esté habilitado, registre el motivo y revise el efecto indicado antes de confirmar.', 'Si el sistema bloquea la reversión, solicite revisión al supervisor; no cree cobros ni movimientos para compensarla por su cuenta.'],
  },
  {
    id: 'cobrar',
    title: 'Cobrar una cuenta',
    body: 'Escriba el nombre del paciente, agregue los conceptos y revise el total antes de confirmar.',
    to: adminRoutePaths.cobrar,
    linkLabel: 'Abrir Cobrar',
    steps: [
      'Abra la caja del turno si todavía está cerrada.',
      'Escriba el nombre del paciente y busque cada concepto.',
      'Revise cantidades y total; luego confirme el cobro una sola vez.',
    ],
    permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'],
    permissionMode: 'all',
  },
  {
    id: 'recibos',
    title: 'Buscar o reimprimir',
    body: 'Encuentre el comprobante existente y vuelva a imprimirlo sin generar otro cobro.',
    to: adminRoutePaths.recibos,
    linkLabel: 'Abrir Recibos',
    steps: [
      'Busque por paciente, número o fecha y abra el comprobante correcto.',
      'Use reimprimir o guardar PDF sobre ese mismo comprobante.',
      'Si la impresión falla, vuelva a intentarlo desde Recibos; no cobre otra vez.',
    ],
    permissions: ['invoices.view'],
  },
  {
    id: 'caja',
    title: 'Abrir y cerrar caja',
    body: 'Abra el turno antes de cobrar y concilie efectivo, movimientos y diferencia al cerrarlo.',
    to: adminRoutePaths.caja,
    linkLabel: 'Abrir Caja',
    steps: [
      'Seleccione la caja y registre el monto inicial antes del primer cobro.',
      'Revise movimientos y efectivo al terminar el turno.',
      'Explique cualquier diferencia y confirme el cierre una sola vez.',
      'Si el cierre está bloqueado, revise las operaciones pendientes y resuélvalas con una persona autorizada; no altere el efectivo para forzar el cierre.',
    ],
    permissions: ['cash.view'],
  },
  {
    id: 'reportes',
    title: 'Consultar reportes',
    body: 'Aplique un período y filtros antes de descargar el PDF o Excel.',
    to: adminRoutePaths.reportes,
    linkLabel: 'Abrir Reportes',
    steps: [
      'Elija el período y los filtros que necesita.',
      'Pulse Aplicar y revise que las cifras correspondan al período.',
      'Descargue PDF o Excel conservando esos mismos filtros.',
    ],
    permissions: ['reports.managerial.view', 'reports.cash_session.view'],
    permissionMode: 'any',
  },
];

const ADMIN_TOPICS: HelpTopic[] = [
  {
    id: 'auditoria', title: 'Consultar auditoría',
    body: 'Consulte quién realizó una operación, cuándo ocurrió y el motivo registrado. El historial es de sólo lectura.',
    to: adminRoutePaths.administracionAuditoria, linkLabel: 'Abrir Auditoría', permissions: ['audit.view'],
    steps: ['Busque por nombre o usuario, acción y fechas.', 'Aplique los filtros y avance entre páginas para revisar el período completo.', 'Compruebe responsable, resultado y motivo; solicite revisión si falta una explicación.'],
  },
  {
    id: 'catalogo',
    title: 'Administrar catálogo y precios',
    body: 'Consulte conceptos y tarifas. Los cambios nuevos no reescriben comprobantes ya emitidos.',
    to: adminRoutePaths.administracionCatalogo,
    linkLabel: 'Abrir Catálogo',
    steps: [
      'Busque el concepto antes de crear uno nuevo.',
      'Revise nombre, categoría, área, tarifa, impuesto y disponibilidad.',
      'Guarde sólo después de confirmar el efecto sobre los próximos cobros.',
    ],
    permissions: ['catalog.view', 'catalog.manage'],
    permissionMode: 'any',
  },
  {
    id: 'usuarios',
    title: 'Administrar usuarios',
    body: 'Revise cuentas, roles y permisos. Otro administrador puede restablecer un acceso; si no hay otro, use la herramienta local protegida desde Inicio de Windows.',
    to: adminRoutePaths.administracionUsuarios,
    linkLabel: 'Abrir Usuarios',
    steps: [
      'Busque la cuenta y revise su estado y permisos antes de cambiarla.',
      'Si otra persona olvidó su acceso, un administrador puede restablecerlo aquí.',
      'Si es el único administrador, abra “Recuperar acceso a S_Hospital” desde Inicio de Windows y solicite al responsable local autorizar la ventana de seguridad.',
    ],
    permissions: ['users.view'],
  },
  {
    id: 'ajustes',
    title: 'Identidad y numeración',
    body: 'Revise los datos institucionales y las secuencias que usarán los próximos documentos.',
    to: adminRoutePaths.administracionAjustes,
    linkLabel: 'Abrir Ajustes',
    steps: [
      'Revise los datos actuales antes de editar.',
      'Cambie sólo el dato autorizado para los próximos documentos.',
      'Guarde y confirme el resultado sin modificar comprobantes históricos.',
    ],
    permissions: ['settings.fiscal.view', 'settings.operational.update'],
    permissionMode: 'any',
  },
  {
    id: 'respaldos',
    title: 'Proteger la información',
    body: 'Cree y descargue copias. Una verificación de integridad confirma el archivo; no demuestra por sí sola que la base pueda restaurarse.',
    to: `${adminRoutePaths.administracionMantenimiento}/respaldos`,
    linkLabel: 'Abrir Respaldos',
    steps: [
      'Cree la copia y espere el resultado de integridad.',
      'Descárguela a la unidad externa preparada para el hospital.',
      'Si la unidad no está disponible, conserve la copia local y avise al responsable; no se considera copia externa.',
      'Para comprobar una recuperación, use la herramienta de mantenimiento instalada en Inicio de Windows.',
    ],
    permissions: ['backups.view', 'system.status.view'],
    permissionMode: 'any',
  },
  {
    id: 'impresion',
    title: 'Preparar papel e impresión',
    body: 'Configuración avanzada para instalación y soporte. Déjela preparada una vez antes de la operación diaria.',
    to: `${adminRoutePaths.administracionAjustes}?panel=papel`,
    linkLabel: 'Abrir Impresión avanzada',
    steps: [
      'Revise el papel y las copias que dejó preparados la instalación.',
      'Revise la vista previa y haga una impresión física de prueba.',
      'Deje el perfil preparado; no lo cambie durante la atención diaria.',
    ],
    permissions: ['receipt_settings.view', 'receipt_settings.advanced'],
    permissionMode: 'all',
  },
  {
    id: 'actualizar',
    title: 'Actualizar el sistema',
    body: 'Use el instalador nuevo en la misma computadora para conservar los datos y la configuración.',
    to: `${adminRoutePaths.administracionMantenimiento}/respaldos`,
    linkLabel: 'Revisar respaldo',
    steps: [
      'Obtenga el instalador autorizado por descarga o memoria USB y llévelo a la computadora servidor.',
      'Cierre la operación y pida a los demás usuarios salir del sistema antes de ejecutarlo en esa computadora.',
      'Confirme que muestre “Actualizar S_Hospital” y espere el respaldo automático.',
      'No desinstale el sistema ni borre su carpeta para actualizarlo.',
    ],
    permissions: ['backups.view', 'system.status.view'],
    permissionMode: 'any',
  },
];

function visibleTopics(topics: HelpTopic[], permissions: readonly string[]) {
  return topics.filter((topic) => hasAdminPermissions(
    permissions,
    topic.permissions,
    topic.permissionMode ?? 'any',
  ));
}

function topicsForPermissions(permissions: readonly string[]) {
  return visibleTopics(ADMIN_TOPICS, permissions).map((topic): HelpTopic => {
    if (topic.id === 'catalogo' && !permissions.includes('catalog.manage')) {
      return {
        ...topic,
        title: 'Consultar catálogo y precios',
        body: 'Busque productos, servicios y tarifas vigentes sin modificar el catálogo.',
        steps: [
          'Busque por nombre, categoría o área.',
          'Revise la tarifa, el impuesto y la disponibilidad mostrados.',
          'Solicite a una persona con permiso de gestión cualquier cambio necesario.',
        ],
      };
    }

    if (topic.id === 'usuarios' && !permissions.includes('users.update')) {
      return {
        ...topic,
        title: 'Consultar usuarios',
        body: 'Revise las cuentas y permisos visibles sin modificar accesos.',
        steps: [
          'Busque la cuenta por nombre o usuario.',
          'Revise su estado, rol y permisos asignados.',
          'Solicite a otro administrador autorizado cualquier cambio o restablecimiento.',
        ],
      };
    }

    if (topic.id === 'respaldos') {
      const steps = [
        'Revise la fecha, el estado y el resultado de integridad de cada copia.',
        'Para comprobar una recuperación, use la herramienta de mantenimiento instalada en Inicio de Windows.',
      ];
      if (permissions.includes('backups.create')) steps.push('Use Crear respaldo y espere el resultado de integridad.');
      if (permissions.includes('backups.download')) steps.push('Descargue la copia a la unidad externa preparada para el hospital.');
      if (!permissions.includes('backups.create') && !permissions.includes('backups.download')) {
        steps.push('Solicite a una persona autorizada crear o descargar una copia cuando sea necesario.');
      } else if (permissions.includes('backups.download')) {
        steps.push('Si la unidad externa no está disponible, conserve la copia local y avise al responsable; no se considera copia externa.');
      }
      return { ...topic, title: 'Revisar protección de la información', steps };
    }

    if (topic.id === 'ajustes' && !permissions.includes('settings.fiscal.update') && !permissions.includes('settings.operational.update')) {
      return {
        ...topic,
        title: 'Consultar identidad y numeración',
        body: 'Revise los datos institucionales y las secuencias vigentes sin modificarlos.',
        steps: [
          'Revise la identidad y la numeración mostradas.',
          'Compruebe qué valores usarán los próximos documentos.',
          'Solicite a una persona autorizada cualquier corrección.',
        ],
      };
    }

    if (topic.id === 'impresion' && !permissions.includes('receipt_settings.update')) {
      return {
        ...topic,
        title: 'Consultar impresión avanzada',
        steps: [
          'Revise el papel y la cantidad de copias preparados.',
          'Compruebe la vista previa sin guardar cambios.',
          'Solicite a soporte cualquier ajuste y una impresión física de prueba.',
        ],
      };
    }

    return topic;
  });
}

function TopicList({ title, topics }: { title: string; topics: HelpTopic[] }) {
  if (topics.length === 0) return null;
  const headingId = `ayuda-${title.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="border-b border-[var(--ui-line)] px-4 py-3 text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">{title}</h2>
      <ul className="divide-y divide-[var(--ui-line)]">
        {topics.map((topic) => (
          <li key={topic.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">{topic.title}</p>
              <p className="mt-0.5 max-w-3xl text-[length:var(--ui-text-sm)] leading-5 text-[color:var(--ui-ink-soft)]">{topic.body}</p>
              <details className="group mt-2">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-[var(--ui-radius)] text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]">
                  Cómo hacerlo
                  <ChevronDownIcon aria-hidden="true" className="size-3.5 transition-transform duration-[var(--ui-duration-state)] group-open:rotate-180 motion-reduce:transition-none" strokeWidth={2} />
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[length:var(--ui-text-sm)] leading-5 text-[color:var(--ui-ink-soft)]">
                  {topic.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </details>
            </div>
            <Link
              to={topic.to}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--ui-radius-control)] text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] hover:underline"
            >
              {topic.linkLabel}
              <ArrowRightIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ayuda local breve: sólo muestra tareas que el rol puede abrir. */
export function AyudaView() {
  const { user } = useAdminSession();
  const dailyTopics = visibleTopics(DAILY_TOPICS, user.permissions);
  const adminTopics = topicsForPermissions(user.permissions);

  return (
    <section aria-labelledby="ayuda-title" className="flex flex-col gap-3">
      <AdminPageHeader
        headingId="ayuda-title"
        title="Ayuda"
        description="Pasos breves para las tareas disponibles en su cuenta."
      />

      {dailyTopics.length > 0 || adminTopics.length > 0 ? (
        <AdminPanel className="divide-y divide-[var(--ui-line)] overflow-hidden">
          <TopicList title="Trabajo diario" topics={dailyTopics} />
          <TopicList title="Administración autorizada" topics={adminTopics} />
        </AdminPanel>
      ) : (
        <AdminEmpty
          title="Sin tareas habilitadas"
          description="Su cuenta puede ingresar, pero no tiene tareas operativas o administrativas asignadas. Solicite al administrador que revise sus permisos."
        />
      )}
    </section>
  );
}
