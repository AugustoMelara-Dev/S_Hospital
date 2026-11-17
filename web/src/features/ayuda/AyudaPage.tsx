import { useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Ban,
  BarChart3,
  FileDigit,
  FileText,
  Package,
  Pill,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import { EmptyState, Input, Kbd, PageHeader } from '@/ui';

type Guide = { id: string; title: string; icon: ReactNode; summary: string; steps: string[] };

const DAILY: Guide[] = [
  {
    id: 'cobrar',
    title: 'Cobrar una cuenta',
    icon: <ShoppingCart />,
    summary: 'Del nombre del paciente al recibo impreso.',
    steps: [
      'Pulse F2 o abra Cobrar; escriba el nombre del paciente.',
      'Busque cada concepto por nombre o código y pulse Enter para agregarlo.',
      'Ajuste cantidades; revise Subtotal, ISV y Total.',
      'Pulse «Cobrar» (F4), elija el método de pago y confirme.',
      'Imprima el recibo o guárdelo en PDF.',
    ],
  },
  {
    id: 'sin-cobro',
    title: 'Emitir sin cobro',
    icon: <FileText />,
    summary: 'Cuentas con total L 0.00.',
    steps: [
      'Arme la cuenta como cualquier cobro.',
      'Si el total es L 0.00, el botón cambia a «Emitir sin cobro».',
      'Confirme: se emite la factura y el recibo sin registrar pago.',
    ],
  },
  {
    id: 'epo',
    title: 'Eritropoyetina con receta de diálisis',
    icon: <Pill />,
    summary: 'La gratuidad aplica solo al medicamento elegible.',
    steps: [
      'Agregue la eritropoyetina y el resto de conceptos de la cuenta.',
      'Marque «Paciente con receta de diálisis» (requiere permiso).',
      'Solo la línea de eritropoyetina queda en L 0.00; el resto conserva su precio.',
      'Cobre el saldo restante normalmente.',
    ],
  },
  {
    id: 'anular',
    title: 'Anular',
    icon: <Ban />,
    summary: 'Facturas sin pagos registrados.',
    steps: [
      'Abra la factura en Recibos.',
      'Pulse «Anular» y escriba el motivo de anulación.',
      'Confirme. La factura queda «Anulada»; nunca se borra.',
    ],
  },
  {
    id: 'revertir',
    title: 'Revertir',
    icon: <RotateCcw />,
    summary: 'Facturas que ya tienen cobros.',
    steps: [
      'Abra la factura en Recibos y pulse «Revertir».',
      'Escriba el motivo de reversión.',
      'Se anulan los pagos, el recibo y la factura; la caja descuenta el efectivo.',
    ],
  },
  {
    id: 'reimprimir',
    title: 'Reimprimir',
    icon: <Printer />,
    summary: 'Copias marcadas como reimpresión.',
    steps: [
      'Abra la factura en Recibos.',
      'Pulse «Reimprimir» y escriba el motivo.',
      'El recibo sale con «REIMPRESIÓN #n». No genera cobros ni números nuevos.',
    ],
  },
  {
    id: 'caja',
    title: 'Abrir y cerrar caja',
    icon: <Wallet />,
    summary: 'Turno de caja con arqueo.',
    steps: [
      'En Caja, pulse «Abrir caja» e ingrese el monto inicial (puede ser L 0.00).',
      'Al terminar el turno, resuelva pendientes de cobro y recibos faltantes.',
      'En Arqueo cuente billetes y monedas; revise la diferencia.',
      'En Cierre escriba la nota (obligatoria si hay diferencia) y confirme.',
      'Imprima el resumen de cierre.',
    ],
  },
  {
    id: 'reportes',
    title: 'Reportes',
    icon: <BarChart3 />,
    summary: 'Facturado, cobrado y pendiente por período.',
    steps: [
      'Abra Reportes y elija el período (máximo 92 días).',
      'Filtre por método, estado, cajero, caja o categoría.',
      'Use «Exportar PDF» o «Exportar Excel» si tiene permiso.',
    ],
  },
];

const ADMIN: Guide[] = [
  {
    id: 'catalogo',
    title: 'Catálogo',
    icon: <Package />,
    summary: 'Precios, impuestos y disponibilidad.',
    steps: [
      'En Catálogo y precios, busque el concepto y ábralo.',
      'Cambie precio, impuesto o disponibilidad; cada cambio pide motivo.',
      'Consulte «Historial de precios» o use «Impuesto en lote» por categoría.',
      'Las facturas emitidas nunca cambian con el catálogo.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuarios',
    icon: <Users />,
    summary: 'Cuentas, roles y permisos.',
    steps: [
      'En Usuarios y permisos, pulse «Crear usuario» y asigne un rol.',
      'La contraseña inicial debe tener 12 caracteres con mayúscula, minúscula, número y símbolo.',
      'Use «Restablecer clave» o «Desactivar» con motivo cuando corresponda.',
      'En Roles, marque los permisos por módulo.',
    ],
  },
  {
    id: 'fiscal',
    title: 'Numeración fiscal',
    icon: <FileDigit />,
    summary: 'CAI y rango autorizado.',
    steps: [
      'En Ajustes › Numeración fiscal, registre prefijo, CAI, rango y fecha límite.',
      'Solo una numeración puede estar activa.',
      'Vigile los avisos «Vencida» y «Rango por agotarse» para solicitar un nuevo CAI a tiempo.',
    ],
  },
  {
    id: 'respaldos',
    title: 'Respaldos',
    icon: <Archive />,
    summary: 'Copias cifradas de la base de datos.',
    steps: [
      'El sistema crea un respaldo automático cada día.',
      'Para uno manual, pulse «Crear respaldo» en Respaldos.',
      'Descargue y guarde copias fuera del servidor. La restauración la hace soporte técnico.',
    ],
  },
];

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ['Ctrl', 'K'], action: 'Abrir la paleta de búsqueda y navegación' },
  { keys: ['F2'], action: 'Nueva operación (foco en el nombre del paciente)' },
  { keys: ['F4'], action: 'Cobrar la cuenta actual' },
  { keys: ['Esc'], action: 'Cerrar diálogo, panel o lista abierta' },
  { keys: ['Flecha arriba', 'Flecha abajo'], action: 'Moverse por resultados y listas' },
  { keys: ['Enter'], action: 'Agregar el concepto seleccionado o confirmar' },
];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function matches(g: Guide, q: string) {
  if (!q) return true;
  return norm([g.title, g.summary, ...g.steps].join(' ')).includes(q);
}

const KEY_ICON: Record<string, ReactNode> = {
  'Flecha arriba': <ArrowUp className="size-3" strokeWidth={2.2} aria-label="Flecha arriba" />,
  'Flecha abajo': <ArrowDown className="size-3" strokeWidth={2.2} aria-label="Flecha abajo" />,
};

const anchor = (id: string) => `ayuda-${id}`;

function jump(id: string) {
  const el = document.getElementById(anchor(id));
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  const focusable = el.querySelector<HTMLElement>('h2, h3');
  focusable?.focus({ preventScroll: true });
}

function GuideArticle({ g }: { g: Guide }) {
  return (
    <article id={anchor(g.id)} className="scroll-mt-4 border-t border-junta py-5 first:border-t-0 first:pt-3">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 text-ink-3 [&_svg]:size-[18px] [&_svg]:stroke-[1.6]" aria-hidden="true">
          {g.icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 tabIndex={-1} className="text-[16px] leading-6 font-bold text-ink outline-none">
            {g.title}
          </h3>
          <p className="text-[14px] leading-5 text-ink-2">{g.summary}</p>
        </div>
      </header>
      <ol className="mt-3 flex flex-col pl-[30px]">
        {g.steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 py-1 text-[15px] leading-6 text-ink">
            <span className="num pt-px text-[14px] font-semibold text-ink-2">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function Group({ id, title, guides }: { id: string; title: string; guides: Guide[] }) {
  if (guides.length === 0) return null;
  return (
    <section id={anchor(id)} aria-labelledby={`h-${id}`} className="scroll-mt-4">
      <h2 id={`h-${id}`} tabIndex={-1} className="border-b border-junta-strong pb-2 text-[20px] leading-7 font-bold tracking-[-0.01em] text-ink outline-none">
        {title}
      </h2>
      {guides.map((g) => (
        <GuideArticle key={g.id} g={g} />
      ))}
    </section>
  );
}

function IndexLink({ id, children, strong }: { id: string; children: ReactNode; strong?: boolean }) {
  return (
    <a
      href={`#${anchor(id)}`}
      onClick={(e) => {
        e.preventDefault();
        jump(id);
      }}
      className={
        strong
          ? 'flex h-8 items-center rounded-[var(--radius-sm)] px-2 text-[13.5px] font-semibold text-ink hover:bg-surface-2'
          : 'flex min-h-7 items-center rounded-[var(--radius-sm)] py-1 pr-2 pl-5 text-[13px] leading-5 text-ink-2 hover:bg-surface-2 hover:text-ink'
      }
    >
      {children}
    </a>
  );
}

export default function AyudaPage() {
  const [query, setQuery] = useState('');
  const q = norm(query.trim());
  const daily = useMemo(() => DAILY.filter((g) => matches(g, q)), [q]);
  const admin = useMemo(() => ADMIN.filter((g) => matches(g, q)), [q]);
  const shortcuts = useMemo(() => SHORTCUTS.filter((s) => !q || norm(`${s.keys.join(' ')} ${s.action}`).includes(q)), [q]);
  const none = daily.length + admin.length + shortcuts.length === 0;

  return (
    <>
      <PageHeader title="Ayuda" description="Guías paso a paso para las tareas de caja y administración." className="pb-3" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,calc(68ch+4rem))_minmax(280px,1fr)]">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
          <Input
            aria-label="Buscar en la ayuda"
            type="search"
            placeholder="Buscar una tarea"
            prefix={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!none && (
            <nav aria-label="Índice de la ayuda" className="flex flex-col gap-0.5 border-t border-junta pt-3">
              {daily.length > 0 && <IndexLink id="diario" strong>Trabajo diario</IndexLink>}
              {daily.map((g) => (
                <IndexLink key={g.id} id={g.id}>
                  {g.title}
                </IndexLink>
              ))}
              {admin.length > 0 && <IndexLink id="admin" strong>Administración autorizada</IndexLink>}
              {admin.map((g) => (
                <IndexLink key={g.id} id={g.id}>
                  {g.title}
                </IndexLink>
              ))}
              {shortcuts.length > 0 && <IndexLink id="atajos" strong>Atajos de teclado</IndexLink>}
            </nav>
          )}
        </aside>

        <div className="min-w-0 rounded-[var(--radius-md)] border border-junta bg-surface px-8 py-6 max-[1099px]:px-5">
          <div className="flex max-w-[68ch] flex-col gap-8">
            {none && <EmptyState icon={<Receipt />} title="Sin resultados" description="Pruebe con otra palabra, por ejemplo «anular» o «caja»." />}
            <Group id="diario" title="Trabajo diario" guides={daily} />
            <Group id="admin" title="Administración autorizada" guides={admin} />
          </div>
        </div>
        {shortcuts.length > 0 && (
          <section
            id={anchor('atajos')}
            aria-labelledby="h-atajos"
            className="flex scroll-mt-4 flex-col overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface lg:col-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1"
          >
            <h2 id="h-atajos" tabIndex={-1} className="border-b border-junta px-4 py-2.5 text-[15px] leading-5 font-bold text-ink outline-none">
              Atajos de teclado
            </h2>
            <table className="w-full border-collapse text-[13.5px] leading-5">
              <caption className="sr-only">Atajos de teclado</caption>
              <thead>
                <tr className="bg-ground text-left text-[12px] text-ink-2">
                  <th scope="col" className="h-8 w-32 border-b border-junta px-3 font-semibold">
                    Tecla
                  </th>
                  <th scope="col" className="h-8 border-b border-l border-junta px-3 font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((s) => (
                  <tr key={s.action} className="[&:last-child>td]:border-b-0">
                    <td className="h-11 border-b border-junta px-3">
                      <span className="inline-flex items-center gap-1">
                        {s.keys.map((k) => (
                          <Kbd key={k} className="h-[22px] min-w-[22px] text-[12px]">
                            {KEY_ICON[k] ?? k}
                          </Kbd>
                        ))}
                      </span>
                    </td>
                    <td className="h-11 border-b border-l border-junta px-3 py-1.5 text-ink">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
