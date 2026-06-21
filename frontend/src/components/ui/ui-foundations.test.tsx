import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from './breadcrumb';
import { Button, buttonSizes, buttonVariants } from './button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Checkbox } from './checkbox';
import { Dialog } from './dialog';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Separator } from './separator';
import { ErrorState, LoadingState, Skeleton } from './states';
import { ScrollArea } from './scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('UI foundations compatibility', () => {
  it('keeps Button variants, sizes, asChild and disabled behavior', () => {
    const { rerender } = render(<Button variant="danger">Anular</Button>);
    expect(screen.getByRole('button', { name: 'Anular' })).toHaveClass('bg-destructive');
    expect(buttonVariants.outline).toContain('border-input');
    expect(buttonSizes.icon).toContain('size-9');

    rerender(
      <Button asChild>
        <a href="/dashboard">Ir al inicio</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/dashboard');

    rerender(<Button disabled>No disponible</Button>);
    expect(screen.getByRole('button', { name: 'No disponible' })).toBeDisabled();
  });

  it('exports Card subcomponents and accepts className', () => {
    render(
      <Card className="custom-card">
        <CardHeader>
          <CardTitle>Titulo</CardTitle>
          <CardDescription>Descripcion</CardDescription>
          <CardAction>Accion</CardAction>
        </CardHeader>
        <CardContent>Contenido</CardContent>
        <CardFooter>Pie</CardFooter>
      </Card>,
    );

    expect(screen.getByText('Titulo')).toBeInTheDocument();
    expect(screen.getByText('Accion')).toHaveAttribute('data-slot', 'card-action');
    expect(screen.getByText('Pie')).toHaveAttribute('data-slot', 'card-footer');
    expect(screen.getByText('Contenido').closest('[data-slot="card"]')).toHaveClass('custom-card');
  });

  it('keeps Input aria-invalid and className support', () => {
    render(<Input aria-invalid="true" className="custom-input" aria-label="Paciente" />);
    const input = screen.getByLabelText('Paciente');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('custom-input');
  });

  it('keeps Dialog title and description accessible', () => {
    render(
      <Dialog open={true} onOpenChange={() => undefined} title="Registrar pago" description="Confirme el monto recibido">
        <button>Guardar</button>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });
    expect(dialog).toHaveAccessibleDescription('Confirme el monto recibido');
  });

  it('provides AlertDialog primitives with keyboard dismissal', () => {
    const onOpenChange = vi.fn();

    render(
      <AlertDialog open={true} onOpenChange={onOpenChange}>
        <AlertDialogTrigger>Eliminar</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar anulacion</AlertDialogTitle>
            <AlertDialogDescription>Esta accion requiere motivo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const alertDialog = screen.getByRole('alertdialog', { name: 'Confirmar anulacion' });
    expect(alertDialog).toHaveAccessibleDescription('Esta accion requiere motivo.');

    fireEvent.keyDown(alertDialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps Checkbox accessible through an external label', () => {
    render(
      <div>
        <Label htmlFor="dialysis">Receta de dialisis</Label>
        <Checkbox id="dialysis" />
      </div>,
    );

    expect(screen.getByRole('checkbox', { name: 'Receta de dialisis' })).toBeInTheDocument();
  });

  it('keeps Select labelled and keyboard-openable', () => {
    render(
      <div>
        <Label id="payment-method-label">Metodo de pago</Label>
        <Select defaultValue="cash">
          <SelectTrigger aria-labelledby="payment-method-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
          </SelectContent>
        </Select>
      </div>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Metodo de pago' });
    expect(trigger).toHaveTextContent('Efectivo');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('announces LoadingState and ErrorState with appropriate semantics', () => {
    const { rerender } = render(<LoadingState label="Cargando catalogo..." />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando catalogo...');

    rerender(<ErrorState title="No se pudo cargar" description="Intente nuevamente." />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
  });

  it('lets Skeleton stay hidden or visible to assistive technologies', () => {
    const { rerender } = render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Skeleton data-testid="skeleton" aria-hidden={false} />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'false');
  });

  it('keeps shell primitives shadcn-compatible and className-friendly', () => {
    render(
      <TooltipProvider>
        <Breadcrumb className="custom-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Actual</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator className="custom-separator" />
        <ScrollArea className="custom-scroll-area">
          <p>Contenido desplazable</p>
        </ScrollArea>
        <Tooltip>
          <TooltipTrigger>Estado</TooltipTrigger>
          <TooltipContent className="custom-tooltip">Servidor local disponible</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(screen.getByRole('navigation', { name: /ruta actual/i })).toHaveClass('custom-breadcrumb');
    expect(screen.getByText('Actual')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Contenido desplazable').closest('[data-slot="scroll-area"]')).toHaveClass('custom-scroll-area');
    expect(document.querySelector('[data-slot="separator"]')).toHaveClass('custom-separator');
  });
});
