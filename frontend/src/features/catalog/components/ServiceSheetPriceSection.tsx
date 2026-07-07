import { type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSection } from '@/components/ui/form-section';
import { cn } from '@/lib/utils';
import { type ServiceFormData } from './serviceSheetTypes';

type ServiceSheetPriceSectionProps = {
  errors: FieldErrors<ServiceFormData>;
  isSubmitting: boolean;
  locksErythropoietinRule: boolean;
  register: UseFormRegister<ServiceFormData>;
  requiresPriceChangeReason: boolean;
};

export function ServiceSheetPriceSection({
  errors,
  isSubmitting,
  locksErythropoietinRule,
  register,
  requiresPriceChangeReason,
}: ServiceSheetPriceSectionProps) {
  return (
    <FormSection
      title="Precio"
      description="Precio vigente y motivo del cambio. El cambio de precio siempre queda auditado."
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="price">Precio (L.) *</Label>
        <Input
          id="price"
          type="text"
          inputMode="decimal"
          disabled={isSubmitting || locksErythropoietinRule}
          {...register('price')}
          aria-invalid={Boolean(errors.price)}
          aria-describedby={errors.price ? 'service-price-error' : undefined}
          className={cn(errors.price && 'border-destructive')}
        />
        {errors.price && (
          <p id="service-price-error" role="alert" className="text-sm text-destructive">
            {errors.price.message}
          </p>
        )}
      </div>

      {requiresPriceChangeReason && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="price_change_reason">Motivo del cambio de precio *</Label>
          <Input
            id="price_change_reason"
            disabled={isSubmitting}
            {...register('price_change_reason')}
            aria-invalid={Boolean(errors.price_change_reason)}
            aria-describedby={errors.price_change_reason ? 'service-price-reason-error' : undefined}
            className={cn(errors.price_change_reason && 'border-destructive')}
          />
          {errors.price_change_reason && (
            <p id="service-price-reason-error" role="alert" className="text-sm text-destructive">
              {errors.price_change_reason.message}
            </p>
          )}
        </div>
      )}
    </FormSection>
  );
}
