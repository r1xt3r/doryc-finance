import type { ConfirmRequest } from '../../lib/useConfirmDialog';

export default function ConfirmDialog({ request, language, onAnswer }: { request: ConfirmRequest | null; language: 'en' | 'es'; onAnswer: (answer: boolean) => void }) {
  if (!request) return null;
  return <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={() => onAnswer(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-detail" onMouseDown={(event) => event.stopPropagation()}><span className={request.tone === 'neutral' ? 'neutral' : ''}>!</span><h2 id="confirm-title">{request.title}</h2><p id="confirm-detail">{request.detail}</p><div><button type="button" onClick={() => onAnswer(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button><button className={request.tone === 'neutral' ? 'neutral' : 'danger'} type="button" onClick={() => onAnswer(true)}>{request.confirmLabel || (language === 'es' ? 'Eliminar' : 'Delete')}</button></div></section></div>;
}
