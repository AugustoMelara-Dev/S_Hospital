import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  SectionHeader,
  CommandCenterHeader,
  CommandPanel,
  WorkflowPanel,
  StatGrid,
  InfoPanel,
  OfflineState,
  PermissionState,
  OperationalBanner,
  CashStatusCard,
  PermissionBadge,
  QuickActionTile,
  PrintPreviewFrame,
  PaperProfileSelector
} from './design-system';

const meta: Meta = {
  title: 'Institutional/SharedComponents',
  parameters: {
    layout: 'padded',
  },
};

export default meta;

export const Headers: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">SectionHeader</h3>
        <SectionHeader
          title="Facturación de Paciente"
          description="Cree una nueva factura para pacientes ambulatorios o de diálisis."
          eyebrow="Operaciones de Caja"
          actions={<button className="bg-primary text-white px-3 py-1.5 text-sm font-semibold">Nueva Acción</button>}
        />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">CommandCenterHeader</h3>
        <CommandCenterHeader
          title="Panel de Control Hospitalario"
          description="Resumen operativo del estado de caja y transacciones del día."
          meta="ADMINISTRACIÓN"
          status={<span className="bg-green-600 text-white px-2 py-0.5 text-xs font-bold">ACTIVO</span>}
        />
      </div>
    </div>
  ),
};

export const Panels: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-4 max-w-4xl">
      <CommandPanel title="Filtros de Búsqueda" description="Filtrar facturas por rango de fecha o estado.">
        <div className="p-4 border border-dashed border-border text-muted-foreground text-sm">Contenido del panel de control de filtros...</div>
      </CommandPanel>
      
      <WorkflowPanel title="Apertura de Turno" description="Caja Chica y Saldo Inicial." tone="info">
        <div className="p-4 text-sm text-foreground">El saldo inicial sugerido para este turno es L. 500.00.</div>
      </WorkflowPanel>
    </div>
  )
};

export const Stats: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <StatGrid
        items={[
          { label: 'Total Facturado', value: 'L 24,500.00', helper: '+12% respecto a ayer' },
          { label: 'Facturas Emitidas', value: '142', helper: '120 pagadas, 22 pendientes' },
          { label: 'Cajas Abiertas', value: '3 / 4', tone: 'info', helper: 'Turno matutino activo' },
          { label: 'Alertas del Sistema', value: '0', tone: 'success', helper: 'Sin anomalías' },
        ]}
      />
    </div>
  )
};

export const StatesAndAlerts: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-4 max-w-2xl">
      <InfoPanel title="Aviso de Mantenimiento" description="El servidor local se reiniciará a las 11:00 PM para mantenimiento." tone="info" />
      <OfflineState title="Servidor local no disponible" description="No se pudo establecer conexión con el servidor de base de datos local LAN." />
      <PermissionState state="denied" title="Acceso restringido" description="Tu usuario no tiene el permiso 'billing.delete' requerido para anular esta factura." />
    </div>
  )
};

export const BadgesAndButtons: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-wrap gap-2">
        <PermissionBadge permission="invoices.create" state="granted">Granted</PermissionBadge>
        <PermissionBadge permission="settings.edit" state="readonly">Read-only</PermissionBadge>
        <PermissionBadge permission="audit.view" state="denied">Denied</PermissionBadge>
        <PermissionBadge permission="system.reset" state="system">System</PermissionBadge>
      </div>
      <div className="max-w-xs">
        <QuickActionTile title="Cobrar Factura" description="Registrar pago y emitir recibo institucional" />
      </div>
    </div>
  )
};

export const OperationalAndPrinting: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6 p-4 max-w-4xl">
      <OperationalBanner
        title="Centro de Control"
        description="Estado general de los servicios LAN y sincronización."
        meta="SISTEMA"
      />
      <div className="grid gap-6 md:grid-cols-2">
        <CashStatusCard
          status="open"
          amount="L 1,500.00"
          cashier="Augusto Melara"
          timestamp="12/07/2026 08:30"
          helper="Caja chica inicial registrada."
        />
        <PaperProfileSelector
          value="media_carta"
          onChange={() => {}}
          helperText="Los márgenes del recibo institucional se adaptan automáticamente al perfil de papel."
        />
      </div>
      <PrintPreviewFrame title="Recibo Institucional 001-002" description="Vista de pre-impresión">
        <div className="p-8 bg-white text-slate-800 border border-slate-300 font-serif">
          [Contenido del Recibo Impreso]
        </div>
      </PrintPreviewFrame>
    </div>
  )
};
