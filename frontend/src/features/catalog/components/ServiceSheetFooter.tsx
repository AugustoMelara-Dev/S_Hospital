import { Button } from '../../../components/ui/button';
import type { ServiceSheetFooterProps } from './catalogTypes';

export function ServiceSheetFooter({
  cancelLabel,
  isEditing,
  isSubmitting,
  onCancel,
}: ServiceSheetFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting || undefined}
      >
        {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
      </Button>
    </div>
  );
}
