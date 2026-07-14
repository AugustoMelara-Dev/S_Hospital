import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Input, Modal, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { KEYBOARD_SHORTCUTS, shortcutLabel, type ShortcutScope } from '@/lib/shortcuts';

type KeyboardShortcutsPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SCOPES: Array<{ id: ShortcutScope; label: string; description: string }> = [
  { id: 'global', label: 'Global', description: 'Atajos disponibles en cualquier pantalla.' },
  { id: 'pos', label: 'Punto de venta', description: 'Facturación y cobro.' },
  { id: 'cash', label: 'Caja', description: 'Apertura, cierre y movimientos.' },
  { id: 'history', label: 'Historial', description: 'Búsqueda y reimpresión de facturas.' },
  { id: 'reports', label: 'Reportes', description: 'Filtros y exportación.' },
];

export function KeyboardShortcutsPalette({ open, onOpenChange }: KeyboardShortcutsPaletteProps) {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) setFilter('');
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) return;

      const isOpen = document.querySelector('[data-shortcuts-palette="open"]') !== null;
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        onOpenChange(!isOpen);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredShortcuts = normalizedFilter
    ? KEYBOARD_SHORTCUTS.filter((entry) =>
        entry.description.toLowerCase().includes(normalizedFilter)
        || shortcutLabel(entry).toLowerCase().includes(normalizedFilter)
        || entry.scope.toLowerCase().includes(normalizedFilter),
      )
    : KEYBOARD_SHORTCUTS;

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={() => onOpenChange(false)}
      open={open}
      title={<Typography.Title level={2}>Atajos de teclado</Typography.Title>}
      width={640}
    >
      <Space data-shortcuts-palette={open ? 'open' : 'closed'} orientation="vertical" size="middle">
        <Typography.Paragraph type="secondary">
          Pulsa ? en cualquier momento para abrir esta paleta. Pulsa Esc para cerrar.
        </Typography.Paragraph>
        <Space.Compact block>
          <Input
            aria-label="Buscar atajo de teclado"
            autoComplete="off"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar atajo..."
            prefix={<SearchOutlined aria-hidden="true" />}
            type="search"
            value={filter}
          />
          {filter ? (
            <Button
              aria-label="Limpiar filtro de atajos"
              icon={<CloseOutlined aria-hidden="true" />}
              onClick={() => setFilter('')}
            >
              Limpiar
            </Button>
          ) : null}
        </Space.Compact>

        <Space orientation="vertical" size="middle">
          {SCOPES.map((scope) => {
            const scopeShortcuts = filteredShortcuts.filter((entry) => entry.scope === scope.id);
            if (scopeShortcuts.length === 0) return null;
            return (
              <section key={scope.id} aria-labelledby={`shortcuts-scope-${scope.id}`}>
                <Typography.Title id={`shortcuts-scope-${scope.id}`} level={3}>{scope.label}</Typography.Title>
                <Typography.Text type="secondary">{scope.description}</Typography.Text>
                <ul>
                  {scopeShortcuts.map((entry) => (
                    <li key={`${entry.scope}-${entry.key}-${entry.ctrl ? 'ctrl' : ''}`}>
                      <Flex justify="space-between" gap="middle">
                      <Typography.Text type="secondary">{entry.description}</Typography.Text>
                      <Typography.Text keyboard aria-label={shortcutLabel(entry)}>{shortcutLabel(entry)}</Typography.Text>
                      </Flex>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {filteredShortcuts.length === 0 ? (
            <Empty description={`No se encontraron atajos para «${filter}».`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : null}
        </Space>
      </Space>
    </Modal>
  );
}
