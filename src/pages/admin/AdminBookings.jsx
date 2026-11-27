import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { deleteDoc, doc, getDoc, orderBy, serverTimestamp, updateDoc, where, getDocs, query, collection, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol, useDoc } from '../../lib/hooks';
import { Badge, Empty, Field, Icon, Modal, useToast } from '../../components/ui';
import { ACTIVITY, BOOKING_STATUS, GOALS, ageFrom, bmi, bmiLabel, cx, fmtDate, fmtDateTime, fullName, money, waLink } from '../../lib/utils';
import { serviceName, usePublicSettings, useServices } from '../../lib/config';
import { addDays, createMemberFromBooking, mergeBookingAdmin, notifyMember, saveBookingAdmin } from '../../lib/admin';
import { normalizeBooking } from '../../components/BookingForm';
import Agenda from '../../components/Agenda';

export function ClinicalSheet({ p }) {
  const age = ageFrom(p.birthDate);
  const b = bmi(p.weightKg, p.heightCm);
  const extra = [...new Map([...(p.extra || []), ...(p.bookingExtra || [])].filter((x) => x?.label && x?.value).map((x) => [String(x.label), x])).values()];
  const yn = (flag, v) => (flag === "si" ? `Sí — ${v || "sin detalle"}` : flag === "no" ? "No" : v);
  const groups = [
    ["Datos personales", [
      ["Nombre", fullName(p)], ["Nacimiento", p.birthDate ? `${fmtDate(p.birthDate)} · ${age} años` : ""], ["Sexo", p.sex], ["Teléfono", p.phone], ["Correo", p.email],
    ]],
    ["Motivo y objetivo", [
      ["Motivo de consulta", p.reason], ["Objetivo", (GOALS[p.goal] || p.goal) + (p.goalOther ? ` (${p.goalOther})` : "")],
      ["¿Ha ido con nutriólogo?", p.prevNutritionist === "si" ? "Sí" : p.prevNutritionist === "no" ? "No" : ""],
    ]],
    ["Medidas", [
      ["Estatura", p.heightCm && `${p.heightCm} cm`], ["Peso", p.weightKg && `${p.weightKg} kg`], ["IMC", b && `${b} · ${bmiLabel(b)}`], ["Peso meta", p.goalWeight && `${p.goalWeight} kg`],
      ["Actividad", ACTIVITY[p.activityLevel]?.label],
    ]],
    ["Salud básica", [
      ["Enfermedad o diagnóstico", yn(p.hasDisease, p.diseases) || "No indicado"], ["Medicamentos", yn(p.takesMeds, p.medications)],
      ["Alergias / intolerancias", yn(p.hasAllergy, p.allergies)], ["Lesiones o condiciones", yn(p.hasInjury, p.injuries)], ["Comentarios", p.notes],
    ]],

    ...(extra.length ? [["Preguntas adicionales", extra.map((x) => [x.label, x.value])]] : []),
    ...(p.staffNote ? [["Recepción", [["Comentario de recepción", p.staffNote]]]] : []),
  ];
  return (
    <div className="grid g2">
      {groups.map(([t, rows]) => (
        <div key={t} className="card flat" style={{ padding: 16 }}>
          <h4>{t}</h4>
          <dl className="kv">{rows.filter(([, v]) => v && typeof v !== 'object').map(([k, v], i) => <Fragment key={String(k) + i}><dt>{String(k)}</dt><dd>{String(v)}</dd></Fragment>)}</dl>
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
  const pubCfg = usePublicSettings();
  const reviewWeeks = pubCfg?.team?.reviewWeeks || 3;
  const services = useServices();
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
    const c = await createMemberFromBooking({ ...b, price: price === '' ? null : Number(price) }, prices[b.service], reviewWeeks);
    setCred(c);
  }, 'Reservación aceptada y acceso creado');

  const acceptExisting = (memberId) => run(async () => {
    await updateDoc(doc(db, 'bookings', b.id), { status: 'aceptada', memberId, acceptedAt: serverTimestamp() });
    await saveBookingAdmin(b, { price: price === '' ? null : Number(price) });
    const patch = { lastVisit: b.date, nextReview: addDays(b.date, reviewWeeks * 7), active: true };
    // Respuestas a preguntas personalizadas de esta reservación: se guardan en el expediente (las más recientes primero)
    const fresh = normalizeBooking({ extra: b.extra || [] }).extra || [];
    if (fresh.length) {
      const m = await getDoc(doc(db, 'members', memberId));
      const prev = m.data()?.bookingExtra || [];
      patch.bookingExtra = [...fresh.map((x) => ({ ...x, date: b.date })), ...prev.filter((x) => !fresh.some((y) => y.label === x.label))].slice(0, 60);
    }
    await updateDoc(doc(db, 'members', memberId), patch);
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

  const saveAdmin = (patch) => run(() => saveBookingAdmin(b, patch), 'Guardado');

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
            <Badge tone="sage" plain>{serviceName(services, b)}</Badge>
            <Badge plain>{fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {b.time}</Badge>
            {b.memberId && <Link to={`/admin/team/${b.memberId}`} className="badge info plain" onClick={onClose}>Team {b.memberId}</Link>}
            <span className="tiny muted">Recibida {fmtDateTime(b.createdAt)}</span>
          </div>
          {match && !b.memberId && <div className="notice">Ya existe un miembro con este correo (<b>{match.id}</b> · {fullName(match)}). Al aceptar, la cita se vinculará a su expediente.</div>}
          <div className="card soft grid g3" style={{ alignItems: 'end' }}>
            <Field label="Precio de la cita (solo tú lo ves)"><input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => b.status !== 'pendiente' && saveAdmin({ price: price === '' ? null : Number(price) })} /></Field>
            <label className="row nowrap small" style={{ paddingBottom: 12 }}>
              <input type="checkbox" checked={!!b.paid} onChange={(e) => saveAdmin({ paid: e.target.checked })} style={{ width: 20, height: 20, accentColor: '#6e2236' }} /> Pagado
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
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('pendiente');
  const [q, setQ] = useState('');
  const view = params.get('vista') === 'calendario' ? 'calendario' : 'lista';
  const setView = (v) => setParams(v === 'calendario' ? { vista: 'calendario' } : {});
  const raw = useCol('bookings', () => [orderBy('createdAt', 'desc')], 'bookings-admin');
  const priv = useCol('bookingAdmin', null, 'booking-admin-private').list;
  const loading = raw.loading;
  const list = mergeBookingAdmin(raw.list, priv);
  // Migración única: mueve precio/pago/notas antiguos a la colección privada
  useEffect(() => {
    const legacy = list.filter((b) => b._legacyPrivate);
    if (!legacy.length) return;
    Promise.all(legacy.map((b) => saveBookingAdmin(b, { price: b.price, paid: !!b.paid, adminNotes: b.adminNotes || '' }))).catch((e) => console.warn('Migración', e));
  }, [raw.list.map((b) => b.id + (b.price ?? '') + (b.adminNotes ?? '')).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const prices = useDoc('settings/admin').data?.prices || {};
  const openId = params.get('id');
  const open = list.find((b) => b.id === openId);

  const shown = list
    .filter((b) => filter === 'todas' || b.status === filter)
    .filter((b) => !q || `${fullName(b)} ${b.email} ${b.phone} ${b.memberId || ''}`.toLowerCase().includes(q.toLowerCase()));
  const count = (s) => list.filter((b) => b.status === s).length;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar">
        <h1>Reservaciones</h1>
        <div className="tabs">
          <button className={cx('tab', view === 'lista' && 'on')} onClick={() => setView('lista')}><Icon name="list" size={14} /> Lista</button>
          <button className={cx('tab', view === 'calendario' && 'on')} onClick={() => setView('calendario')}><Icon name="calendar" size={14} /> Calendario</button>
        </div>
      </div>
      {view === 'calendario' ? <Agenda mode="admin" /> : <>
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
                  <div className="tiny muted">{serviceName(services, b, true)} · {fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {b.time}{b.birthDate ? ` · ${ageFrom(b.birthDate)} años` : ''}{b.weightKg ? ` · ${b.weightKg} kg` : ''}</div>
                </div>
                <div className="hide-sm small muted">{money(b.price ?? prices[b.service] ?? 0)}</div>
                <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      </>}
      {open && <BookingDetail key={open.id} b={open} prices={prices} onClose={() => setParams({})} />}
    </div>
  );
}
