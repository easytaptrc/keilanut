// Agenda mensual de citas (recepción y administradora). Lee la colección "agenda": copia de las citas sin datos de salud ni precios.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useSession } from '../lib/session';
import { BOOKING_STATUS, cx, fmtDate, todayISO, waLink } from '../lib/utils';
import { isoOf, normalizeSchedule, slotsFor } from '../lib/schedule';
import { activeServices, serviceName, usePublicSettings, useServices } from '../lib/config';
import Calendar from './Calendar';
import { Badge, Empty, Field, Icon, Modal, Spinner, useToast } from './ui';
import '../reception.css';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ACTIVE = ['pendiente', 'aceptada'];
const fullName = (b) => `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Sin nombre';
const slotIdOf = (b) => `${b.date}_${String(b.time).replace(':', '')}`;

/** Citas del mes en tiempo real */
function useMonthAgenda(ym) {
  const [state, setState] = useState({ list: [], loading: true });
  useEffect(() => {
    const from = isoOf(ym.y, ym.m, 1), to = isoOf(ym.y, ym.m, new Date(ym.y, ym.m + 1, 0).getDate());
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(query(collection(db, 'agenda'), where('date', '>=', from), where('date', '<=', to)),
      (s) => setState({ list: s.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (e) => { console.warn('agenda', e); setState({ list: [], loading: false }); });
  }, [ym.y, ym.m]);
  return state;
}

/** Cambia el estado de una cita desde recepción (confirmar / cancelar) */
async function staffSetStatus(b, status, uid) {
  await updateDoc(doc(db, 'bookings', b.id), { status, updatedBy: uid, updatedAt: serverTimestamp() });
  if (status === 'rechazada') await deleteDoc(doc(db, 'slots', slotIdOf(b))).catch(() => {});
  // El aviso al paciente lo envía el servidor (función syncAgenda)
}

export default function Agenda({ mode = 'staff' }) {
  const toast = useToast();
  const { user } = useSession();
  const services = useServices();
  const today = todayISO();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState('');
  const [creating, setCreating] = useState(false);
  const { list, loading } = useMonthAgenda(ym);

  const byDay = useMemo(() => {
    const m = {};
    for (const b of list) (m[b.date] ||= []).push(b);
    Object.values(m).forEach((l) => l.sort((a, b) => String(a.time).localeCompare(String(b.time))));
    return m;
  }, [list]);
  const dayList = (byDay[day] || []);

  const go = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setDay(isoOf(d.getFullYear(), d.getMonth(), d.getFullYear() === Number(today.slice(0, 4)) && d.getMonth() === Number(today.slice(5, 7)) - 1 ? Number(today.slice(8, 10)) : 1));
  };
  const firstDow = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => isoOf(ym.y, ym.m, i + 1))];

  const act = async (b, status) => {
    if (status === 'rechazada' && !window.confirm(`¿Cancelar la cita de ${fullName(b)} (${fmtDate(b.date)} ${b.time})? El horario quedará libre.`)) return;
    setBusy(b.id);
    try { await staffSetStatus(b, status, user.uid); toast(status === 'aceptada' ? 'Cita confirmada' : 'Cita cancelada', 'ok'); }
    catch (e) { toast(e.code === 'permission-denied' ? 'No tienes permiso para este cambio.' : e.message, 'err'); }
    finally { setBusy(''); }
  };

  const monthCount = list.filter((b) => ACTIVE.includes(b.status)).length;

  return (
    <div className="agenda">
      <div className="card agenda-cal">
        <div className="cal-head">
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Mes anterior"><Icon name="arrowL" size={18} /></button>
          <b className="serif">{MONTHS[ym.m]} {ym.y}</b>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Mes siguiente"><Icon name="arrowR" size={18} /></button>
        </div>
        <div className="cal-grid cal-week">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="cal-grid">
          {cells.map((iso, i) => {
            if (!iso) return <span key={'e' + i} />;
            const items = (byDay[iso] || []).filter((b) => ACTIVE.includes(b.status));
            const pend = items.filter((b) => b.status === 'pendiente').length;
            return (
              <button type="button" key={iso} className={cx('ag-day', iso === day && 'on', iso === today && 'today', items.length && 'has')} onClick={() => setDay(iso)}
                aria-label={`${Number(iso.slice(8))} de ${MONTHS[ym.m]}: ${items.length} citas`}>
                <span>{Number(iso.slice(8))}</span>
                {items.length > 0 && <em className={cx(pend && 'pend')}>{items.length}</em>}
              </button>
            );
          })}
        </div>
        <div className="tiny muted mt">{loading ? 'Cargando…' : `${monthCount} cita${monthCount === 1 ? '' : 's'} activas este mes`} · <span className="ag-legend pend" /> con pendientes</div>
      </div>

      <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        <div className="row between">
          <h3 style={{ margin: 0 }} className="cap">{fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <button className="btn sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Nueva cita</button>
        </div>
        {!dayList.length ? <Empty icon="📅">Sin citas este día.</Empty> : dayList.map((b) => {
          const st = BOOKING_STATUS[b.status] || { label: b.status, tone: '' };
          return (
            <div key={b.id} className={cx('card flat ag-item', !ACTIVE.includes(b.status) && 'off')}>
              <div className="ag-time">{b.time}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <b className="small">{fullName(b)}</b>
                <div className="tiny muted">{serviceName(services, b)}{b.memberId ? ` · ${b.memberId}` : ' · Paciente nuevo'}{b.source === 'recepcion' ? ' · Agendó recepción' : ''}</div>
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {b.phone && <a className="btn link xs" href={waLink(b.phone, `Hola ${b.firstName || ''}, te escribimos del consultorio de Keila Guerrero sobre tu cita del ${fmtDate(b.date, { day: 'numeric', month: 'long' })} a las ${b.time}.`)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={14} /> {b.phone}</a>}
                </div>
              </div>
              <div className="ag-actions">
                {mode === 'admin' ? (
                  <Link className="btn light xs" to={`/admin/reservaciones?id=${b.id}`}>Abrir</Link>
                ) : (
                  <>
                    {b.status === 'pendiente' && b.memberId && <button className="btn sage xs" disabled={busy === b.id} onClick={() => act(b, 'aceptada')}>{busy === b.id ? <Spinner /> : 'Confirmar'}</button>}
                    {b.status === 'pendiente' && !b.memberId && <span className="tiny muted">Keila la acepta</span>}
                    {ACTIVE.includes(b.status) && <button className="btn ghost xs" style={{ color: 'var(--danger)' }} disabled={busy === b.id} onClick={() => act(b, 'rechazada')}>Cancelar</button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {creating && <NewAppointment initialDate={day >= today ? day : ''} onClose={() => setCreating(false)} onDone={(d) => { setCreating(false); if (d) { setDay(d); setYm({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 }); } }} />}
    </div>
  );
}

/** Agendar una cita desde recepción o desde el panel */
export function NewAppointment({ initialDate = '', onClose, onDone }) {
  const toast = useToast();
  const pub = usePublicSettings();
  const services = activeServices(pub?.services || {});
  const sch = useMemo(() => normalizeSchedule(pub?.schedule), [pub?.schedule]);
  const [who, setWho] = useState('existing');
  const [dir, setDir] = useState(null);
  const [q, setQ] = useState('');
  const [member, setMember] = useState(null);
  const [p, setP] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [f, setF] = useState({ service: '', date: initialDate, time: '', confirmed: true, notes: '' });
  const [taken, setTaken] = useState({});
  const [month, setMonth] = useState(() => { const d = initialDate ? new Date(initialDate + 'T12:00') : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => onSnapshot(collection(db, 'directory'), (s) => setDir(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.active !== false)), () => setDir([])), []);
  useEffect(() => {
    const from = isoOf(month.y, month.m, 1), to = isoOf(month.y, month.m, new Date(month.y, month.m + 1, 0).getDate());
    return onSnapshot(query(collection(db, 'slots'), where('date', '>=', from), where('date', '<=', to)), (s) => {
      const m = {}; s.docs.forEach((d) => { const { date, time } = d.data(); (m[date] ||= []).push(time); }); setTaken(m);
    }, () => setTaken({}));
  }, [month.y, month.m]);
  useEffect(() => { if (!f.service && Object.keys(services).length) setF((x) => ({ ...x, service: Object.keys(services)[0] })); }, [pub]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = f.date ? slotsFor(f.date, sch).filter((t) => !(taken[f.date] || []).includes(t)) : [];
  const matches = (dir || []).filter((m) => !q.trim() || `${m.firstName} ${m.lastName} ${m.phone} ${m.id}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  const save = async () => {
    setErr('');
    if (who === 'existing' && !member) return setErr('Elige al paciente.');
    if (who === 'new') {
      if (!p.firstName.trim() || !p.lastName.trim()) return setErr('Escribe nombre y apellidos.');
      if (String(p.phone).replace(/\D/g, '').length < 10) return setErr('Escribe un teléfono de 10 dígitos.');
      if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) return setErr('El correo no es válido.');
    }
    if (!f.service || !f.date || !f.time) return setErr('Elige el servicio, el día y la hora.');
    setBusy(true);
    try {
      const slotId = `${f.date}_${f.time.replace(':', '')}`;
      if ((await getDoc(doc(db, 'slots', slotId))).exists()) { setF((x) => ({ ...x, time: '' })); throw new Error('Ese horario se acaba de ocupar. Elige otro.'); }
      const person = who === 'existing'
        ? { firstName: member.firstName || '', lastName: member.lastName || '', phone: member.phone || '', email: member.email || '' }
        : { firstName: p.firstName.trim(), lastName: p.lastName.trim(), phone: p.phone.trim(), email: p.email.trim().toLowerCase() };
      const ref = doc(collection(db, 'bookings'));
      const status = who === 'existing' && f.confirmed ? 'aceptada' : 'pendiente';
      const data = {
        ...person, service: f.service, serviceLabel: String(services[f.service]?.label || f.service).slice(0, 120), date: f.date, time: f.time,
        status, source: 'recepcion', memberId: who === 'existing' ? member.id : null, createdAt: serverTimestamp(),
      };
      if (f.notes.trim()) data.staffNote = f.notes.trim().slice(0, 1000);
      const b = writeBatch(db);
      b.set(ref, data);
      b.set(doc(db, 'slots', slotId), { date: f.date, time: f.time, bookingId: ref.id });
      await b.commit();
      toast(status === 'aceptada' ? 'Cita agendada y confirmada' : 'Cita agendada como pendiente (Keila la acepta)', 'ok');
      onDone?.(f.date);
    } catch (e) {
      setErr(e.code === 'permission-denied' ? 'No se pudo guardar la cita. Revisa los datos o elige otro horario.' : e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal wide title="Nueva cita" onClose={() => !busy && onClose()}
      footer={<><button className="btn ghost" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn" disabled={busy} onClick={save}>{busy ? <Spinner /> : <Icon name="check" size={18} />} Agendar</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="tabs">
          <button type="button" className={cx('tab', who === 'existing' && 'on')} onClick={() => setWho('existing')}>Paciente del Team</button>
          <button type="button" className={cx('tab', who === 'new' && 'on')} onClick={() => setWho('new')}>Persona nueva</button>
        </div>
        {who === 'existing' ? (
          <div className="stack" style={{ gap: 8 }}>
            <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setMember(null); }} placeholder="Buscar por nombre, teléfono o ID (KG-0001)…" aria-label="Buscar paciente" />
            {dir === null ? <Spinner /> : member ? (
              <div className="notice row between"><span><b>{member.firstName} {member.lastName}</b> · {member.id} · {member.phone}</span><button type="button" className="btn link xs" onClick={() => setMember(null)}>Cambiar</button></div>
            ) : !matches.length ? <p className="small muted" style={{ margin: 0 }}>No hay pacientes con esa búsqueda. Si es alguien nuevo, usa “Persona nueva”.</p> : (
              <div className="ag-pick">
                {matches.map((m) => (
                  <button type="button" key={m.id} className="card flat" onClick={() => setMember(m)}>
                    <b className="small">{m.firstName} {m.lastName}</b><span className="tiny muted">{m.id} · {m.phone || 'sin teléfono'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid g2">
            <Field label="Nombre(s)" required><input className="input" value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} maxLength={80} /></Field>
            <Field label="Apellidos" required><input className="input" value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} maxLength={120} /></Field>
            <Field label="Teléfono / WhatsApp" required><input className="input" type="tel" inputMode="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} maxLength={20} /></Field>
            <Field label="Correo (opcional)"><input className="input" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} maxLength={160} /></Field>
            <p className="tiny muted span2" style={{ margin: 0 }}>La cita queda pendiente: Keila la acepta y en ese momento se crea su cuenta del Team.</p>
          </div>
        )}
        <Field label="Servicio">
          <div className="checks">
            {Object.entries(services).map(([k, s]) => <button type="button" key={k} className={cx('opt', f.service === k && 'on')} onClick={() => setF({ ...f, service: k })}>{s.short || s.label}</button>)}
          </div>
        </Field>
        <div className="booking-when">
          <div className="field">
            <span>Día</span>
            <Calendar schedule={sch} value={f.date} takenByDate={taken} onMonthChange={setMonth} onChange={(iso) => setF({ ...f, date: iso, time: '' })} />
          </div>
          <div className="field">
            <span>Hora</span>
            {!f.date ? <div className="slot-empty"><Icon name="calendar" size={24} /><span>Elige un día.</span></div>
              : !slots.length ? <div className="slot-empty"><span>Sin horas libres este día.</span></div> : (
                <div className="slot-grid">{slots.map((t) => <button type="button" key={t} className={cx('slot', f.time === t && 'on')} onClick={() => setF({ ...f, time: t })}>{t}</button>)}</div>
              )}
          </div>
        </div>
        {who === 'existing' && (
          <label className="row nowrap small"><input type="checkbox" checked={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.checked })} /> <span>Marcar como confirmada (el paciente recibe un aviso en su app)</span></label>
        )}
        <Field label="Comentario (opcional)"><textarea className="textarea" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} placeholder="Ej. Viene acompañada, prefiere recordatorio por WhatsApp…" /></Field>
        {err && <div className="error" role="alert">{err}</div>}
      </div>
    </Modal>
  );
}

export { staffSetStatus };
