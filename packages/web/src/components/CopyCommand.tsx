'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 font-mono text-xs text-muted-foreground ring-1 ring-border">
      <code className="min-w-0 flex-1 truncate text-foreground">{command}</code>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0 text-muted-foreground hover:bg-card hover:text-foreground"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy command'}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
