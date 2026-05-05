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
      <body className="storefront-body text-foreground antialiased">
        <QueryProvider>
          <div className="storefront-bg" aria-hidden />
          <div className="storefront-overlay" aria-hidden />
          <main className="storefront-shell">
            <div className="storefront-content">
              <HeaderNav />
              {children}
            </div>
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
