import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Input, List } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { type AuthUser } from '../../lib/api';
import { type AppNavigationItem } from '../../navigation/appNavigation';

export type ClinicalCommand = {
  id: string;
  label: string;
  path: string;
  group: 'Administración' | 'Operaciones' | 'Asistencia';
  keywords: string[];
};

type CommandPaletteProps = {
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AuthUser;
};

export function buildPermittedCommands(_user: AuthUser, navigation: readonly AppNavigationItem[]): ClinicalCommand[] {
  return navigation.map((item) => ({
    id: item.id,
    label: item.label,
    path: item.path,
    group: item.navigationGroup === 'support' ? 'Asistencia' : item.navigationGroup === 'operations' ? 'Operaciones' : 'Administración',
    keywords: [item.label, item.path, item.navigationGroup ?? 'operations'],
  }));
}

export function CommandPalette({ navigation, onOpenChange, open, user }: CommandPaletteProps) {
  const navigate = useNavigate();
  const commands = buildPermittedCommands(user, navigation);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset search on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(0);
    }
  }, [open]);

  const filteredCommands = commands.filter((cmd) => {
    const query = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(query) ||
      cmd.group.toLowerCase().includes(query) ||
      cmd.keywords.some((kw) => kw.toLowerCase().includes(query))
    );
  });

  const selectCommand = useCallback((path: string) => {
    navigate(path);
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  // Keyboard navigation handlers
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[activeIndex]) {
          selectCommand(filteredCommands[activeIndex].path);
        }
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, activeIndex, selectCommand, onOpenChange]);

  return (
    <Modal
      title="Comandos"
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      closable={false}
      width={600}
      styles={{ body: { padding: 0 } }}
      style={{ top: '15vh' }}
      destroyOnClose
      transitionName=""
      maskTransitionName=""
    >
      <div className="flex flex-col border border-border bg-surface" ref={containerRef}>
        <div className="border-b border-border p-3">
          <Input
            autoFocus
            size="large"
            placeholder="Buscar pantalla o acción (Use ↑↓ para navegar, Enter para seleccionar)..."
            prefix={<SearchOutlined className="text-muted-foreground mr-1" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            variant="borderless"
            className="w-full text-base font-medium"
          />
        </div>
        
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron comandos.
            </div>
          ) : (
            <List
              dataSource={filteredCommands}
              renderItem={(item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => selectCommand(item.path)}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition border-none text-left bg-transparent text-foreground outline-none font-normal',
                      isActive ? 'bg-primary text-white font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn('text-xs font-semibold uppercase tracking-wider', isActive ? 'text-blue-100' : 'text-muted-foreground')}>
                      {item.group}
                    </span>
                  </button>
                );
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
