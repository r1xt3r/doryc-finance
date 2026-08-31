import type { Metadata, Viewport } from 'next';
import './globals.css';
import ExperienceBootstrap from './components/ExperienceBootstrap';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Doryc — Personal Finance',
  description: 'Organiza tus cuentas, pagos, ahorros y deudas con claridad.',
  applicationName: 'Doryc Finance',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/doryc-icon-192.png', sizes: '192x192', type: 'image/png' }], shortcut: '/icon.svg', apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] },
  appleWebApp: { capable: true, title: 'Doryc', statusBarStyle: 'black-translucent' },
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
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><ExperienceBootstrap/>{children}</body></html>;
}
