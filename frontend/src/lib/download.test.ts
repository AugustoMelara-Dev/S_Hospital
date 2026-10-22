import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, openBlobInNewTab } from './download';

/**
 * C1-RCP-01: local application failures for the institutional PDF handoff.
 *
 * The "popup blocked" case is a SIMULATION: `window.open` is stubbed to return
 * null, which is what a browser does when it blocks a new tab/window. This does
 * not test any native dialog, printer driver or physical paper output.
 */
describe('download helpers (popup-blocked fallback is a simulation)', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:receipt');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the file when the browser blocks the new tab (simulated null window.open)', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue(null);

    openBlobInNewTab(new Blob(['%PDF'], { type: 'application/pdf' }), 'recibo-institucional.pdf');

    expect(window.open).toHaveBeenCalledWith('blob:receipt', '_blank', 'noopener,noreferrer');
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
  });

  it('opens the blob in a new tab and defers the object URL revocation when allowed', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue({} as Window);

    openBlobInNewTab(new Blob(['%PDF'], { type: 'application/pdf' }), 'recibo-institucional.pdf');

    expect(window.open).toHaveBeenCalledWith('blob:receipt', '_blank', 'noopener,noreferrer');
    expect(click).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('creates an anchor with the requested filename when downloading directly', () => {
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
      if (element instanceof HTMLAnchorElement) anchors.push(element);
      return element;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadBlob(new Blob(['%PDF'], { type: 'application/pdf' }), 'recibo-institucional-REC-A-00000090.pdf');

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchors[0]?.download).toBe('recibo-institucional-REC-A-00000090.pdf');
  });
});
