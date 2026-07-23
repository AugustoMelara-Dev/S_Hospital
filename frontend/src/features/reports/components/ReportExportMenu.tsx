import { ChevronDownIcon, FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ReportExportMenuProps = {
  disabled?: boolean;
  exporting?: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
};

export function ReportExportMenu({
  disabled = false,
  exporting = false,
  onExportPdf,
  onExportExcel,
}: ReportExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || exporting}>
          {exporting ? 'Exportando…' : 'Exportar'}
          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportPdf}>
          <FileTextIcon aria-hidden="true" />
          Documento PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportExcel}>
          <FileSpreadsheetIcon aria-hidden="true" />
          Libro de Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
