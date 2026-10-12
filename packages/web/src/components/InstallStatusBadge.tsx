import type { SkillInstallStatus } from '@skillright/backend';
import { Check, CircleDashed, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS: Record<
  SkillInstallStatus,
  { label: string; className: string; icon: typeof Check }
> = {
  installed: {
    label: 'Installed',
    className: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    icon: Check,
  },
  modified: {
    label: 'Modified',
    className: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    icon: RefreshCw,
  },
  missing: {
    label: 'Not installed',
    className: 'bg-slate-100 text-slate-600 ring-slate-200/80',
    icon: CircleDashed,
  },
};

export function InstallStatusBadge({
  status,
  className,
}: {
  status: SkillInstallStatus;
  className?: string;
}) {
  const meta = STATUS[status];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 border-0 ring-1', meta.className, className)}
      title={
        status === 'modified'
          ? 'A local copy exists but its SKILL.md differs from the catalog'
          : undefined
      }
    >
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}
