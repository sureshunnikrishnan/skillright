'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function ProjectFlash() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const notice = searchParams.get('projectNotice');
  const error = searchParams.get('projectError');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!notice && !error) return;
    setMessage({ text: error || notice || '', error: Boolean(error) });

    const params = new URLSearchParams(searchParams.toString());
    params.delete('projectNotice');
    params.delete('projectError');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [notice, error, pathname, router, searchParams]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <p
      className={cn(
        'max-w-xs truncate text-[0.65rem] sm:max-w-sm',
        message.error ? 'text-destructive' : 'text-emerald-700',
      )}
      title={message.text}
    >
      {message.text}
    </p>
  );
}
