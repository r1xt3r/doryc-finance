'use client';

import LogoMark from './LogoMark';
import Link from 'next/link';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../../lib/useLanguage';

export default function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  const { language, setLanguage } = useLanguage(); const es = language === 'es'; const privacy = type === 'privacy';
  const sections = privacy ? (es ? [
    ['Información que tratamos', 'Doryc almacena los datos que ingresas sobre cuentas, movimientos, pagos, tarjetas y préstamos, además del correo y nombre asociados a tu cuenta.'],
    ['Cómo la utilizamos', 'La información se utiliza únicamente para ofrecer cálculos, pronósticos, recordatorios y visualizaciones dentro de tu cuenta. No vendemos datos personales ni financieros.'],
    ['Almacenamiento y seguridad', 'Los datos se almacenan en Supabase y están protegidos mediante autenticación y políticas de acceso por usuario. Ningún sistema puede garantizar seguridad absoluta; usa una contraseña única y protege tu sesión.'],
    ['Tus controles', 'Puedes descargar una copia de tu información o eliminar permanentemente tu cuenta desde Cuenta y datos. La eliminación también borra los registros financieros asociados.'],
    ['Retención y cambios', 'Conservamos la información mientras tu cuenta permanezca activa. Esta política puede actualizarse cuando cambie el servicio; la fecha de la versión aparecerá en esta página.'],
  ] : [
    ['Information we process', 'Doryc stores the account, movement, payment, card and loan information you enter, together with the email and name associated with your account.'],
    ['How we use it', 'Information is used only to provide calculations, forecasts, reminders and visualizations inside your account. We do not sell personal or financial data.'],
    ['Storage and security', 'Data is stored in Supabase and protected by authentication and per-user access policies. No system guarantees absolute security; use a unique password and protect your session.'],
    ['Your controls', 'You can download a copy of your information or permanently delete your account under Account & data. Deletion also removes associated financial records.'],
    ['Retention and changes', 'We retain information while your account remains active. This policy may change as the service evolves; the version date will appear on this page.'],
  ]) : (es ? [
    ['Finalidad del servicio', 'Doryc es una herramienta de organización financiera personal. No es un banco, asesor financiero, contador ni proveedor de crédito.'],
    ['Estimaciones', 'Saldos proyectados, cuotas, intereses, alertas y fechas son estimaciones basadas en los datos que ingresas. Los estados de cuenta y contratos de tus instituciones son la fuente definitiva.'],
    ['Responsabilidad del usuario', 'Debes registrar información correcta, proteger tus credenciales y verificar cualquier decisión financiera importante con la institución correspondiente.'],
    ['Disponibilidad', 'Trabajamos para mantener Doryc disponible y confiable, pero pueden existir interrupciones, mantenimiento o errores. Conserva tus documentos financieros oficiales fuera de Doryc.'],
    ['Uso aceptable', 'No debes intentar acceder a cuentas ajenas, vulnerar el servicio ni utilizarlo para actividades ilegales. Podemos restringir accesos que pongan en riesgo a otros usuarios.'],
  ] : [
    ['Purpose of the service', 'Doryc is a personal finance organization tool. It is not a bank, financial adviser, accountant or credit provider.'],
    ['Estimates', 'Projected balances, installments, interest, alerts and dates are estimates based on the information you enter. Statements and contracts from your institutions remain the final source.'],
    ['User responsibility', 'You must enter accurate information, protect your credentials and verify important financial decisions with the relevant institution.'],
    ['Availability', 'We work to keep Doryc available and reliable, but interruptions, maintenance or errors may occur. Keep official financial documents outside Doryc.'],
    ['Acceptable use', 'You must not access other accounts, compromise the service or use it for illegal activity. We may restrict access that puts other users at risk.'],
  ]);
  return <main className="legal-page"><header><Link href="/"><LogoMark/></Link><LanguageSelector language={language} onChange={setLanguage}/></header><article><p className="eyebrow">DORYC · {es ? 'ÚLTIMA ACTUALIZACIÓN: 31 AGOSTO 2026' : 'LAST UPDATED: AUGUST 31, 2026'}</p><h1>{privacy ? (es ? 'Política de privacidad' : 'Privacy Policy') : (es ? 'Términos de uso' : 'Terms of Use')}</h1><p className="legal-intro">{privacy ? (es ? 'Privacidad clara para una herramienta que maneja información importante.' : 'Clear privacy for a tool that handles important information.') : (es ? 'Reglas simples para usar Doryc de forma segura y responsable.' : 'Simple rules for using Doryc safely and responsibly.')}</p>{sections.map(([title, detail]) => <section key={title}><h2>{title}</h2><p>{detail}</p></section>)}<aside>{es ? 'Antes del lanzamiento público se añadirá el canal oficial de contacto y la jurisdicción de la entidad operadora.' : 'The official contact channel and operating entity jurisdiction will be added before public launch.'}</aside></article><footer><Link href="/">Doryc</Link><Link href="/privacy">{es ? 'Privacidad' : 'Privacy'}</Link><Link href="/terms">{es ? 'Términos' : 'Terms'}</Link></footer></main>;
}
