import { useState } from 'react';

type CalendarItem = { id: string; name: string; date: string; amount: number; kind: string; direction: 'income' | 'expense' };

export default function MoneyCalendar({ items, language }: { items: CalendarItem[]; language: 'en' | 'es' }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
  const locale = language === 'es' ? 'es-EC' : 'en-US';
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const weekdays = language === 'es' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return <div className="money-calendar-grid"><div className="calendar-controls"><button type="button" aria-label={language === 'es' ? 'Mes anterior' : 'Previous month'} onClick={() => setOffset((value) => value - 1)}>←</button><strong>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label={language === 'es' ? 'Mes siguiente' : 'Next month'} onClick={() => setOffset((value) => value + 1)}>→</button></div><div className="calendar-weekdays">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-days">{days.map((day) => { const dateKey = key(day); const events = items.filter((item) => item.date === dateKey); return <div className={`${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${dateKey === key(now) ? 'today' : ''}`} key={dateKey}><time>{day.getDate()}</time><span>{events.slice(0, 3).map((event) => <i className={event.direction} title={`${event.name} · $${event.amount.toFixed(2)}`} key={event.id} />)}</span></div>; })}</div><div className="calendar-legend"><span><i className="income" />{language === 'es' ? 'Ingreso' : 'Income'}</span><span><i className="expense" />{language === 'es' ? 'Compromiso' : 'Commitment'}</span></div></div>;
}
