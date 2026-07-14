export function getVisibleRefetchInterval(intervalMs: number): number | false {
  if (typeof document === 'undefined') {
    return intervalMs;
  }

  return document.visibilityState === 'visible' ? intervalMs : false;
}
