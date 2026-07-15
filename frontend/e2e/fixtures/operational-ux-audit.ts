import { expect, type Page, type TestInfo } from '@playwright/test';

export type OperationalPageAudit = {
  viewport: { width: number; height: number };
  document: { scrollWidth: number; clientWidth: number; horizontalOverflow: number };
  panels: Record<string, { x: number; y: number; width: number; height: number }>;
  scrollContainers: Array<{
    selector: string;
    overflowY: string;
    scrollHeight: number;
    clientHeight: number;
  }>;
  stickyElements: Array<{ text: string; top: number; bottom: number }>;
  primaryAction: { visible: boolean; inViewport: boolean; covered: boolean } | null;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

type CaptureOptions = {
  routeName: string;
  primaryAction: string;
  testInfo: TestInfo;
};

export function observeOperationalPage(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  return {
    async capture(options: CaptureOptions): Promise<OperationalPageAudit> {
      await page.waitForLoadState('networkidle');

      const geometry = await page.evaluate(() => {
        const rect = (element: Element) => {
          const value = element.getBoundingClientRect();

          return { x: value.x, y: value.y, width: value.width, height: value.height };
        };
        const panels = Object.fromEntries(
          [...document.querySelectorAll('[data-audit-panel]')].map((element) => [
            element.getAttribute('data-audit-panel')!,
            rect(element),
          ]),
        );
        const scrollContainers = [...document.querySelectorAll<HTMLElement>('body *')]
          .map((element) => ({ element, style: getComputedStyle(element) }))
          .filter(({ element, style }) => (
            /(auto|scroll)/.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 1
          ))
          .map(({ element, style }) => ({
            selector: element.id
              ? `#${element.id}`
              : element.getAttribute('data-audit-panel') ?? element.tagName.toLowerCase(),
            overflowY: style.overflowY,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          }));
        const stickyElements = [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => getComputedStyle(element).position === 'sticky')
          .map((element) => {
            const bounds = rect(element);

            return {
              text: element.innerText.slice(0, 80),
              top: bounds.y,
              bottom: bounds.y + bounds.height,
            };
          });

        return {
          viewport: { width: innerWidth, height: innerHeight },
          document: {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            horizontalOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
          },
          panels,
          scrollContainers,
          stickyElements,
        };
      });
      const primary = page
        .getByRole('button', { name: options.primaryAction })
        .or(page.getByRole('link', { name: options.primaryAction }))
        .first();
      const primaryAction = await primary.count()
        ? {
            visible: await primary.isVisible(),
            inViewport: await primary.evaluate((element) => {
              const box = element.getBoundingClientRect();

              return (
                box.width > 0
                && box.height > 0
                && box.top >= 0
                && box.left >= 0
                && box.bottom <= innerHeight
                && box.right <= innerWidth
              );
            }),
            covered: await primary.evaluate((element) => {
              const box = element.getBoundingClientRect();
              const hit = document.elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2,
              );

              return hit !== element && !element.contains(hit);
            }),
          }
        : null;
      const audit: OperationalPageAudit = {
        ...geometry,
        primaryAction,
        consoleErrors,
        pageErrors,
        failedRequests,
      };

      await options.testInfo.attach(`${options.routeName}-audit`, {
        body: JSON.stringify(audit, null, 2),
        contentType: 'application/json',
      });
      await page.screenshot({
        path: options.testInfo.outputPath(`${options.routeName}.png`),
        fullPage: true,
      });

      return audit;
    },
  };
}

export function assertNoDocumentOverflow(audit: OperationalPageAudit) {
  expect(audit.document.horizontalOverflow).toBe(0);
}
