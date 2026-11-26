import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ageFrom, bmi, bmiLabel, cx, fmtDate, todayISO } from '../lib/utils';
import { DEFAULT_SCHEDULE, isoOf, normalizeSchedule, slotsFor } from '../lib/schedule';
import { DEFAULT_BOOKING_FORM, DEFAULT_SERVICES, activeServices, optionList, usePublicSettings } from '../lib/config';
import Calendar from './Calendar';
import { Choice, Field, Icon } from './ui';

export { DEFAULT_SCHEDULE, slotsFor };

const YES_NO = { si: 'Sí', no: 'No' };

// Datos del perfil que se guardan con la reservación (y luego en el expediente del paciente)
export const PROFILE_KEYS = ['firstName', 'lastName', 'birthDate', 'phone', 'email', 'reason', 'goal', 'goalOther', 'prevNutritionist',
  'heightCm', 'weightKg', 'hasDisease', 'diseases', 'takesMeds', 'medications', 'hasAllergy', 'allergies', 'hasInjury', 'injuries', 'notes'];
const DETAIL_OF = { hasDisease: 'diseases', takesMeds: 'medications', hasAllergy: 'allergies', hasInjury: 'injuries' };

export function normalizeBooking(f) {
  const out = {};
  for (const k of PROFILE_KEYS) {
    const v = f[k];
    out[k] = typeof v === 'string' ? v.trim().slice(0, 2000) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  }
  out.email = String(out.email || '').toLowerCase();
  // Si respondió "No", no guardamos el detalle
  for (const [flag, key] of Object.entries(DETAIL_OF)) if (out[flag] === 'no') out[key] = '';
  if (out.goal !== 'otro') out.goalOther = '';
  if (Array.isArray(f.extra)) {
    out.extra = f.extra.filter((x) => x && typeof x === 'object').slice(0, 60)
      .map((x) => ({ key: String(x.key ?? '').slice(0, 40), label: String(x.label ?? '').slice(0, 300), value: String(x.value ?? '').slice(0, 2000) }))
      .filter((x) => x.label && x.value);
  }
  return out;
}

/** Respuestas de preguntas personalizadas como lista {key,label,value} */
function extraAnswers(fields, f) {
  const out = [];
  for (const q of fields) {
    if (q.builtin) continue;
    let v = f[q.key];
    if (q.type === 'multi') v = (v || []).join(', ');
    else if (q.type === 'yesno' || q.type === 'yesno-detail') v = v === 'si' ? `Sí${q.type === 'yesno-detail' && f[q.key + '_detail'] ? `: ${f[q.key + '_detail']}` : ''}` : v === 'no' ? 'No' : '';
    else if (q.type === 'consent') v = v ? 'Aceptado' : '';
    else if (q.type === 'choice') v = optionList(q.options).find((o) => o.value === v)?.label || v || '';
    v = String(v ?? '').trim().slice(0, 2000);
    if (v) out.push({ key: q.key, label: String(q.label).slice(0, 300), value: v });
  }
  return out;
}

function isEmpty(q, f) {
  const v = f[q.key];
  if (q.type === 'consent') return !v;
  if (q.type === 'multi') return !(v || []).length;
  return !String(v ?? '').trim();
}

function Question({ q, f, set, setVal }) {
  const v = f[q.key];
  const opts = Object.fromEntries(optionList(q.options).map((o) => [o.value, o.label]));
  switch (q.type) {
    case 'textarea':
      return <Field label={q.label} required={q.required} hint={q.hint} className="span2"><textarea className="textarea" value={v || ''} onChange={set(q.key)} maxLength={2000} placeholder={q.placeholder || ''} /></Field>;
    case 'choice':
      return (
        <div className="span2 stack" style={{ gap: 8 }}>
          <Field label={q.label} required={q.required} hint={q.hint}><Choice options={opts} value={v || ''} onChange={setVal(q.key)} /></Field>
          {q.key === 'goal' && v === 'otro' && <input className="input fade-in" value={f.goalOther || ''} onChange={set('goalOther')} placeholder="¿Cuál es tu objetivo?" maxLength={300} />}
        </div>
      );
    case 'multi':
      return <Field label={q.label} required={q.required} hint={q.hint} className="span2"><Choice multi options={opts} value={v || []} onChange={setVal(q.key)} /></Field>;
    case 'yesno':
      return <Field label={q.label} required={q.required} hint={q.hint}><Choice options={YES_NO} value={v || ''} onChange={setVal(q.key)} /></Field>;
    case 'yesno-detail': {
      const dk = q.builtin ? (q.detailKey || DETAIL_OF[q.key]) : `${q.key}_detail`;
      return (
        <div className="field yes-no">
          <span>{q.label}{q.required && <em> *</em>}</span>
          <Choice options={YES_NO} value={v || ''} onChange={setVal(q.key)} />
          {v === 'si' && <input className="input fade-in" value={f[dk] || ''} onChange={set(dk)} placeholder={q.placeholder || '¿Cuál?'} maxLength={2000} />}
          {q.hint && <small className="hint">{q.hint}</small>}
        </div>
      );
    }
    case 'consent':
      return (
        <label className="row nowrap small consent span2">
          <input type="checkbox" checked={!!v} onChange={set(q.key)} />
          <span>{q.label}{q.required && <em style={{ color: 'var(--danger)' }}> *</em>}</span>
        </label>
      );
    default: {
      const type = { date: 'date', tel: 'tel', email: 'email' }[q.type] || 'text';
      const extra = q.type === 'number' ? { inputMode: 'decimal' } : q.type === 'tel' ? { inputMode: 'tel' } : {};
      const hint = q.key === 'birthDate' && ageFrom(v) != null ? `${ageFrom(v)} años` : q.hint;
      return (
        <Field label={q.label} required={q.required} hint={hint} className={q.key === 'email' ? 'span2' : ''}>
          <input className="input" type={type} value={v || ''} onChange={set(q.key)} placeholder={q.placeholder || ''} maxLength={q.type === 'text' ? 300 : 160}
            max={q.type === 'date' && q.key === 'birthDate' ? todayISO() : undefined} {...extra} />
        </Field>
      );
    }
  }
}

export default function BookingForm({ member, schedule, onDone, initialService }) {
  const short = !!member;
  const pub = usePublicSettings();
  const form = pub?.bookingForm || DEFAULT_BOOKING_FORM;
  const services = activeServices(pub?.services || DEFAULT_SERVICES);
  const sections = form.sections.filter((s) => s.enabled !== false).map((s) => ({ ...s, fields: s.fields.filter((q) => q.enabled !== false) })).filter((s) => s.fields.length);
  const fields = sections.flatMap((s) => s.fields);

  const [f, setF] = useState(() => {
    const base = { service: initialService || '', date: '', time: '', notes: '' };
    if (member) {
      for (const k of PROFILE_KEYS) if (member[k] != null && k !== 'notes') base[k] = String(member[k]);
    }
    return base;
  });
  const [takenByDate, setTakenByDate] = useState({});
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setVal = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const sch = useMemo(() => normalizeSchedule(schedule), [schedule]);
  const taken = takenByDate[f.date] || [];
  const slots = useMemo(() => slotsFor(f.date, sch).filter((t) => !taken.includes(t)), [f.date, sch, taken]);
  const morning = slots.filter((t) => t < '12:00');
  const afternoon = slots.filter((t) => t >= '12:00');

  // Si el servicio pedido por enlace no existe o está apagado, se limpia
  useEffect(() => { if (f.service && pub && !services[f.service]) setF((x) => ({ ...x, service: '' })); }, [pub]); // eslint-disable-line react-hooks/exhaustive-deps

  // Horarios ocupados del mes visible, en tiempo real: si alguien reserva, la hora desaparece al instante
  useEffect(() => {
    const from = isoOf(month.y, month.m, 1);
    const to = isoOf(month.y, month.m, new Date(month.y, month.m + 1, 0).getDate());
    return onSnapshot(query(collection(db, 'slots'), where('date', '>=', from), where('date', '<=', to)), (s) => {
      const map = {};
      s.docs.forEach((d) => { const { date, time } = d.data(); (map[date] ||= []).push(time); });
      setTakenByDate(map);
    }, () => setTakenByDate({}));
  }, [month.y, month.m]);

  useEffect(() => {
    if (f.time && taken.includes(f.time)) {
      setF((x) => ({ ...x, time: '' }));
      setErr('La hora que elegiste se acaba de ocupar. Elige otra.');
    }
  }, [taken, f.time]);

  const has = (k) => fields.some((q) => q.key === k);
  const b = has('heightCm') && has('weightKg') ? bmi(f.weightKg, f.heightCm) : null;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!f.service || !f.date || !f.time) return setErr('Elige el servicio, el día y la hora.');
    if (!short) {
      const missing = fields.filter((q) => q.required && isEmpty(q, f));
      if (missing.length) {
        const c = missing.find((q) => q.type === 'consent');
        return setErr(c ? 'Debes marcar las casillas de aceptación para continuar.' : `Completa los campos marcados con *: ${missing.slice(0, 3).map((q) => q.label.replace(/[¿?]/g, '')).join(', ')}${missing.length > 3 ? '…' : ''}.`);
      }
      if (has('email') && f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Escribe un correo válido.');
      if (has('phone') && f.phone && String(f.phone).replace(/\D/g, '').length < 10) return setErr('Escribe un teléfono de 10 dígitos.');
      const h = Number(String(f.heightCm || '').replace(',', '.')), w = Number(String(f.weightKg || '').replace(',', '.'));
      if (has('heightCm') && f.heightCm && !(h > 90 && h < 230)) return setErr('Escribe tu estatura en centímetros (ej. 165).');
      if (has('weightKg') && f.weightKg && !(w > 25 && w < 350)) return setErr('Escribe tu peso en kilogramos (ej. 68).');
    }
    setBusy(true);
    try {
      const slotId = `${f.date}_${f.time.replace(':', '')}`;
      const s = await getDoc(doc(db, 'slots', slotId));
      if (s.exists()) { setF((x) => ({ ...x, time: '' })); throw new Error('Ese horario se acaba de ocupar. Elige otro.'); }
      const ref = doc(collection(db, 'bookings'));
      const extra = short ? [] : extraAnswers(fields, f);
      const data = {
        ...normalizeBooking({ ...f, extra }),
        service: f.service, serviceLabel: String(services[f.service]?.label || f.service).slice(0, 120), date: f.date, time: f.time,
        status: 'pendiente', source: short ? 'team' : 'web',
        memberId: member?.id || null,
        consent: { privacy: short || !has('consentPrivacy') || !!f.consentPrivacy, terms: short || !has('consentTerms') || !!f.consentTerms },
        createdAt: serverTimestamp(),
      };
      if (!extra.length) delete data.extra;
      const batch = writeBatch(db);
      batch.set(ref, data);
      batch.set(doc(db, 'slots', slotId), { date: f.date, time: f.time, bookingId: ref.id });
      await batch.commit();
      onDone?.({ id: ref.id, ...data });
    } catch (e2) {
      console.error(e2);
      setErr(e2.code === 'permission-denied' ? 'No se pudo enviar la reservación. Revisa los datos o elige otro horario.' : e2.message);
    } finally {
      setBusy(false);
    }
  }

  const SlotGroup = ({ title, list }) => list.length > 0 && (
    <div className="stack" style={{ gap: 6 }}>
      <small className="muted">{title}</small>
      <div className="slot-grid">
        {list.map((t) => (
          <button type="button" key={t} className={cx('slot', f.time === t && 'on')} onClick={() => { setErr(''); setF((x) => ({ ...x, time: t })); }}>{t}</button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 22 }} noValidate>
      <section className="stack form-section" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
        <h3><span className="num">1</span>{form.scheduleTitle || 'Servicio y horario'}</h3>
        <div className="checks">
          {Object.entries(services).map(([k, s]) => (
            <button type="button" key={k} className={cx('opt big', f.service === k && 'on')} onClick={() => setF((x) => ({ ...x, service: k }))}>
              <b>{s.short || s.label}</b><small>{s.desc}</small>
            </button>
          ))}
        </div>
        <div className="booking-when">
          <div className="field">
            <span>Elige el día <em>*</em></span>
            <Calendar schedule={sch} value={f.date} takenByDate={takenByDate} onMonthChange={setMonth}
              onChange={(iso) => { setErr(''); setF((x) => ({ ...x, date: iso, time: '' })); }} />
          </div>
          <div className="field">
            <span>Horas disponibles <em>*</em></span>
            {!f.date ? (
              <div className="slot-empty"><Icon name="calendar" size={28} /><span>Selecciona un día en el calendario para ver las horas libres.</span></div>
            ) : (
              <div className="stack fade-in" key={f.date} style={{ gap: 12 }}>
                <small className="muted cap">{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })} · citas de {sch.step >= 60 && sch.step % 60 === 0 ? `${sch.step / 60} hora${sch.step > 60 ? 's' : ''}` : `${sch.step} min`}</small>
                {!slots.length && <div className="slot-empty"><span>Ya no quedan horas libres este día. Elige otro.</span></div>}
                <SlotGroup title="Mañana" list={morning} />
                <SlotGroup title="Tarde" list={afternoon} />
              </div>
            )}
          </div>
        </div>
      </section>

      {short ? (
        <section className="stack form-section">
          <h3>¿Algo que debamos saber?</h3>
          <Field label="Peso actual (kg)"><input className="input" inputMode="decimal" value={f.weightKg || ''} onChange={set('weightKg')} /></Field>
          <Field label="Comentarios para Keila"><textarea className="textarea" value={f.notes || ''} onChange={set('notes')} placeholder="Ej. cambios de salud, medicamentos nuevos, dudas…" /></Field>
        </section>
      ) : sections.map((s, i) => (
        <section key={s.key} className="stack form-section">
          <h3><span className="num">{i + 2}</span>{s.title}</h3>
          <div className="grid g2">
            {s.fields.map((q) => <Question key={q.key} q={q} f={f} set={set} setVal={setVal} />)}
          </div>
          {s.key === 'medidas' && b && <div className="notice">IMC estimado: <b>{b}</b> · {bmiLabel(b)}. Las demás medidas las toma Keila en tu consulta.</div>}
        </section>
      ))}

      {err && <div className="error" role="alert">{err}</div>}
      {f.date && f.time && f.service && services[f.service] && (
        <div className="notice">Solicitas <b>{services[f.service].label}</b> el <b>{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b> a las <b>{f.time}</b>. Keila confirmará tu cita.</div>
      )}
      <button className="btn block" disabled={busy} type="submit">
        {busy ? 'Enviando…' : <>Confirmar reservación <Icon name="arrowR" size={18} /></>}
      </button>
    </form>
  );
}
