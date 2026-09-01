const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

export function emailLayout(title: string, intro: string, content: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://doryc-finance.vercel.app';
  return `<!doctype html><html><body style="margin:0;background:#0b0e0c;font-family:Arial,sans-serif;color:#f7f8f5"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:34px 15px;background:#0b0e0c"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #2b352b;border-radius:22px;background:#111612;overflow:hidden"><tr><td style="padding:28px 32px 12px"><span style="display:inline-block;padding:8px 11px;border-radius:10px;background:#bdf477;color:#111612;font-weight:900">D</span><strong style="margin-left:10px">doryc</strong></td></tr><tr><td style="padding:14px 32px 30px"><h1 style="margin:0 0 12px;font-size:27px">${escapeHtml(title)}</h1><p style="margin:0 0 22px;color:#aeb6ac;line-height:1.6">${escapeHtml(intro)}</p>${content}<a href="${appUrl}" style="display:block;margin-top:24px;padding:13px;border-radius:11px;background:#bdf477;color:#101510;text-align:center;text-decoration:none;font-weight:800">Abrir Doryc</a></td></tr><tr><td style="padding:18px 32px;background:#0e120f;color:#717a70;font-size:11px">Administra o cancela estos correos en <a href="${appUrl}/settings" style="color:#9f8ee7">Configuración de notificaciones</a>.</td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, idempotencyKey: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Doryc <notifications@doryc.com>', to: [to], subject, html }),
  });
  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok || !result.id) throw new Error(result.message || 'Email provider rejected the message.');
  return result.id;
}

export { escapeHtml };
