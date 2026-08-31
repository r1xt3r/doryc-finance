import type { Metadata, Viewport } from 'next';
import './globals.css';
import ExperienceBootstrap from './components/ExperienceBootstrap';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Doryc — Personal Finance',
  description: 'An animated personal finance dashboard for calm, intentional money management.',
  applicationName: 'Doryc Finance',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Doryc' },
  openGraph: {
    title: 'Doryc — Personal Finance',
    description: 'Personal finance, in motion.',
    url: '/',
    siteName: 'Doryc Finance',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Doryc personal finance dashboard' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doryc — Personal Finance',
    description: 'Personal finance, in motion.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { themeColor: '#111511', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><ExperienceBootstrap/>{children}</body></html>;
}
