import { CircleAlert, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function Flash({
  notice,
  error,
}: {
  notice?: string | undefined;
  error?: string | undefined;
}) {
  if (!notice && !error) return null;
  if (error) {
    return (
      <Alert variant="destructive" className="mb-6 rounded-2xl">
        <CircleAlert />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="mb-6 rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-900">
      <CircleCheck className="text-emerald-600" />
      <AlertTitle>Done</AlertTitle>
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  );
}
