import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { QueryProvider } from '@/src/shared/providers';
import { HeaderNav } from '@/src/widgets/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enot Tea Storefront',
  description: 'Public storefront MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <main className="stack">
            <HeaderNav />
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
