export function finiteNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatLempiras(value: number | string | null | undefined, fractionDigits = 2): string {
  return `L. ${finiteNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
