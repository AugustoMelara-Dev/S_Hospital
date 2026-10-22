import type { ReactNode } from 'react';
import { AdminSpinner } from './components';

/**
 * Plantilla compartida de autenticación (V01 y V15).
 *
 * Antes cada superficie de acceso resolvía su propio armazón: el login usaba una
 * tarjeta centrada y el cambio obligatorio de contraseña un panel azul a pantalla
 * dividida. Eran dos lenguajes para la misma tarea, así que el usuario percibía
 * dos productos. Aquí hay **una** plantilla: columna compacta centrada, marca
 * legible y una única superficie de formulario.
 *
 * Reglas que impone:
 * - **Una sola indicación de estado** por pantalla (`notice`). El estado técnico
 *   permanente («Listo para iniciar sesión local») no existe: el hueco solo se
 *   ocupa cuando hay carga, aviso o error relevante.
 * - **Sin contenido promocional**: la plantilla no alarga el acceso.
 * - La marca es el nombre institucional real y, si existe, el logo cargado. No se
 *   inventa escudo, sello ni identidad fiscal.
 * - El foco visible lo aporta `.ui-root`/tokens, no clases ad hoc.
 */

export type AuthLayoutProps = {
  /** Título del formulario (h1 de la pantalla). */
  title: string;
  /** Línea de contexto bajo el título. */
  description?: string;
  /** Marca legible: nombre institucional ya resuelto. */
  brandName: string;
  logoUrl?: string | null;
  /** Único bloque de estado/aviso de la pantalla. */
  notice?: ReactNode;
  /** Formulario u contenido principal. */
  children: ReactNode;
  /** Detalle accesible bajo demanda (p. ej. requisitos de contraseña). */
  details?: ReactNode;
  /** Pie discreto (uso interno, versión). */
  footer?: ReactNode;
  /** Muestra el indicador de trabajo en curso junto al título. */
  busy?: boolean;
  /** Referencia del título para `aria-labelledby`. */
  titleId: string;
};

export function AuthLayout({
  brandName,
  busy = false,
  children,
  description,
  details,
  footer,
  logoUrl,
  notice,
  title,
  titleId,
}: AuthLayoutProps) {
  return (
    <main className="ui-root flex min-h-dvh items-center justify-center bg-[var(--ui-surface-alt)] px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <header className="mb-5 flex items-center gap-3 px-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              /* Papel institucional del logo (§4): matriz blanca canónica vía
                 token `--ui-doc-surface`. Contorno blanco 10 % (better-ui:
                 outlines de imagen: puro blanco en dark). */
              className="size-11 rounded-[var(--ui-radius-control)] bg-[var(--ui-doc-surface)] object-contain p-1 outline outline-1 -outline-offset-1 outline-[oklch(1_0_0/0.1)]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] text-[color:var(--ui-action-foreground)] shadow-sm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          )}
          <div className="min-w-0">
            <p className="text-pretty text-[length:var(--ui-text-base)] font-semibold leading-snug text-[color:var(--ui-ink)]">
              {brandName}
            </p>
            <p className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">
              Atención y caja hospitalaria
            </p>
          </div>
        </header>

        <section
          aria-labelledby={titleId}
          className="ui-card-raised overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)]"
        >
          <div aria-hidden="true" className="h-1 bg-[var(--ui-action)]" />
          <div className="p-5 sm:p-6">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1
                  id={titleId}
                  className="text-[length:var(--ui-text-xl)] font-semibold tracking-tight text-[color:var(--ui-ink)]"
                >
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 text-[length:var(--ui-text-sm)] leading-5 text-[color:var(--ui-ink-soft)]">
                    {description}
                  </p>
                ) : null}
              </div>
              {busy ? <AdminSpinner /> : null}
            </header>

            {notice ? <div className="mt-4">{notice}</div> : null}
            <div className="mt-5">{children}</div>
            {details ? <div className="mt-5 border-t border-[var(--ui-line)] pt-4">{details}</div> : null}
          </div>
        </section>

        {footer ? (
          <p className="mt-5 text-center text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">
            {footer}
          </p>
        ) : null}
      </div>
    </main>
  );
}
