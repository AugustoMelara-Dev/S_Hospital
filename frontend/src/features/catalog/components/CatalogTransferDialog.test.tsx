import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogTransferDialog } from './CatalogTransferDialog';
import { ApiError, apiClient } from '@/lib/api';

function csvFile() {
  return new File(['nombre,categoria,precio\nGlucosa,Laboratorio,15.00'], 'catalogo.csv', { type: 'text/csv' });
}

function renderDialog() {
  const onImported = vi.fn();
  const onStatus = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <CatalogTransferDialog
      open
      onOpenChange={onOpenChange}
      onImported={onImported}
      onStatus={onStatus}
    />,
  );

  return { onImported, onStatus, onOpenChange };
}

describe('CatalogTransferDialog', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:catalogo'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('previsualiza sin escribir y muestra válidas y errores por línea', async () => {
    const importServices = vi.spyOn(apiClient, 'importServices').mockResolvedValue({
      valid: 3,
      applied: 0,
      errors: [{ line: 4, message: 'Precio inválido' }],
    });
    renderDialog();

    const file = csvFile();
    fireEvent.change(await screen.findByLabelText(/archivo csv o xlsx/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));

    await waitFor(() => expect(importServices).toHaveBeenCalledWith(file, 'preview'));
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText(/línea 4: precio inválido/i)).toBeInTheDocument();
    expect(screen.getByText(/vista previa: no se escribió nada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar importación \(3 válidas\)/i })).toBeEnabled();
  });

  it('aplica el archivo ya previsualizado y confirma el resultado del servidor', async () => {
    const importServices = vi.spyOn(apiClient, 'importServices')
      .mockResolvedValueOnce({ valid: 2, applied: 0, errors: [] })
      .mockResolvedValueOnce({ valid: 2, applied: 2, errors: [] });
    const { onImported } = renderDialog();

    const file = csvFile();
    fireEvent.change(await screen.findByLabelText(/archivo csv o xlsx/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));
    await screen.findByText(/vista previa: no se escribió nada/i);

    fireEvent.click(screen.getByRole('button', { name: /aplicar importación \(2 válidas\)/i }));

    await waitFor(() => expect(importServices).toHaveBeenLastCalledWith(file, 'apply'));
    const resultRegion = await screen.findByRole('region', { name: /resultado de la importación/i });
    expect(within(resultRegion).getAllByText('2')).toHaveLength(2);
    expect(onImported).toHaveBeenCalledWith({ valid: 2, applied: 2, errors: [] });
  });

  it('conserva el archivo y permite reintentar cuando el servidor falla', async () => {
    const importServices = vi.spyOn(apiClient, 'importServices')
      .mockRejectedValueOnce(new ApiError('No se pudo leer el archivo.', 422))
      .mockResolvedValueOnce({ valid: 1, applied: 0, errors: [] });
    renderDialog();

    const file = csvFile();
    fireEvent.change(await screen.findByLabelText(/archivo csv o xlsx/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));

    expect(await screen.findByText(/no se pudo leer el archivo\./i)).toBeInTheDocument();
    expect(screen.getByText(/archivo seleccionado: catalogo\.csv/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));
    await waitFor(() => expect(importServices).toHaveBeenCalledTimes(2));
  });

  it('no permite aplicar antes de la vista previa', async () => {
    renderDialog();

    const apply = screen.getByRole('button', { name: /aplicar importación/i });
    expect(apply).toBeDisabled();
  });

  it('exporta CSV y XLSX como descarga', async () => {
    const exportServices = vi.spyOn(apiClient, 'exportServices')
      .mockResolvedValue(new Blob(['a,b'], { type: 'text/csv' }));
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /exportar csv/i }));
    await waitFor(() => expect(exportServices).toHaveBeenCalledWith('csv'));
    expect(URL.createObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));
    await waitFor(() => expect(exportServices).toHaveBeenCalledWith('xlsx'));
  });

  it('informa si la exportación falla sin cerrar el diálogo', async () => {
    vi.spyOn(apiClient, 'exportServices').mockRejectedValue(new ApiError('No disponible', 500));
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /exportar csv/i }));

    expect(await screen.findByText(/no se completó la operación/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /importar o exportar catálogo/i })).toBeInTheDocument();
  });
});
