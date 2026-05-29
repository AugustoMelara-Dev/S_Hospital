import {
  Archive,
  Banknote,
  HelpCircle,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';

const guides = [
  {
    title: 'Abrir caja',
    icon: WalletCards,
    steps: ['Entre a Caja', 'Registre el efectivo inicial', 'Confirme la apertura', 'Revise que la caja quede activa'],
  },
  {
    title: 'Crear factura',
    icon: ReceiptText,
    steps: ['Entre a Nueva Factura', 'Escriba el nombre del paciente', 'Busque por nombre, categoría o código si está habilitado', 'Revise el carrito antes de emitir'],
  },
  {
    title: 'Cobrar',
    icon: Banknote,
    steps: ['Seleccione método de pago', 'Digite monto y referencia si aplica', 'Confirme el cobro', 'Revise que el saldo quede correcto'],
  },
  {
    title: 'Imprimir',
    icon: Printer,
    steps: ['Abra la vista de recibo', 'Elija media carta, carta o A5', 'Revise paciente y total', 'Imprima el recibo institucional'],
  },
  {
    title: 'Reimprimir',
    icon: RefreshCw,
    steps: ['Entre a Historial', 'Filtre por paciente o número', 'Abra la factura', 'Use Reimprimir con motivo si se solicita'],
  },
  {
    title: 'Reportes',
    icon: Search,
    steps: ['Entre a Reportes', 'Seleccione el reporte requerido', 'Aplique filtros autorizados', 'Exporte solo si su rol lo permite'],
  },
  {
    title: 'Respaldos',
    icon: Archive,
    steps: ['Entre a Respaldos', 'Revise el último respaldo completado', 'Cree un respaldo antes de cambios grandes', 'Confirme la restauración cuando aplique'],
  },
];

const faqs = [
  {
    question: '¿Qué hago si el sistema dice que no hay caja abierta?',
    answer: 'Abra una caja desde Caja. No se debe cobrar sin caja activa.',
  },
  {
    question: '¿Por qué Eritropoyetina puede salir gratis?',
    answer: 'Solo aplica si se marca receta de diálisis. En pacientes normales el medicamento se cobra.',
  },
  {
    question: '¿Puedo cambiar el precio de una factura antigua?',
    answer: 'No. Las facturas guardan nombre, precio e impuesto tal como se emitieron.',
  },
  {
    question: '¿Quién puede anular facturas?',
    answer: 'Solo usuarios autorizados. La anulación exige motivo y queda registrada.',
  },
  {
    question: '¿Qué pasa si no hay internet?',
    answer: 'El sistema opera dentro de la red local del hospital.',
  },
];

export function HelpView() {
  return (
    <section className="space-y-6" aria-labelledby="help-title">
      <PageHeader
        title="Ayuda"
        description="Guía operativa para caja hospitalaria, recibos, reportes y respaldos."
        actions={
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
            <HelpCircle aria-hidden="true" className="size-4" />
            Manual interno
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          <CardTitle>Preguntas frecuentes</CardTitle>
          <CardDescription>Respuestas cortas para dudas comunes durante el turno.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
