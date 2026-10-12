'use client';

import { BookOpen, FolderKanban, GitBranch, LayoutDashboard, Tags, Terminal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/project', label: 'Current Project', icon: FolderKanban },
  { href: '/skills', label: 'Skill Registry', icon: BookOpen },
  { href: '/repos', label: 'Repositories', icon: GitBranch },
  { href: '/tags', label: 'Tag Catalog', icon: Tags },
  { href: '/cli', label: 'CLI Guide', icon: Terminal },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-16 flex h-[calc(100vh-4rem)] w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-3 text-sidebar-foreground">
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
        {links.map((link) => {
          const current =
            link.href === '/'
              ? pathname === '/'
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                current
                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                  : 'font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0 stroke-[1.75] opacity-80" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <p className="px-3 pb-2 text-[0.65rem] text-muted-foreground/80">version: 1.0.0</p>
    </aside>
  );
}
