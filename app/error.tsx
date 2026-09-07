'use client';

import { useEffect } from 'react';
import Link from 'next/link';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Doryc page failure', { message: error.message, digest: error.digest }); }, [error]);
  return <main className="recovery-page"><section className="recovery-card"><span className="recovery-icon">↻</span><div><p className="eyebrow">DORYC RECOVERY</p><h1>Algo salió mal</h1><p>Tu información está segura y no fue modificada. Intenta cargar nuevamente o vuelve al inicio.</p></div><div className="recovery-actions"><button className="save-button" onClick={reset}>Intentar de nuevo</button><Link href="/">Volver al inicio</Link></div></section></main>;
}
