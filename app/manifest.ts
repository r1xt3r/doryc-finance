import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Doryc Personal Finance',
    short_name: 'Doryc',
    description: 'An animated personal finance dashboard.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0e0c',
    theme_color: '#111511',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
