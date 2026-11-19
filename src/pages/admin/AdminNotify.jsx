import { useState } from 'react';
import { addDoc, collection, doc, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol } from '../../lib/hooks';
import { Avatar, Badge, Choice, Empty, Field, Icon, useToast } from '../../components/ui';
import { fmtDateTime, fullName } from '../../lib/utils';

const TEMPLATES = [
  ['💧 Hidratación', 'Recuerda tomar tu agua hoy. ¡Tu cuerpo te lo agradecerá!'],
  ['📏 Registro semanal', 'Es día de registrar tu peso y medidas en la sección Progreso.'],
  ['📅 Agenda tu cita', 'Ya es momento de tu seguimiento. Reserva tu cita desde la app.'],
  ['💪 Motivación', 'La constancia vence al talento. ¡Sigue así, vas muy bien!'],
];

export default function AdminNotify() {
  const toast = useToast();
  const members = useCol('members', null, 'members-notify').list.filter((m) => m.active !== false);
  const history = useCol('broadcasts', () => [orderBy('createdAt', 'desc')], 'broadcasts').list;
  const [to, setTo] = useState('todos');
  const [sel, setSel] = useState([]);
  const [f, setF] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    const targets = to === 'todos' ? members.map((m) => m.id) : sel;
    if (!f.title.trim() || !f.body.trim()) return toast('Escribe título y mensaje', 'err');
    if (!targets.length) return toast('Selecciona al menos un miembro', 'err');
    setBusy(true);
    try {
      for (let i = 0; i < targets.length; i += 400) {
        const b = writeBatch(db);
        targets.slice(i, i + 400).forEach((id) => b.set(doc(collection(db, 'members', id, 'notifications')), { title: f.title.trim(), body: f.body.trim(), type: 'mensaje', read: false, createdAt: serverTimestamp() }));
        await b.commit();
      }
      await addDoc(collection(db, 'broadcasts'), { title: f.title.trim(), body: f.body.trim(), count: targets.length, to, createdAt: serverTimestamp() });
      toast(`Notificación enviada a ${targets.length} miembro(s)`, 'ok');
      setF({ title: '', body: '' }); setSel([]);
    } catch (er) { toast(er.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Notificaciones</h1></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={send}>
          <Field label="Enviar a"><Choice options={{ todos: `Todo el Team (${members.length})`, algunos: 'Elegir miembros' }} value={to} onChange={setTo} /></Field>
          {to === 'algunos' && (
            <div className="stack" style={{ gap: 6, maxHeight: 260, overflow: 'auto' }}>
              {members.map((m) => (
                <label key={m.id} className="row nowrap" style={{ cursor: 'pointer', padding: 6 }}>
                  <input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))} style={{ width: 18, height: 18, accentColor: '#5e6f4f' }} />
                  <Avatar person={m} /><span className="grow small">{fullName(m)}</span><Badge plain>{m.id}</Badge>
                </label>
              ))}
              {!members.length && <span className="muted small">Sin miembros.</span>}
            </div>
          )}
          <div className="pill-row">{TEMPLATES.map(([t, b]) => <button type="button" key={t} className="opt" onClick={() => setF({ title: t, body: b })}>{t}</button>)}</div>
          <Field label="Título"><input className="input" value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Mensaje"><textarea className="textarea" value={f.body} maxLength={600} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <button className="btn sage" disabled={busy}><Icon name="bell" size={16} /> {busy ? 'Enviando…' : 'Enviar notificación'}</button>
          <p className="tiny muted" style={{ margin: 0 }}>Llega como notificación push a quienes la activaron en su app, y siempre aparece en su sección de Avisos.</p>
        </form>
        <div className="card">
          <h4>Enviadas</h4>
          {!history.length ? <Empty icon="📨">Aún no envías notificaciones masivas.</Empty> : history.map((h) => (
            <div key={h.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow"><b className="small">{h.title}</b><div className="tiny muted">{h.body}</div></div>
              <div className="tiny muted center">{h.count} 👤<br />{fmtDateTime(h.createdAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
