import { Checkbox } from '../../../components/ui/checkbox';
import { FormField } from '../../../components/ui/form-field';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { FieldGroup, FormSection } from '../../../components/ui/form-section';
import type { CategoryFormSectionProps } from './catalogTypes';

export function CategoryFormSection({
  activeValue,
  errorMessage,
  isEditing,
  onActiveChange,
}: CategoryFormSectionProps) {
  return (
    <FormSection
      title="Datos de la categoría"
      description={
        isEditing
          ? 'Modifique el nombre o el orden de la categoría seleccionada.'
          : 'Cree una nueva categoría para organizar los servicios del catálogo.'
      }
    >
      <FieldGroup columns={2}>
        <FormField
          id="name"
          label="Nombre"
          required
          error={errorMessage}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="name"
              autoComplete="off"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <FormField
          id="sort_order"
          label="Orden"
          hint="Número entero no negativo que define el orden mostrado."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="sort_order"
              type="number"
              min={0}
              step={1}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Checkbox
          id="active"
          name="active"
          checked={activeValue}
          onCheckedChange={(value) => onActiveChange(value === true)}
          aria-label="Categoría activa"
        />
        <Label htmlFor="active" className="cursor-pointer text-sm font-medium">
          Categoría activa
        </Label>
      </div>
    </FormSection>
  );
}
