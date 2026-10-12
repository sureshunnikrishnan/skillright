import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
