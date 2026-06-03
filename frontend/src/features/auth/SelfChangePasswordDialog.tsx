import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiClient, userSafeErrorMessage } from '../../lib/api';
import { t } from '../../lib/i18n';

const PASSWORD_POLICY_ERROR = t('selfChangePassword.errorPolicy');
const PASSWORD_POLICY_HINT = t('selfChangePassword.policyHint');

const passwordSchema = z
  .string()
  .min(10, PASSWORD_POLICY_ERROR)
  .refine((value) => /\p{L}/u.test(value), { message: PASSWORD_POLICY_ERROR })
  .refine((value) => /\p{N}/u.test(value), { message: PASSWORD_POLICY_ERROR });

const selfChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, t('selfChangePassword.errorCurrent')),
    password: passwordSchema,
    password_confirmation: z.string().min(1, t('selfChangePassword.errorMismatch')),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: t('selfChangePassword.errorMismatch'),
    path: ['password_confirmation'],
  });

export type SelfChangePasswordFormValues = z.infer<typeof selfChangePasswordSchema>;

type SelfChangePasswordDialogProps = {
  onStatus: (message: string) => void;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  open: boolean;
};

export function SelfChangePasswordDialog({
  onStatus,
  onOpenChange,
  onSuccess,
  open,
}: SelfChangePasswordDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SelfChangePasswordFormValues>({
    defaultValues: {
      current_password: '',
      password: '',
      password_confirmation: '',
    },
    resolver: zodResolver(selfChangePasswordSchema),
    mode: 'onSubmit',
  });

  function handleOpenChange(next: boolean) {
    if (submitting) {
      return;
    }

    if (!next) {
      form.reset();
      setServerError(null);
    }

    onOpenChange(next);
  }

  async function onSubmit(values: SelfChangePasswordFormValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      await apiClient.changePassword({
        current_password: values.current_password,
        password: values.password,
        password_confirmation: values.password_confirmation,
      });
      form.reset();
      onStatus(t('selfChangePassword.success'));
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setServerError(userSafeErrorMessage(error, t('selfChangePassword.errorGeneric')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('selfChangePassword.dialogTitle')}
      description={t('selfChangePassword.dialogDescription')}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        {serverError ? (
          <Alert variant="destructive" title={t('selfChangePassword.errorGeneric')}>
            {serverError}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="self-change-current">{t('selfChangePassword.currentLabel')}</Label>
          <Input
            id="self-change-current"
            type="password"
            autoComplete="current-password"
            disabled={submitting}
            aria-invalid={Boolean(form.formState.errors.current_password)}
            {...form.register('current_password')}
          />
          {form.formState.errors.current_password ? (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.current_password.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="self-change-new">{t('selfChangePassword.newLabel')}</Label>
          <Input
            id="self-change-new"
            type="password"
            autoComplete="new-password"
            disabled={submitting}
            placeholder={PASSWORD_POLICY_HINT}
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.password.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="self-change-confirm">{t('selfChangePassword.confirmLabel')}</Label>
          <Input
            id="self-change-confirm"
            type="password"
            autoComplete="new-password"
            disabled={submitting}
            aria-invalid={Boolean(form.formState.errors.password_confirmation)}
            {...form.register('password_confirmation')}
          />
          {form.formState.errors.password_confirmation ? (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.password_confirmation.message}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {t('selfChangePassword.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('selfChangePassword.submitting') : t('selfChangePassword.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
