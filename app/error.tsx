'use client';

import { useEffect } from 'react';
import Link from 'next/link';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Doryc page failure', { message: error.message, digest: error.digest }); }, [error]);
  return <main className="standalone-auth"><section><p className="eyebrow">DORYC RECOVERY</p><h1>Algo salió mal</h1><p>Tu información no fue modificada. Puedes intentar cargar esta pantalla nuevamente.</p><button className="save-button" onClick={reset}>Intentar de nuevo</button><Link href="/">Volver al inicio</Link></section></main>;
}
