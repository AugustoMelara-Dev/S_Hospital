import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Monitor, Moon, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BUSINESS_TZ } from '@/lib/dates';
import { useTheme, type ThemePref } from '@/lib/theme';
import { NAV_ITEMS } from '@/app/nav';
import { IconButton } from '@/ui/IconButton';
import { Kbd } from '@/ui/Kbd';
import { CashStatusPill } from './CashStatusPill';

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'Tema: según el sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <IconButton
      label={THEME_LABEL[theme]}
      icon={<Icon strokeWidth={1.6} />}
      onClick={() => setTheme(THEME_NEXT[theme])}
      className={className}
    />
  );
}

/** Section name for pages that do not render a PageHeader (e.g. 404). */
function sectionName(pathname: string): string {
  const hit = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(`${n.to}/`)));
  return hit?.label ?? 'S_Hospital';
}

const clockFmt = new Intl.DateTimeFormat('es-HN', {
  timeZone: BUSINESS_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "martes 17 nov 2026 · 10:42" in Honduras time. */
export function formatClock(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of clockFmt.formatToParts(d)) p[part.type] = part.value;
  const month = (p.month ?? '').replace(/\./g, '');
  return `${p.weekday} ${p.day} ${month} ${p.year} · ${p.hour}:${p.minute}`;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="num shrink-0 text-[13px] whitespace-nowrap text-ink-2 max-[1279px]:hidden">
      {formatClock(now)}
    </time>
  );
}

export function TopBar({ onOpenPalette, titleSlotRef }: { onOpenPalette: () => void; titleSlotRef: (el: HTMLElement | null) => void }) {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-6 border-b border-junta bg-surface px-6 max-[1099px]:gap-4 max-[1099px]:px-4">
      {/* The title never collapses to a letter: it keeps its width and only truncates past 60% of the bar. */}
      <div className="flex max-w-[60%] shrink-0 items-center max-[639px]:[&_h1]:text-[19px]">
        {/* PageHeader portals the page's h1 here. */}
        <div ref={titleSlotRef} data-page-title-slot="" className="min-w-0 empty:hidden" />
        <p
          aria-hidden="true"
          className="truncate text-[22px] max-[639px]:text-[19px] leading-7 font-bold tracking-[-0.015em] text-ink [[data-page-title-slot]:not(:empty)+&]:hidden"
        >
          {sectionName(pathname)}
        </p>
      </div>
      <CashStatusPill />
      <button
        type="button"
        onClick={onOpenPalette}
        aria-keyshortcuts="Control+K"
        className={cn(
          'pressable ml-auto flex h-9 w-[400px] min-w-0 shrink items-center gap-2 rounded-[var(--radius-md)] border border-junta bg-field pr-2 pl-3 text-[14px] text-ink-2',
          'hover:border-junta-strong max-[899px]:size-9 max-[899px]:shrink-0 max-[899px]:justify-center max-[899px]:px-0',
        )}
      >
        <Search className="size-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left max-[899px]:sr-only">Buscar paciente, documento o acción</span>
        <Kbd className="max-[899px]:hidden">Ctrl K</Kbd>
      </button>
      <ThemeToggle className="-mx-2" />
      <Clock />
    </header>
  );
}
