import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { deleteDoc, doc, orderBy, serverTimestamp, updateDoc, where, getDocs, query, collection, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol, useDoc } from '../../lib/hooks';
import { Badge, Empty, Field, Icon, Modal, useToast } from '../../components/ui';
import { ACTIVITY, BOOKING_STATUS, GOALS, SERVICES, ageFrom, bmi, bmiLabel, cx, fmtDate, fmtDateTime, fullName, money, waLink } from '../../lib/utils';
import { createMemberFromBooking, notifyMember } from '../../lib/admin';

export function ClinicalSheet({ p }) {
  const age = ageFrom(p.birthDate);
  const b = bmi(p.weightKg, p.heightCm);
  const groups = [
    ['Datos personales', [
      ['Nombre', fullName(p)], ['Nacimiento', p.birthDate ? `${fmtDate(p.birthDate)} · ${age} años` : ''], ['Sexo', p.sex], ['Teléfono', p.phone], ['Correo', p.email],
      ['Ocupación', p.occupation], ['Ciudad', p.city],
    ]],
    ['Medidas', [
      ['Estatura', p.heightCm && `${p.heightCm} cm`], ['Peso', p.weightKg && `${p.weightKg} kg`], ['IMC', b && `${b} · ${bmiLabel(b)}`], ['Peso meta', p.goalWeight && `${p.goalWeight} kg`],
      ['Cintura', p.waistCm && `${p.waistCm} cm`], ['Cadera', p.hipCm && `${p.hipCm} cm`], ['Complexión', p.bodyType],
    ]],
    ['Historial médico', [
      ['Enfermedades', p.diseases || 'Ninguna referida'], ['Medicamentos', p.medications], ['Cirugías', p.surgeries], ['Lesiones', p.injuries], ['Antecedentes familiares', p.familyHistory],
      ['Digestivo', p.digestive], ['Salud femenina', p.femaleHealth], ['Laboratorios', p.labs],
    ]],
    ['Alimentación y hábitos', [
      ['Alergias', p.allergies || 'Ninguna'], ['Intolerancias', p.intolerances], ['No le gusta', p.foodDislikes], ['Tipo de alimentación', p.foodPreferences], ['Comidas al día', p.mealsPerDay],
      ['Agua', p.waterLiters && `${p.waterLiters} L`], ['Sueño', p.sleepHours && `${p.sleepHours} h (${p.sleepTime || '?'} – ${p.wakeTime || '?'})`], ['Estrés', p.stress], ['Alcohol', p.alcohol], ['Tabaco', p.smoking],
      ['Presupuesto', p.budget], ['Quién cocina', p.cooking],
    ]],
    ['Actividad y objetivo', [
      ['Actividad diaria', ACTIVITY[p.activityLevel]?.label], ['Experiencia', p.trainingExperience], ['Días de entrenamiento', p.trainingDays], ['Horario', p.trainingSchedule], ['Lugar', p.trainingPlace],
      ['Objetivo', GOALS[p.goal] || p.goal], ['Motivación', p.motivation], ['Notas', p.notes],
    ]],
  ];
  return (
    <div className="grid g2">
      {groups.map(([t, rows]) => (
        <div key={t} className="card flat" style={{ padding: 16 }}>
          <h4>{t}</h4>
          <dl className="kv">{rows.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></Fragment>)}</dl>
        </div>
      ))}
    </div>
  );
}

export function CredentialsCard({ cred, phone, name }) {
  const toast = useToast();
  const text = `Hola ${name || ''} 🌿 ¡Bienvenida/o al Team de Keila Guerrero Nutrición!\n\nEntra a tu app: ${location.origin}/team\nID: ${cred.id}\nContraseña: ${cred.password}\n\nTe recomiendo instalarla en tu pantalla de inicio y activar las notificaciones. También puedes entrar con tu cuenta de Google.`;
  return (
    <div className="stack">
      <div className="cred-box">
        <div className="k">ID de Team</div><div className="v">{cred.id}</div>
        <div className="k">Contraseña</div><div className="v">{cred.password}</div>
      </div>
      <div className="notice small">Guarda o envía estos datos ahora: por seguridad, la contraseña no se vuelve a mostrar (puedes generar una nueva desde el expediente).</div>
      <div className="row">
        <button className="btn light sm" onClick={() => navigator.clipboard.writeText(text).then(() => toast('Copiado', 'ok'))}><Icon name="copy" size={16} /> Copiar mensaje</button>
        {phone && <a className="btn sage sm" href={waLink(phone, text)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> Enviar por WhatsApp</a>}
      </div>
    </div>
  );
}

function BookingDetail({ b, prices, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState(null);
  const [price, setPrice] = useState(b.price ?? prices[b.service] ?? '');
  const [adminNotes, setAdminNotes] = useState(b.adminNotes || '');
  const [match, setMatch] = useState(undefined);

  // ¿Ya existe un miembro con ese correo?
  useEffect(() => {
    if (b.memberId || !b.email) { setMatch(null); return; }
    getDocs(query(collection(db, 'members'), where('email', '==', b.email.toLowerCase()), limit(1)))
      .then((s) => setMatch(s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() })).catch(() => setMatch(null));
  }, [b.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok, 'ok'); } catch (e) { console.error(e); toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const acceptNew = () => run(async () => {
    const c = await createMemberFromBooking({ ...b, price: price === '' ? null : Number(price) }, prices[b.service]);
    setCred(c);
  }, 'Reservación aceptada y acceso creado');

  const acceptExisting = (memberId) => run(async () => {
    await updateDoc(doc(db, 'bookings', b.id), { status: 'aceptada', memberId, acceptedAt: serverTimestamp(), price: price === '' ? null : Number(price) });
    await notifyMember(memberId, { title: 'Cita confirmada', body: `Tu cita del ${fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })} a las ${b.time} está confirmada.`, type: 'booking' });
    onClose();
  }, 'Reservación aceptada');

  const reject = () => run(async () => {
    if (!window.confirm('¿Rechazar esta reservación? El horario quedará libre.')) return;
    await updateDoc(doc(db, 'bookings', b.id), { status: 'rechazada' });
    await deleteDoc(doc(db, 'slots', `${b.date}_${b.time.replace(':', '')}`)).catch(() => {});
    if (b.memberId) await notifyMember(b.memberId, { title: 'Cita no disponible', body: `No fue posible confirmar tu cita del ${b.date} a las ${b.time}. Por favor elige otro horario.`, type: 'booking' });
    onClose();
  }, 'Reservación rechazada');

  const complete = () => run(async () => {
    await updateDoc(doc(db, 'bookings', b.id), { status: 'completada' });
    onClose();
  }, 'Cita marcada como completada');

  const saveAdmin = (patch) => run(() => updateDoc(doc(db, 'bookings', b.id), patch), 'Guardado');

  return (
    <Modal wide title={cred ? 'Acceso al Team creado' : fullName(b)} onClose={onClose}
      footer={!cred && (
        <>
          {b.status === 'pendiente' && <button className="btn ghost" disabled={busy} onClick={reject}>Rechazar</button>}
          {b.status === 'aceptada' && <button className="btn ghost" disabled={busy} onClick={complete}>Marcar completada</button>}
          {b.status === 'pendiente' && (b.memberId
            ? <button className="btn sage" disabled={busy} onClick={() => acceptExisting(b.memberId)}><Icon name="check" size={18} /> Aceptar</button>
            : match
              ? <button className="btn sage" disabled={busy} onClick={() => acceptExisting(match.id)}><Icon name="check" size={18} /> Aceptar y vincular a {match.id}</button>
              : <button className="btn sage" disabled={busy || match === undefined} onClick={acceptNew}><Icon name="check" size={18} /> {busy ? 'Creando acceso…' : 'Aceptar y dar ID de Team'}</button>)}
        </>
      )}>
      {cred ? (
        <div className="stack">
          <p><b>{fullName(b)}</b> ya es parte del Team. Comparte sus datos de acceso:</p>
          <CredentialsCard cred={cred} phone={b.phone} name={b.firstName} />
          <Link to={`/admin/team/${cred.id}`} className="btn" onClick={onClose}>Abrir expediente y asignar plan <Icon name="arrowR" size={16} /></Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          <div className="row">
            <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
            <Badge tone="sage" plain>{SERVICES[b.service]?.label}</Badge>
            <Badge plain>{fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {b.time}</Badge>
            {b.memberId && <Link to={`/admin/team/${b.memberId}`} className="badge info plain" onClick={onClose}>Team {b.memberId}</Link>}
            <span className="tiny muted">Recibida {fmtDateTime(b.createdAt)}</span>
          </div>
          {match && !b.memberId && <div className="notice">Ya existe un miembro con este correo (<b>{match.id}</b> · {fullName(match)}). Al aceptar, la cita se vinculará a su expediente.</div>}
          <div className="card soft grid g3" style={{ alignItems: 'end' }}>
            <Field label="Precio de la cita (solo tú lo ves)"><input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => b.status !== 'pendiente' && saveAdmin({ price: price === '' ? null : Number(price) })} /></Field>
            <label className="row nowrap small" style={{ paddingBottom: 12 }}>
              <input type="checkbox" checked={!!b.paid} onChange={(e) => saveAdmin({ paid: e.target.checked })} style={{ width: 20, height: 20, accentColor: '#5e6f4f' }} /> Pagado
            </label>
            <div className="price">{money(price || 0)}</div>
            <Field label="Notas privadas" className="span2"><input className="input" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} onBlur={() => adminNotes !== (b.adminNotes || '') && saveAdmin({ adminNotes })} /></Field>
            {b.phone && <a className="btn light sm" href={waLink(b.phone, `Hola ${b.firstName}, te escribe Keila Guerrero sobre tu cita del ${b.date} a las ${b.time}.`)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> WhatsApp</a>}
          </div>
          <ClinicalSheet p={b} />
        </div>
      )}
    </Modal>
  );
}

const FILTERS = { pendiente: 'Pendientes', aceptada: 'Aceptadas', completada: 'Completadas', rechazada: 'Rechazadas', todas: 'Todas' };

export default function AdminBookings() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('pendiente');
  const [q, setQ] = useState('');
  const { list, loading } = useCol('bookings', () => [orderBy('createdAt', 'desc')], 'bookings-admin');
  const prices = useDoc('settings/admin').data?.prices || {};
  const openId = params.get('id');
  const open = list.find((b) => b.id === openId);

  const shown = list
    .filter((b) => filter === 'todas' || b.status === filter)
    .filter((b) => !q || `${fullName(b)} ${b.email} ${b.phone} ${b.memberId || ''}`.toLowerCase().includes(q.toLowerCase()));
  const count = (s) => list.filter((b) => b.status === s).length;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Reservaciones</h1></div>
      <div className="row between">
        <div className="tabs">
          {Object.entries(FILTERS).map(([k, l]) => (
            <button key={k} className={cx('tab', filter === k && 'on')} onClick={() => setFilter(k)}>{l}{k !== 'todas' && ` (${count(k)})`}</button>
          ))}
        </div>
        <input className="input sm" style={{ maxWidth: 260 }} placeholder="Buscar nombre, correo, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 8 }}>
        {loading ? <div className="skeleton" style={{ height: 200 }} /> : !shown.length ? <Empty icon="📭">No hay reservaciones en esta vista.</Empty> : (
          <div className="list">
            {shown.map((b) => (
              <div key={b.id} className="list-item" onClick={() => setParams({ id: b.id })} style={{ padding: '14px 12px' }}>
                <div className="avatar">{(b.firstName || '?')[0]}{(b.lastName || '')[0]}</div>
                <div className="grow">
                  <b>{fullName(b)}</b> {b.memberId ? <Badge tone="sage" plain>{b.memberId}</Badge> : <Badge tone="warn" plain>Nuevo</Badge>}
                  <div className="tiny muted">{SERVICES[b.service]?.short} · {fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {b.time}{b.birthDate ? ` · ${ageFrom(b.birthDate)} años` : ''}{b.weightKg ? ` · ${b.weightKg} kg` : ''}</div>
                </div>
                <div className="hide-sm small muted">{money(b.price ?? prices[b.service] ?? 0)}</div>
                <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <BookingDetail key={open.id} b={open} prices={prices} onClose={() => setParams({})} />}
    </div>
  );
}
