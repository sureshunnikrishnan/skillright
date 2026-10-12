import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppSidebar } from '@/components/AppSidebar';
import { AppTopbar } from '@/components/AppTopbar';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Skillright',
    template: '%s · Skillright',
  },
  description: 'Dashboard and management UI for the local Skillright skills catalog.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable)}>
      <body className="min-h-screen bg-card font-sans text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <AppTopbar />
          <div className="flex min-h-0 flex-1">
            <AppSidebar />
            <main className="min-w-0 flex-1 overflow-auto bg-card px-6 py-6 lg:px-8 xl:px-10">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
