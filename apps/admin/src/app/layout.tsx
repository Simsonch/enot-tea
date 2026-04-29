import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { QueryProvider } from '@/src/shared/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enot Tea Admin',
  description: 'Owner admin MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
