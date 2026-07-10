import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Field } from './Field';
import { Surface } from './Surface';
import { StatusMark } from './StatusMark';
import { ClinicalToaster, notify } from './Toaster';
import { MotionProvider } from '../motion/MotionProvider';

const sonner = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(() => 'error-id'),
  info: vi.fn(() => 'info-id'),
  loading: vi.fn(() => 'loading-id'),
  promise: vi.fn(() => 'promise-id'),
  success: vi.fn(() => 'success-id'),
  toaster: vi.fn(() => null),
  warning: vi.fn(() => 'warning-id'),
}));

vi.mock('sonner', () => ({
  Toaster: sonner.toaster,
  toast: {
    dismiss: sonner.dismiss,
    error: sonner.error,
    info: sonner.info,
    loading: sonner.loading,
    promise: sonner.promise,
    success: sonner.success,
    warning: sonner.warning,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

it('mantiene estado ocupado accesible', () => {
  render(<Button aria-busy="false" busy>Guardar</Button>);
  expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button')).toBeDisabled();
});

it('mantiene estado ocupado accesible cuando compone un enlace', () => {
  const onClick = vi.fn();

  render(
    <Button aria-disabled="false" asChild busy>
      <a href="#facturas" onClick={onClick}>Guardar</a>
    </Button>,
  );

  const link = screen.getByRole('link', { name: 'Guardar' });
  fireEvent.click(link);

  expect(link).toHaveAttribute('aria-busy', 'true');
  expect(link).toHaveAttribute('aria-disabled', 'true');
  expect(onClick).not.toHaveBeenCalled();
});

it('conserva la interaccion de un enlace compuesto cuando no esta bloqueado', () => {
  const onClick = vi.fn();

  render(
    <Button asChild>
      <a href="#facturas" onClick={onClick}>Abrir facturas</a>
    </Button>,
  );

  fireEvent.click(screen.getByRole('link', { name: 'Abrir facturas' }));

  expect(onClick).toHaveBeenCalledOnce();
});

it('asocia ayuda y error al control', async () => {
  const { container } = render(
    <Field
      label="Paciente"
      name="patient"
      hint="Solo nombre"
      error="Ingrese el nombre"
    />,
  );

  expect(screen.getByLabelText('Paciente')).toHaveAccessibleDescription(
    'Solo nombre Ingrese el nombre',
  );
  expect(await axe(container)).toHaveNoViolations();
});

it('permite una superficie aside semantica', () => {
  render(<Surface as="aside">Resumen</Surface>);

  expect(screen.getByRole('complementary')).toHaveTextContent('Resumen');
});

it('muestra un estado con indicador no cromatico y texto visible', () => {
  render(<StatusMark tone="success" label="Pagada" />);

  expect(screen.getByText('Pagada')).toBeVisible();
  expect(screen.getByLabelText('Estado: Pagada')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('MotionProvider renderiza sus children', () => {
  render(
    <MotionProvider>
      <span>Contenido clinico</span>
    </MotionProvider>,
  );

  expect(screen.getByText('Contenido clinico')).toBeInTheDocument();
});

it('configura un toaster clinico unico con mensajes en espanol', () => {
  render(<ClinicalToaster />);

  expect(sonner.toaster).toHaveBeenCalledWith(
    expect.objectContaining({
      containerAriaLabel: 'Notificaciones',
      position: 'top-right',
      visibleToasts: 2,
      toastOptions: expect.objectContaining({
        closeButtonAriaLabel: 'Cerrar notificación',
        classNames: expect.objectContaining({
          closeButton: expect.stringMatching(/\bmin-h-11\b.*\bmin-w-11\b/),
        }),
      }),
    }),
    undefined,
  );
});

it('deduplica la misma notificacion durante la ventana activa', () => {
  const firstId = notify.success('Factura guardada');
  const secondId = notify.success('  FACTURA   GUARDADA  ');

  expect(firstId).toBe(secondId);
  expect(sonner.success).toHaveBeenCalledTimes(1);
});

it('notify.promise conserva la promesa original', async () => {
  const promise = Promise.resolve('lista');
  const result = notify.promise(promise, {
    loading: 'Procesando',
    success: 'Completado',
    error: 'No se pudo completar',
  });

  expect(result).toBe(promise);
  await expect(result).resolves.toBe('lista');
});
