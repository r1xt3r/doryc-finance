'use client';

import { FormEvent, useEffect, useState } from 'react';

type Category = { id: string; name: string; icon: string; color: string };
type Rule = { id: string; match_text: string; category: string };
const coreCategories = ['Food', 'Transportation', 'Shopping', 'Personal', 'Entertainment', 'Home', 'Health', 'Insurance', 'Other'];

export default function CategorySettings({ language, request }: { language: 'en' | 'es'; request: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { request('/api/planning').then((response) => response.json()).then((result) => { setCategories(result.categories || []); setRules(result.rules || []); setUnavailable(Boolean(result.unavailable)); }).catch(() => setUnavailable(true)); }, [request]);
  async function save(event: FormEvent<HTMLFormElement>, entity: 'category' | 'rule') {
    event.preventDefault(); setBusy(true);
    try { const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await request('/api/planning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity, ...body }) }); if (response.ok) { const result = await response.json(); setCategories(result.categories || []); setRules(result.rules || []); event.currentTarget.reset(); } } finally { setBusy(false); }
  }
  const options = [...new Set([...coreCategories, ...categories.map((item) => item.name)])];
  return <section className="settings-card category-settings-card"><p className="eyebrow">{tr('ORGANIZATION', 'ORGANIZACIÓN')}</p><h2>{tr('Categories and automatic rules', 'Categorías y reglas automáticas')}</h2><p>{tr('Personalize how movements are organized. Rules categorize matching descriptions automatically.', 'Personaliza cómo se organizan tus movimientos. Las reglas categorizan automáticamente las descripciones coincidentes.')}</p>{unavailable && <div className="planner-notice">{tr('The database update still needs to be applied.', 'Aún falta aplicar la actualización de base de datos.')}</div>}<div className="settings-category-columns"><form className="planner-form compact" onSubmit={(event) => save(event, 'category')}><strong>{tr('Create category', 'Crear categoría')}</strong><label><span>{tr('Name', 'Nombre')}</span><input name="name" required placeholder={tr('Pets', 'Mascotas')}/></label><label><span>{tr('Icon', 'Icono')}</span><input name="icon" maxLength={2} placeholder="✦"/></label><label><span>{tr('Color', 'Color')}</span><input name="color" type="color" defaultValue="#b49cff"/></label><button disabled={busy}>{tr('Add category', 'Agregar categoría')}</button></form><form className="planner-form compact" onSubmit={(event) => save(event, 'rule')}><strong>{tr('Create automatic rule', 'Crear regla automática')}</strong><label><span>{tr('Description contains', 'La descripción contiene')}</span><input name="matchText" required placeholder="Uber"/></label><label><span>{tr('Assign category', 'Asignar categoría')}</span><select name="category">{options.map((category) => <option key={category}>{category}</option>)}</select></label><button disabled={busy}>{tr('Save rule', 'Guardar regla')}</button></form></div><div className="category-chips">{categories.map((item) => <span key={item.id} style={{ borderColor: item.color }}><i>{item.icon}</i>{item.name}</span>)}{rules.map((item) => <span key={item.id}><i>→</i>“{item.match_text}” → {item.category}</span>)}</div></section>;
}
