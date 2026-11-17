import { useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
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
import { Card, EmptyState, Input, Kbd, PageHeader } from '@/ui';

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
  { keys: ['↑', '↓'], action: 'Moverse por resultados y listas' },
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

function GuideCard({ g }: { g: Guide }) {
  return (
    <Card className="h-full">
      <article className="flex flex-col gap-3">
        <header className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-brand [&_svg]:size-[18px]" aria-hidden="true">
            {g.icon}
          </span>
          <div className="flex flex-col">
            <h3 className="text-[14px] font-semibold text-ink">{g.title}</h3>
            <p className="text-[12.5px] text-ink-3">{g.summary}</p>
          </div>
        </header>
        <ol className="flex flex-col gap-1.5">
          {g.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-ink-2">
              <span className="num mt-[1px] flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-ink-3">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </article>
    </Card>
  );
}

function Group({ title, guides }: { title: string; guides: Guide[] }) {
  if (guides.length === 0) return null;
  return (
    <section aria-labelledby={`g-${title}`} className="flex flex-col gap-3">
      <h2 id={`g-${title}`} className="text-[13px] font-semibold tracking-[0.04em] text-ink-2 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {guides.map((g) => (
          <GuideCard key={g.id} g={g} />
        ))}
      </div>
    </section>
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
      <PageHeader
        title="Ayuda"
        description="Guías paso a paso para las tareas de caja y administración."
        actions={
          <Input
            aria-label="Buscar en la ayuda"
            type="search"
            placeholder="Buscar una tarea"
            prefix={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            wrapperClassName="w-72"
          />
        }
      />
      <div className="flex flex-col gap-8">
        {none && <EmptyState icon={<Receipt />} title="Sin resultados" description="Pruebe con otra palabra, por ejemplo «anular» o «caja»." />}
        <Group title="Trabajo diario" guides={daily} />
        <Group title="Administración autorizada" guides={admin} />
        {shortcuts.length > 0 && (
          <section aria-labelledby="g-atajos" className="flex flex-col gap-3">
            <h2 id="g-atajos" className="text-[13px] font-semibold tracking-[0.04em] text-ink-2 uppercase">
              Atajos de teclado
            </h2>
            <Card flush className="max-w-[720px]">
              <table className="w-full text-[13.5px]">
                <caption className="sr-only">Atajos de teclado</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-ink-2">
                    <th scope="col" className="w-40 px-4 py-2 font-medium">Tecla</th>
                    <th scope="col" className="px-4 py-2 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {shortcuts.map((s) => (
                    <tr key={s.action} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {s.keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{s.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}
