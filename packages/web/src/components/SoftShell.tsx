import { cn } from '@/lib/utils';

export function SoftShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[2rem] bg-card p-5 shadow-sm ring-1 ring-black/5 sm:p-7',
        className,
      )}
    >
      {children}
    </div>
  );
}

const PANEL_TONES = {
  muted: 'bg-[#f3f4f6]',
  lavender: 'bg-gradient-to-br from-[#ebe4ff] via-[#f3e8ff] to-[#e8f1ff]',
  mist: 'bg-[#f8f7fc] ring-1 ring-black/5',
  sky: 'bg-gradient-to-r from-[#e0f2fe] via-[#ede9fe] to-[#f3e8ff]',
  card: 'bg-card ring-1 ring-border',
} as const;

export function SoftPanel({
  children,
  className,
  tone = 'muted',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: keyof typeof PANEL_TONES;
}) {
  return (
    <div className={cn('rounded-[1.75rem] p-5 sm:p-6', PANEL_TONES[tone], className)}>{children}</div>
  );
}

export function SoftEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] bg-muted/60 px-5 py-8 text-sm text-muted-foreground">{children}</div>
  );
}
