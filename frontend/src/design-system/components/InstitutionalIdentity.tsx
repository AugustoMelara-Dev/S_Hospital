export type InstitutionalIdentityProps = {
  hospitalName: string;
  location: string;
  logoUrl?: string | null;
  provisional?: boolean;
  compact?: boolean;
  showSetupHint?: boolean;
};

export function InstitutionalIdentity({
  hospitalName,
  location,
  logoUrl,
  provisional = !logoUrl,
  compact = false,
  showSetupHint = false,
}: InstitutionalIdentityProps) {
  return (
    <div
      className="flex min-w-0 items-center gap-3"
      data-identity-state={provisional ? 'provisional' : 'verified'}
    >
      <div
        className={`institutional-logo-box flex shrink-0 items-center justify-center border border-border bg-receipt-paper ${compact ? 'size-11' : 'size-14'}`}
        aria-hidden={logoUrl ? undefined : true}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={hospitalName}
            className="max-h-full max-w-full object-contain p-1"
          />
        ) : (
          <span className="font-semibold tracking-wider text-receipt-ink">HGSI</span>
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <strong className={`block text-current ${compact ? 'text-xs leading-snug' : 'truncate'}`}>{hospitalName}</strong>
        {!compact ? <span className="mt-1 block text-sm text-muted-foreground">{location}</span> : null}
        {provisional && showSetupHint ? (
          <span className="mt-1 block text-xs font-medium text-muted-foreground">Agregue el logotipo oficial</span>
        ) : null}
      </div>
    </div>
  );
}
