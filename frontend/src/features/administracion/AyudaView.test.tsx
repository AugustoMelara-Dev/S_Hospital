import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/lib/api';
import { AdminSessionProvider } from '@/shell/admin/AdminSessionContext';
import { AyudaView } from './AyudaView';

function userWith(permissions: string[]): AuthUser {
  return {
    id: 9,
    name: 'Usuario de prueba',
    email: 'usuario@hospital.local',
    username: 'usuario',
    active: true,
    roles: ['prueba'],
    permissions,
    must_change_password: false,
  };
}

function renderHelp(permissions: string[]) {
  render(
    <MemoryRouter>
      <AdminSessionProvider
        user={userWith(permissions)}
        cashSession={null}
        cashSessionLoading={false}
        onStatus={() => undefined}
      >
        <AyudaView />
      </AdminSessionProvider>
    </MemoryRouter>,
  );
}

describe('AyudaView por permisos', () => {
  it('muestra al cajero sólo las tareas operativas autorizadas', () => {
    renderHelp([
      'invoices.create',
      'catalog.view',
      'cash.view',
      'payments.create',
      'receipts.view',
      'invoices.view',
    ]);

    const daily = screen.getByRole('region', { name: /trabajo diario/i });
    expect(within(daily).getByRole('link', { name: /abrir cobrar/i })).toHaveAttribute('href', '/cobrar');
    expect(within(daily).getByRole('link', { name: /abrir recibos/i })).toHaveAttribute('href', '/recibos');
    expect(within(daily).getByRole('link', { name: /abrir caja/i })).toHaveAttribute('href', '/caja');
    expect(within(daily).getAllByText(/cómo hacerlo/i)).toHaveLength(5);
    expect(within(daily).getByText(/si la impresión falla.*no cobre otra vez/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /impresión avanzada/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /respaldos/i })).not.toBeInTheDocument();
  });

  it('acepta catalog.manage legado y enlaza a una ruta real', () => {
    renderHelp(['catalog.manage']);

    expect(screen.getByRole('link', { name: /abrir catálogo/i })).toHaveAttribute(
      'href',
      '/administracion/catalogo',
    );
  });

  it('no invita a usuarios de solo consulta a realizar acciones denegadas', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AdminSessionProvider user={userWith(['catalog.view'])} cashSession={null} cashSessionLoading={false} onStatus={() => undefined}>
          <AyudaView />
        </AdminSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/consultar catálogo y precios/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite a una persona con permiso de gestión/i)).toBeInTheDocument();
    expect(screen.queryByText(/guarde sólo después/i)).not.toBeInTheDocument();
    unmount();

    renderHelp(['users.view']);
    expect(screen.getByText(/^consultar usuarios$/i)).toBeInTheDocument();
    expect(screen.getByText(/solicite a otro administrador autorizado/i)).toBeInTheDocument();
    expect(screen.queryByText(/recuperar acceso a s_hospital/i)).not.toBeInTheDocument();
    cleanup();

    renderHelp(['backups.view']);
    expect(screen.getByText(/solicite a una persona autorizada crear o descargar/i)).toBeInTheDocument();
    expect(screen.queryByText(/^use crear respaldo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^descargue la copia/i)).not.toBeInTheDocument();
  });

  it('explica que integridad no equivale a restauración', () => {
    renderHelp(['backups.view', 'backups.create', 'backups.download']);

    expect(screen.getByText(/integridad confirma el archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/no demuestra por sí sola/i)).toBeInTheDocument();
    expect(screen.getByText(/si la unidad externa no está disponible.*no se considera copia externa/i)).toBeInTheDocument();
    expect(screen.getByText(/herramienta de mantenimiento instalada en Inicio de Windows/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir respaldos/i })).toHaveAttribute(
      'href',
      '/administracion/mantenimiento/respaldos',
    );
  });

  it('explica la recuperación del administrador único sin ofrecer un enlace público', () => {
    renderHelp(['users.view', 'users.update']);

    expect(screen.getByText(/si es el único administrador/i)).toBeInTheDocument();
    expect(screen.getByText(/recuperar acceso a s_hospital.*inicio de windows.*responsable local.*autorizar/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /recuperar acceso/i })).not.toBeInTheDocument();
  });

  it('reserva impresión para el paquete completo de soporte', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AdminSessionProvider
          user={userWith(['receipt_settings.view'])}
          cashSession={null}
          cashSessionLoading={false}
          onStatus={() => undefined}
        >
          <AyudaView />
        </AdminSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /impresión avanzada/i })).not.toBeInTheDocument();
    unmount();

    renderHelp(['receipt_settings.view', 'receipt_settings.advanced']);
    expect(screen.getByRole('link', { name: /impresión avanzada/i })).toHaveAttribute(
      'href',
      '/administracion/ajustes?panel=papel',
    );
  });

  it('explica cómo llevar una actualización autorizada al servidor sin depender de internet', () => {
    renderHelp(['backups.view']);

    expect(screen.getByText(/por descarga o memoria USB/i)).toBeInTheDocument();
    expect(screen.getByText(/cierre la operación.*usuarios salir del sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/misma computadora/i)).toBeInTheDocument();
    expect(screen.getByText(/no desinstale.*ni borre su carpeta/i)).toBeInTheDocument();
  });

  it('muestra un vacío honesto cuando el rol no tiene tareas', () => {
    renderHelp([]);

    expect(screen.getByText(/^sin tareas habilitadas$/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Ayuda para casos especiales', () => {
  it('explica emisión sin cobro, gratuidad por línea y cierre bloqueado', () => {
    renderHelp(['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view']);
    expect(screen.getByText(/^Emitir sin cobro$/i)).toBeInTheDocument();
    expect(screen.getByText(/sólo la línea elegible de eritropoyetina/i)).toBeInTheDocument();
    expect(screen.getByText(/si el cierre está bloqueado/i)).toBeInTheDocument();
  });
  it('distingue anulación de reversión y conserva el historial', () => {
    renderHelp(['invoices.view', 'invoices.void', 'invoices.reverse']);
    expect(screen.getByText(/^Anular una operación$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Revertir una operación cobrada$/i)).toBeInTheDocument();
    expect(screen.getByText(/no borre ni reemplace el comprobante original/i)).toBeInTheDocument();
  });
  it('dirige al auditor hacia auditoría sin ofrecer reportes financieros', () => {
    renderHelp(['audit.view']);
    expect(screen.getByRole('link', { name: /abrir auditoría/i })).toHaveAttribute('href', '/administracion/auditoria');
    expect(screen.queryByRole('link', { name: /abrir reportes/i })).not.toBeInTheDocument();
  });
});
