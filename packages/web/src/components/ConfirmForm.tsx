'use client';

import { SubmitButton } from './SubmitButton';

export function ConfirmForm({
  action,
  message,
  children,
  hidden,
  variant = 'destructive',
  pendingLabel,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  message: string;
  children: React.ReactNode;
  hidden?: Record<string, string> | undefined;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link' | undefined;
  pendingLabel?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <SubmitButton
        variant={variant}
        pendingLabel={pendingLabel}
        {...(className ? { className } : {})}
      >
        {children}
      </SubmitButton>
    </form>
  );
}
