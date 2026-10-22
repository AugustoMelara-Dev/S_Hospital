import { expect, type Download, type Page, type Response } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Helpers de la suite de identidad dark (`identidad-dark-*`, 2026-10-16).
 * Sustituye a `azul-blanco-helpers.ts`: mismo contrato funcional, nueva
 * identidad de evidencia (DARK-20261016) y variables de entorno con alias
 * retrocompatible (DARK_* nuevo; AZB_* sigue siendo aceptado para no romper
 * los runbooks de laboratorio documentados).
 */

export const BASE_URL = (process.env.DARK_BASE_URL ?? process.env.AZB_BASE_URL ?? 'http://127.0.0.1:15173').replace(/\/$/, '');
export const API_URL = (process.env.DARK_API_URL ?? process.env.AZB_API_URL ?? 'http://127.0.0.1:18080').replace(/\/$/, '');
export const CASHIER = process.env.DARK_CASHIER ?? process.env.AZB_CASHIER ?? 'azb.qa.cajero';
export const ADMIN = process.env.DARK_ADMIN ?? process.env.AZB_ADMIN ?? 'azb.qa.admin';
export const PASSWORD = process.env.DARK_PASSWORD ?? process.env.AZB_PASSWORD ?? 'AzbQa-2026!';
export const EVIDENCE_ROOT = resolve(
  process.env.DARK_EVIDENCE_DIR ?? process.env.AZB_EVIDENCE_DIR ?? '../hospital-ai/evidencia/DARK-20261016/QA-E2E',
);

export type ApiEvidence = {
  method: string;
  path: string;
  status: number;
  id?: number | string;
  invoice_number?: string;
  receipt_id?: number;
  receipt_number?: string;
};

export async function login(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-input').fill(username);
  await page.locator('#password-input').fill(PASSWORD);
  const loginResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login',
  );
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    throw new Error(
      `Login HTTP ${loginResponse.status()}${loginResponse.headers()['retry-after'] ? `; Retry-After=${loginResponse.headers()['retry-after']}` : ''}`,
    );
  }
  await expect(page.locator('#login-input')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  let button = page.getByRole('button', { name: /^salir$/i });
  if (!await button.isVisible().catch(() => false)) {
    const navigation = page.getByRole('button', { name: /abrir navegación/i });
    if (await navigation.isVisible().catch(() => false)) {
      await navigation.click();
      button = page.getByRole('button', { name: /^salir$/i });
    }
  }
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await expect(page.locator('#login-input')).toBeVisible();
  }
}

export async function addCatalogItem(page: Page, query: string, useEnter = false): Promise<void> {
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await expect(search).toBeVisible();
  await search.fill(query);
  await expect(page.getByRole('list', { name: /resultados del catálogo/i })).toBeVisible();
  const result = page.getByRole('button', { name: new RegExp(`^agregar resultado:\\s*${escapeRegex(query)}$`, 'i') });
  await expect(result).toBeVisible();
  if (useEnter) {
    await search.press('Enter');
  } else {
    await result.click();
  }
}

export async function waitForPreview(page: Page): Promise<Record<string, unknown>> {
  const response = await page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/invoices\/preview(?:\?|$)/.test(candidate.url()),
  );
  expect(response.ok(), `preview ${response.status()}`).toBe(true);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function saveDownload(download: Download, filename: string): Promise<string> {
  const path = resolve(EVIDENCE_ROOT, filename);
  mkdirSync(dirname(path), { recursive: true });
  await download.saveAs(path);
  return path;
}

export function writeEvidence(filename: string, value: unknown): string {
  const path = resolve(EVIDENCE_ROOT, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

export async function responseEvidence(response: Response): Promise<ApiEvidence> {
  let body: Record<string, unknown> = {};
  try {
    body = await response.json() as Record<string, unknown>;
  } catch {
    // Los PDF/Excel no son JSON; para esos artefactos basta status + ruta.
  }
  const data = (body.data ?? {}) as Record<string, unknown>;
  const invoice = (data.invoice ?? data) as Record<string, unknown>;
  const receipt = (data.institutional_receipt ?? data.receipt ?? {}) as Record<string, unknown>;
  return {
    method: response.request().method(),
    path: new URL(response.url()).pathname,
    status: response.status(),
    ...(typeof invoice.id === 'number' ? { id: invoice.id } : {}),
    ...(typeof invoice.invoice_number === 'string' ? { invoice_number: invoice.invoice_number } : {}),
    ...(typeof receipt.id === 'number' ? { receipt_id: receipt.id } : {}),
    ...(typeof receipt.receipt_number_full === 'string' ? { receipt_number: receipt.receipt_number_full } : {}),
  };
}

export async function fetchJson<T>(page: Page, path: string): Promise<{ status: number; body: T }> {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { headers: { Accept: 'application/json' } });
    return { status: response.status, body: await response.json() as T };
  }, path);
}

export function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
