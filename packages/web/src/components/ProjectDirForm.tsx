'use client';

import { X } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { clearProjectAction, setProjectAction } from '@/lib/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function useReturnTo(fallback = '/project'): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.delete('projectNotice');
  params.delete('projectError');
  params.delete('notice');
  params.delete('error');
  const query = params.toString();
  const current = query ? `${pathname}?${query}` : pathname;
  return current || fallback;
}

export function ClearProjectButton() {
  const returnTo = useReturnTo();
  return (
    <form action={clearProjectAction} className="shrink-0">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-xs"
        className="rounded-full text-muted-foreground hover:text-foreground"
        title="Clear project"
        aria-label="Clear project directory"
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );
}

export function ProjectDirForm({
  projectDir,
  variant = 'compact',
  returnTo: returnToProp,
}: {
  projectDir: string | null;
  variant?: 'compact' | 'panel';
  returnTo?: string;
}) {
  const returnToFromRoute = useReturnTo();
  const returnTo = returnToProp ?? returnToFromRoute;
  const panel = variant === 'panel';

  return (
    <form
      action={setProjectAction}
      className={cn(
        panel
          ? 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'
          : 'flex min-w-0 max-w-md flex-1 items-center gap-1.5 sm:max-w-xs',
      )}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className={cn(panel && 'grid gap-1.5')}>
        {panel ? <Label htmlFor="projectDir">Project folder path</Label> : null}
        <Input
          key={projectDir ?? 'unset'}
          id={panel ? 'projectDir' : undefined}
          name="projectDir"
          required
          defaultValue={projectDir ?? ''}
          placeholder="/path/to/project"
          className={cn(
            'rounded-full',
            panel ? 'h-11 bg-white/80' : 'h-8 bg-muted/40 text-xs',
          )}
          aria-label="Project directory path"
          autoComplete="off"
        />
      </div>
      <SubmitButton
        size={panel ? 'default' : 'sm'}
        pendingLabel="Saving…"
        className="shrink-0 rounded-full"
      >
        {projectDir ? 'Change project' : 'Set project'}
      </SubmitButton>
    </form>
  );
}
