import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Doryc Personal Finance',
    short_name: 'Doryc',
    description: 'Organiza tus cuentas, pagos, ahorros y deudas en un solo lugar.',
    id: '/',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b0e0c',
    theme_color: '#111511',
    categories: ['finance', 'productivity'],
    lang: 'es',
    icons: [
      { src: '/doryc-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/doryc-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/doryc-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
