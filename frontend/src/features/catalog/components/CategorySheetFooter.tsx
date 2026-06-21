import { Button } from '../../../components/ui/button';
import type { CategorySheetFooterProps } from './catalogTypes';

export function CategorySheetFooter({
  cancelLabel,
  isEditing,
  isSubmitting,
  onCancel,
}: CategorySheetFooterProps) {
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
