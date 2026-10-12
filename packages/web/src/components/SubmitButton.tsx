'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'default',
  size = 'default',
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string | undefined;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link' | undefined;
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg' | undefined;
  className?: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          {pendingLabel ?? 'Working…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
