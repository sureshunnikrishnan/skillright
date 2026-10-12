import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { SoftPanel, SoftShell } from '@/components/SoftShell';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <SoftShell>
      <PageHeader title="Not found" description="That skill, tag, or page is not in the local catalog.">
        <Button asChild className="rounded-full">
          <Link href="/">
            <LayoutDashboard />
            Back to dashboard
          </Link>
        </Button>
      </PageHeader>
      <SoftPanel tone="sky">
        <p className="text-sm text-muted-foreground">
          Try the dashboard, browse skills, or open the tag catalog to continue exploring your registry.
        </p>
      </SoftPanel>
    </SoftShell>
  );
}
