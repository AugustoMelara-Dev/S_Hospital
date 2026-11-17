import { ChevronDown, KeyRound, LogOut, Monitor, Moon, Search, Sun } from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { useTheme, type ThemePref } from '@/lib/theme';
import { useAuth, useMe } from '@/auth/hooks';
import { IconButton } from '@/ui/IconButton';
import { Kbd } from '@/ui/Kbd';
import { Menu } from '@/ui/Menu';
import { CashStatusPill } from './CashStatusPill';

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'Tema: según el sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return <IconButton label={THEME_LABEL[theme]} icon={<Icon />} onClick={() => setTheme(THEME_NEXT[theme])} />;
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const me = useMe();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md md:px-6">
      <CashStatusPill />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          'pressable hidden h-8 w-64 items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-2.5 text-[13px] text-ink-3 sm:flex',
          'hover:border-line-strong',
        )}
        aria-keyshortcuts="Control+K"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="flex-1 text-left">Buscar</span>
        <span className="flex items-center gap-0.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <IconButton label="Buscar (Ctrl K)" icon={<Search />} onClick={onOpenPalette} className="sm:hidden" />
      <ThemeToggle />
      <Menu
        trigger={(p) => (
          <button
            {...p}
            type="button"
            className="pressable flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] py-1 pr-1.5 pl-1 hover:bg-surface-2 aria-expanded:bg-surface-2"
          >
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-[11.5px] font-semibold text-brand"
            >
              {initials(me.name)}
            </span>
            <span className="hidden flex-col items-start leading-tight md:flex">
              <span className="max-w-[160px] truncate text-[13px] font-medium text-ink">{me.name}</span>
              <span className="text-[11.5px] text-ink-3">{me.role.name}</span>
            </span>
            <ChevronDown className="size-3.5 text-ink-3" aria-hidden="true" />
          </button>
        )}
        items={[
          { type: 'label', label: <span className="flex flex-col"><span className="font-medium text-ink">{me.name}</span><span>@{me.username} · {me.role.name}</span></span> },
          { type: 'separator' },
          { label: 'Cambiar contraseña', icon: <KeyRound />, onSelect: () => navigate('/cambiar-clave') },
          { type: 'separator' },
          { label: 'Salir', icon: <LogOut />, danger: true, onSelect: () => void logout() },
        ]}
      />
    </header>
  );
}
