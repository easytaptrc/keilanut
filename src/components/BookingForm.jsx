import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { BOOKING_GOALS, SERVICES, ageFrom, bmi, bmiLabel, cx, fmtDate, todayISO } from '../lib/utils';
import { DEFAULT_SCHEDULE, isoOf, normalizeSchedule, slotsFor } from '../lib/schedule';
import Calendar from './Calendar';
import { Choice, Field, Icon } from './ui';

export { DEFAULT_SCHEDULE, slotsFor };

const YES_NO = { si: 'Sí', no: 'No' };

const EMPTY = {
  service: '', date: '', time: '',
  firstName: '', lastName: '', birthDate: '', phone: '', email: '',
  reason: '', goal: '', goalOther: '', prevNutritionist: '',
  heightCm: '', weightKg: '',
  hasDisease: '', diseases: '', takesMeds: '', medications: '', hasAllergy: '', allergies: '', hasInjury: '', injuries: '',
  notes: '', consentPrivacy: false, consentTerms: false,
};

// Datos del perfil que se guardan con la reservación (y luego en el expediente del paciente)
export const PROFILE_KEYS = ['firstName', 'lastName', 'birthDate', 'phone', 'email', 'reason', 'goal', 'goalOther', 'prevNutritionist',
  'heightCm', 'weightKg', 'hasDisease', 'diseases', 'takesMeds', 'medications', 'hasAllergy', 'allergies', 'hasInjury', 'injuries', 'notes'];

export function normalizeBooking(f) {
  const out = {};
  for (const k of PROFILE_KEYS) {
    const v = f[k];
    out[k] = typeof v === 'string' ? v.trim().slice(0, 2000) : v ?? '';
  }
  out.email = String(out.email || '').toLowerCase();
  // Si respondió "No", no guardamos el detalle
  for (const [flag, key] of [['hasDisease', 'diseases'], ['takesMeds', 'medications'], ['hasAllergy', 'allergies'], ['hasInjury', 'injuries']]) {
    if (out[flag] === 'no') out[key] = '';
  }
  if (out.goal !== 'otro') out.goalOther = '';
  return out;
}

function YesNoDetail({ label, flag, detail, f, set, placeholder }) {
  return (
    <div className="field yes-no">
      <span>{label}</span>
      <Choice options={YES_NO} value={f[flag]} onChange={set(flag)} />
      {f[flag] === 'si' && <input className="input fade-in" value={f[detail]} onChange={set(detail)} placeholder={placeholder || '¿Cuál?'} />}
    </div>
  );
}

export default function BookingForm({ member, schedule, onDone, initialService }) {
  const short = !!member;
  const [f, setF] = useState(() => {
    const base = { ...EMPTY, service: initialService || '' };
    if (member) {
      for (const k of PROFILE_KEYS) if (member[k] != null && k !== 'notes') base[k] = String(member[k]);
      base.consentPrivacy = true; base.consentTerms = true;
    }
    return base;
  });
  const [takenByDate, setTakenByDate] = useState({});
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const sch = useMemo(() => normalizeSchedule(schedule), [schedule]);
  const taken = takenByDate[f.date] || [];
  const slots = useMemo(() => slotsFor(f.date, sch).filter((t) => !taken.includes(t)), [f.date, sch, taken]);
  const morning = slots.filter((t) => t < '12:00');
  const afternoon = slots.filter((t) => t >= '12:00');

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

  const age = ageFrom(f.birthDate);
  const b = bmi(f.weightKg, f.heightCm);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const req = short
      ? ['service', 'date', 'time']
      : ['service', 'date', 'time', 'firstName', 'lastName', 'birthDate', 'phone', 'email', 'heightCm', 'weightKg', 'goal'];
    if (req.some((k) => !String(f[k] || '').trim())) return setErr('Completa los campos marcados con *.');
    if (!short) {
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Escribe un correo válido.');
      if (String(f.phone).replace(/\D/g, '').length < 10) return setErr('Escribe un teléfono de 10 dígitos.');
      const h = Number(String(f.heightCm).replace(',', '.')), w = Number(String(f.weightKg).replace(',', '.'));
      if (!(h > 90 && h < 230)) return setErr('Escribe tu estatura en centímetros (ej. 165).');
      if (!(w > 25 && w < 350)) return setErr('Escribe tu peso en kilogramos (ej. 68).');
      if (!f.consentPrivacy || !f.consentTerms) return setErr('Debes aceptar el aviso de privacidad y las condiciones del servicio.');
    }
    setBusy(true);
    try {
      const slotId = `${f.date}_${f.time.replace(':', '')}`;
      const s = await getDoc(doc(db, 'slots', slotId));
      if (s.exists()) { setF((x) => ({ ...x, time: '' })); throw new Error('Ese horario se acaba de ocupar. Elige otro.'); }
      const ref = doc(collection(db, 'bookings'));
      const data = {
        ...normalizeBooking(f),
        service: f.service, date: f.date, time: f.time,
        status: 'pendiente', source: short ? 'team' : 'web',
        memberId: member?.id || null,
        consent: { privacy: !!f.consentPrivacy, terms: !!f.consentTerms },
        createdAt: serverTimestamp(),
      };
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
        <h3><span className="num">1</span>Servicio y horario</h3>
        <div className="checks">
          {Object.entries(SERVICES).map(([k, s]) => (
            <button type="button" key={k} className={cx('opt big', f.service === k && 'on')} onClick={() => setF((x) => ({ ...x, service: k }))}>
              <b>{s.short}</b><small>{s.desc}</small>
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
                <small className="muted cap">{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })} · citas de 1 hora</small>
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
          <Field label="Peso actual (kg)"><input className="input" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} /></Field>
          <Field label="Comentarios para Keila"><textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="Ej. cambios de salud, medicamentos nuevos, dudas…" /></Field>
        </section>
      ) : (
        <>
          <section className="stack form-section">
            <h3><span className="num">2</span>Datos personales</h3>
            <div className="grid g2">
              <Field label="Nombre(s)" required><input className="input" value={f.firstName} onChange={set('firstName')} autoComplete="given-name" maxLength={80} /></Field>
              <Field label="Apellidos" required><input className="input" value={f.lastName} onChange={set('lastName')} autoComplete="family-name" maxLength={120} /></Field>
              <Field label="Fecha de nacimiento" required hint={age != null ? `${age} años` : ''}><input className="input" type="date" max={todayISO()} value={f.birthDate} onChange={set('birthDate')} /></Field>
              <Field label="Teléfono y WhatsApp" required><input className="input" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" maxLength={20} /></Field>
              <Field label="Correo electrónico" required hint="Si es Gmail, podrás entrar a tu app con Google." className="span2"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" maxLength={160} /></Field>
            </div>
          </section>

          <section className="stack form-section">
            <h3><span className="num">3</span>Motivo de consulta</h3>
            <Field label="¿Cuál es el motivo de tu consulta?"><textarea className="textarea" value={f.reason} onChange={set('reason')} maxLength={2000} placeholder="Cuéntanos brevemente qué te gustaría lograr o mejorar." /></Field>
            <Field label="Objetivo principal" required>
              <Choice options={BOOKING_GOALS} value={f.goal} onChange={set('goal')} />
            </Field>
            {f.goal === 'otro' && <input className="input fade-in" value={f.goalOther} onChange={set('goalOther')} placeholder="¿Cuál es tu objetivo?" maxLength={300} />}
            <Field label="¿Has acudido antes con un nutriólogo?"><Choice options={YES_NO} value={f.prevNutritionist} onChange={set('prevNutritionist')} /></Field>
          </section>

          <section className="stack form-section">
            <h3><span className="num">4</span>Medidas</h3>
            <div className="grid g2">
              <Field label="Estatura (cm)" required><input className="input" inputMode="decimal" placeholder="165" value={f.heightCm} onChange={set('heightCm')} /></Field>
              <Field label="Peso actual (kg)" required><input className="input" inputMode="decimal" placeholder="68" value={f.weightKg} onChange={set('weightKg')} /></Field>
            </div>
            {b && <div className="notice">IMC estimado: <b>{b}</b> · {bmiLabel(b)}. Las demás medidas las toma Keila en tu consulta.</div>}
          </section>

          <section className="stack form-section">
            <h3><span className="num">5</span>Información básica de salud</h3>
            <div className="grid g2">
              <YesNoDetail label="¿Tienes alguna enfermedad o diagnóstico médico?" flag="hasDisease" detail="diseases" f={f} set={set} />
              <YesNoDetail label="¿Tomas medicamentos actualmente?" flag="takesMeds" detail="medications" f={f} set={set} placeholder="¿Cuáles?" />
              <YesNoDetail label="¿Tienes alguna alergia o intolerancia alimentaria?" flag="hasAllergy" detail="allergies" f={f} set={set} />
              <YesNoDetail label="¿Tienes alguna lesión o condición que debamos conocer antes de la consulta?" flag="hasInjury" detail="injuries" f={f} set={set} />
            </div>
          </section>

          <section className="stack form-section">
            <h3><span className="num">6</span>Confirmación</h3>
            <label className="row nowrap small consent">
              <input type="checkbox" checked={f.consentPrivacy} onChange={set('consentPrivacy')} />
              <span>Acepto el aviso de privacidad y el tratamiento de mis datos personales y de salud, que se usarán únicamente para mi atención nutricional de forma confidencial.</span>
            </label>
            <label className="row nowrap small consent">
              <input type="checkbox" checked={f.consentTerms} onChange={set('consentTerms')} />
              <span>Confirmo mi reservación y acepto las condiciones del servicio.</span>
            </label>
          </section>
        </>
      )}

      {err && <div className="error" role="alert">{err}</div>}
      {f.date && f.time && f.service && (
        <div className="notice">Solicitas <b>{SERVICES[f.service].label}</b> el <b>{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b> a las <b>{f.time}</b>. Keila confirmará tu cita.</div>
      )}
      <button className="btn block" disabled={busy} type="submit">
        {busy ? 'Enviando…' : <>Confirmar reservación <Icon name="arrowR" size={18} /></>}
      </button>
    </form>
  );
}
