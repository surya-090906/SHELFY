import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shelfy — Multi-Tenant Inventory Management System',
  description: 'Next-generation cloud inventory and warehouse logistics management system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full bg-slate-50 antialiased">
        <body className="min-h-full flex flex-col font-sans text-slate-900 bg-slate-50">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
