import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol, useDoc } from '../../lib/hooks';
import { Avatar, Badge, Empty, Field, Icon, Modal, PageLoader, useToast } from '../../components/ui';
import ProgressPanel from '../../components/ProgressPanel';
import ProgressPhotos from '../../components/ProgressPhotos';
import FoodLog from '../../components/FoodLog';
import ConsultWizard from './ConsultWizard';
import { clinicalText } from '../../data/clinical';
import PlanTab from './PlanTab';
import { ClinicalSheet, CredentialsCard } from './AdminBookings';
import { mergeBookingAdmin, notifyMember, resetMemberAccess } from '../../lib/admin';
import { ACTIVITY, BOOKING_STATUS, GOALS, SERVICES, ageFrom, cx, fmtDate, fullName, money, waLink } from '../../lib/utils';

const TABS = { consulta: 'Consulta', expediente: 'Expediente', dieta: 'Dieta', rutina: 'Rutina', progreso: 'Progreso', comidas: 'Comidas', citas: 'Citas', avisar: 'Notificar', acceso: 'Acceso' };

const EDITABLE = [
  ['firstName', 'Nombre(s)'], ['lastName', 'Apellidos'], ['email', 'Correo (Google)'], ['phone', 'Teléfono'], ['birthDate', 'Nacimiento', 'date'],
  ['heightCm', 'Estatura (cm)'], ['weightKg', 'Peso (kg)'], ['goalWeight', 'Peso meta (kg)'], ['mealsPerDay', 'Comidas al día'], ['trainingDays', 'Días de entrenamiento'],
  ['diseases', 'Enfermedades', 'area'], ['medications', 'Medicamentos', 'area'], ['allergies', 'Alergias'], ['intolerances', 'Intolerancias'], ['injuries', 'Lesiones'],
  ['trainingSchedule', 'Horario de entrenamiento'], ['nextReview', 'Próxima revisión', 'date'], ['notes', 'Notas', 'area'],
];

function EditProfile({ m, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(() => Object.fromEntries([...EDITABLE.map(([k]) => [k, m[k] ?? '']), ['goal', m.goal || ''], ['activityLevel', m.activityLevel || ''], ['sex', m.sex || '']]));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    try {
      await updateDoc(doc(db, 'members', m.id), { ...f, email: String(f.email).trim().toLowerCase() });
      toast('Expediente actualizado', 'ok'); onClose();
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal wide title="Editar expediente" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn sage" onClick={save}>Guardar</button></>}>
      <div className="grid g3">
        {EDITABLE.map(([k, l, t]) => (
          <Field key={k} label={l} className={t === 'area' ? 'span2' : ''}>
            {t === 'area' ? <textarea className="textarea" value={f[k]} onChange={set(k)} /> : <input className="input" type={t || 'text'} value={f[k]} onChange={set(k)} />}
          </Field>
        ))}
        <Field label="Sexo"><select className="select" value={f.sex} onChange={set('sex')}><option value="femenino">Femenino</option><option value="masculino">Masculino</option></select></Field>
        <Field label="Objetivo"><select className="select" value={f.goal} onChange={set('goal')}><option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Actividad"><select className="select" value={f.activityLevel} onChange={set('activityLevel')}><option value="">—</option>{Object.entries(ACTIVITY).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

function NotifyTab({ m }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', body: '' });
  const list = useCol(`members/${m.id}/notifications`, null, 'n' + m.id).list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const send = async (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.body.trim()) return toast('Escribe título y mensaje', 'err');
    try { await notifyMember(m.id, { title: f.title.trim(), body: f.body.trim() }); setF({ title: '', body: '' }); toast('Notificación enviada', 'ok'); }
    catch (er) { toast(er.message, 'err'); }
  };
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <form className="card stack" onSubmit={send}>
        <h4 style={{ margin: 0 }}>Enviar notificación a {m.firstName}</h4>
        <Field label="Título"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} /></Field>
        <Field label="Mensaje"><textarea className="textarea" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={600} /></Field>
        <div className="tiny muted">{m.fcmTokens?.length ? `📱 ${m.fcmTokens.length} dispositivo(s) con notificaciones activas.` : 'Aún no activa notificaciones push; lo verá en su app en “Avisos”.'}</div>
        <button className="btn sage"><Icon name="bell" size={16} /> Enviar</button>
      </form>
      <div className="card">
        <h4>Historial</h4>
        {!list.length ? <Empty icon="🔔">Sin notificaciones.</Empty> : list.map((n) => (
          <div key={n.id} className="list-item" style={{ cursor: 'default' }}>
            <div className="grow"><b className="small">{n.title}</b><div className="tiny muted">{n.body}</div></div>
            <Badge tone={n.read ? 'ok' : 'warn'} plain>{n.read ? 'Leída' : 'No leída'}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMember() {
  const { id } = useParams();
  const toast = useToast();
  const { data: m, loading } = useDoc(`members/${id}`);
  const priv = useCol('bookingAdmin', null, 'booking-admin-private').list;
  const bookings = mergeBookingAdmin(useCol('bookings', () => [where('memberId', '==', id)], 'mb' + id).list, priv).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const prices = useDoc('settings/admin').data?.prices || {};
  const [tab, setTab] = useState('expediente');
  const clinical = useDoc(`members/${id}/clinical/history`).data;
  const dietPlan = useDoc(`members/${id}/plans/diet`).data?.data;
  const [editing, setEditing] = useState(false);
  const [cred, setCred] = useState(null);

  if (loading) return <PageLoader />;
  if (!m) return <Empty icon="🔎" title="Miembro no encontrado"><Link to="/admin/team">Volver</Link></Empty>;

  const reset = async () => {
    if (!window.confirm(`¿Generar una nueva contraseña para ${m.id}? La anterior dejará de funcionar.`)) return;
    try { setCred(await resetMemberAccess(m.id)); } catch (e) { toast(e.message, 'err'); }
  };
  const toggleActive = async () => {
    const next = m.active === false;
    if (!window.confirm(next ? 'Reactivar acceso al Team?' : `¿Desactivar a ${m.firstName}? Ya no podrá entrar a la app.`)) return;
    await updateDoc(doc(db, 'members', m.id), { active: next });
    toast(next ? 'Miembro reactivado' : 'Miembro desactivado', 'ok');
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Link to="/admin/team" className="btn link small" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}><Icon name="arrowL" size={16} /> Team</Link>
      <div className="card row" style={{ gap: 18 }}>
        <Avatar person={m} size="lg" />
        <div className="grow">
          <h2 style={{ margin: 0 }}>{fullName(m)}</h2>
          <div className="row small muted" style={{ gap: 8, marginTop: 4 }}>
            <Badge tone="sage">{m.id}</Badge>
            <span>{ageFrom(m.birthDate) ?? '?'} años</span>·<span>{m.heightCm || '?'} cm</span>·<span>{m.weightKg || '?'} kg</span>
            {m.active === false && <Badge tone="danger">Inactivo</Badge>}
          </div>
          <div className="small mt" style={{ marginTop: 6 }}>{GOALS[m.goal] || 'Sin objetivo'}</div>
        </div>
        <div className="row">
          {m.phone && <a className="btn light sm" href={waLink(m.phone, `Hola ${m.firstName} 🌿`)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> WhatsApp</a>}
          <button className="btn light sm" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Editar</button>
        </div>
      </div>

      <div className="tabs">
        {Object.entries(TABS).map(([k, l]) => <button key={k} className={cx('tab', tab === k && 'on')} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      <div className="fade-in" key={tab}>
        {tab === 'consulta' && <ConsultWizard member={m} onDone={() => setTab('expediente')} />}
        {tab === 'expediente' && (
          <div className="stack">
            <div className="row">
              {m.nextReview && <Badge tone="info" plain>Próxima revisión: {fmtDate(m.nextReview)}</Badge>}
              {m.lastVisit && <Badge plain>Última consulta: {fmtDate(m.lastVisit)}</Badge>}
              {m.clinicalStatus && <Badge tone="sage" plain>Historia clínica: {m.clinicalStatus}</Badge>}
              <button className="btn sm" onClick={() => setTab('consulta')}><Icon name="edit" size={16} /> {clinical ? 'Editar consulta' : 'Iniciar consulta'}</button>
            </div>
            <ClinicalSheet p={m} />
            {clinical ? <div className="card"><h4>Historial clínico nutricional</h4><pre className="clinical-pre">{clinicalText(clinical) || 'Sin respuestas todavía.'}</pre></div>
              : <div className="notice">Aún no hay historial clínico. Cuando llegue {m.firstName} a consulta, usa la pestaña <b>Consulta</b>.</div>}
          </div>
        )}
        {tab === 'dieta' && <PlanTab member={m} kind="diet" />}
        {tab === 'rutina' && <PlanTab member={m} kind="routine" />}
        {tab === 'progreso' && <div className="stack" style={{ gap: 18 }}><ProgressPhotos member={m} by="admin" /><ProgressPanel member={m} by="admin" /></div>}
        {tab === 'comidas' && <FoodLog member={m} readOnly targets={dietPlan?.calories ? { kcal: Number(dietPlan.calories), p: Number(dietPlan.macros?.protein) || 0, c: Number(dietPlan.macros?.carbs) || 0, f: Number(dietPlan.macros?.fat) || 0 } : null} />}
        {tab === 'citas' && (
          <div className="card">
            {!bookings.length ? <Empty icon="📅">Sin citas.</Empty> : (
              <div className="scroll-x">
                <table className="tbl">
                  <thead><tr><th>Fecha</th><th>Servicio</th><th>Estado</th><th>Precio</th><th>Pagado</th></tr></thead>
                  <tbody>{bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="nowrap"><Link to={`/admin/reservaciones?id=${b.id}`}>{fmtDate(b.date)} · {b.time}</Link></td>
                      <td>{SERVICES[b.service]?.short}</td>
                      <td><Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge></td>
                      <td>{money(b.price ?? prices[b.service] ?? 0)}</td>
                      <td>{b.paid ? '✓' : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'avisar' && <NotifyTab m={m} />}
        {tab === 'acceso' && (
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div className="card stack">
              <h4 style={{ margin: 0 }}>Acceso a la app</h4>
              <dl className="kv">
                <dt>ID de Team</dt><dd>{m.id}</dd>
                <dt>Correo para Google</dt><dd>{m.email || '—'}</dd>
                <dt>Google vinculado</dt><dd>{m.googleLinked ? 'Sí' : 'Por correo'}</dd>
                <dt>Notificaciones</dt><dd>{m.fcmTokens?.length ? `${m.fcmTokens.length} dispositivo(s)` : 'No activadas'}</dd>
              </dl>
              <p className="tiny muted">Puede entrar con su ID y contraseña o con la cuenta de Google del correo registrado. Si cambias el correo en “Editar”, entrará con ese Gmail.</p>
              <div className="row">
                <button className="btn sm" onClick={reset}><Icon name="settings" size={16} /> Generar nueva contraseña</button>
                <button className="btn ghost sm" onClick={toggleActive}>{m.active === false ? 'Reactivar' : 'Desactivar'}</button>
              </div>
            </div>
            {cred && <div className="card"><h4>Nuevos datos de acceso</h4><CredentialsCard cred={cred} phone={m.phone} name={m.firstName} /></div>}
          </div>
        )}
      </div>
      {editing && <EditProfile m={m} onClose={() => setEditing(false)} />}
    </div>
  );
}
