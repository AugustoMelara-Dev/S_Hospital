import { type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldGroup, FormSection } from '@/components/ui/form-section';
import { cn } from '@/lib/utils';
import { type ServiceFormData } from './serviceSheetTypes';

type ServiceSheetScannerSectionProps = {
  errors: FieldErrors<ServiceFormData>;
  isSubmitting: boolean;
  register: UseFormRegister<ServiceFormData>;
};

export function ServiceSheetScannerSection({
  errors,
  isSubmitting,
  register,
}: ServiceSheetScannerSectionProps) {
  return (
    <FormSection
      title="Códigos de escaneo"
      description="Identificadores opcionales que se utilizan al escanear productos en caja."
    >
      <FieldGroup columns={3}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scan_code">Código de escáner</Label>
          <Input
            id="scan_code"
            placeholder="LAB-GLU-001"
            disabled={isSubmitting}
            {...register('scan_code')}
            aria-invalid={Boolean(errors.scan_code)}
            aria-describedby={errors.scan_code ? 'service-scan-code-error' : undefined}
            className={cn(errors.scan_code && 'border-destructive')}
          />
          {errors.scan_code && (
            <p id="service-scan-code-error" role="alert" className="text-sm text-destructive">
              {errors.scan_code.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="barcode">Código de barra</Label>
          <Input
            id="barcode"
            disabled={isSubmitting}
            placeholder="Código de barra opcional"
            {...register('barcode')}
            aria-invalid={Boolean(errors.barcode)}
            aria-describedby={errors.barcode ? 'service-barcode-error' : undefined}
            className={cn(errors.barcode && 'border-destructive')}
          />
          {errors.barcode && (
            <p id="service-barcode-error" role="alert" className="text-sm text-destructive">
              {errors.barcode.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="qr_code">Código QR</Label>
          <Input
            id="qr_code"
            disabled={isSubmitting}
            placeholder="Código QR opcional"
            {...register('qr_code')}
            aria-invalid={Boolean(errors.qr_code)}
            aria-describedby={errors.qr_code ? 'service-qr-code-error' : undefined}
            className={cn(errors.qr_code && 'border-destructive')}
          />
          {errors.qr_code && (
            <p id="service-qr-code-error" role="alert" className="text-sm text-destructive">
              {errors.qr_code.message}
            </p>
          )}
        </div>
      </FieldGroup>
    </FormSection>
  );
}
