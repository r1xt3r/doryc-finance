import type { Language } from '../../lib/useLanguage';

export default function LanguageSelector({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <div className="language-selector" role="group" aria-label={language === 'es' ? 'Cambiar idioma' : 'Change language'}>
    <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onChange('en')} aria-pressed={language === 'en'}>EN</button>
    <button type="button" className={language === 'es' ? 'active' : ''} onClick={() => onChange('es')} aria-pressed={language === 'es'}>ES</button>
  </div>;
}
