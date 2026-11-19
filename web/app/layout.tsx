import type { Metadata } from 'next';
import { AsgardeoProvider } from '@asgardeo/nextjs/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'HealthBridge LK',
  description: 'One PHN, one health record across hospitals',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AsgardeoProvider>{children}</AsgardeoProvider>
        
      </body>
    </html>
  );
}