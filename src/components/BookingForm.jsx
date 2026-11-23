import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ACTIVITY, GOALS, SERVICES, ageFrom, bmi, bmiLabel, cx, fmtDate, todayISO } from '../lib/utils';
import { DEFAULT_SCHEDULE, isoOf, normalizeSchedule, slotsFor } from '../lib/schedule';
import Calendar from './Calendar';
import { Choice, Field, Icon } from './ui';

export { DEFAULT_SCHEDULE, slotsFor };

const COMMON_DISEASES = ['Diabetes', 'Prediabetes / resistencia a la insulina', 'Hipertensión', 'Hipotiroidismo', 'Hipertiroidismo', 'Colesterol / triglicéridos altos', 'SOP (ovario poliquístico)', 'Gastritis / colitis', 'Hígado graso', 'Ansiedad / depresión', 'Anemia'];

const EMPTY = {
  service: '', date: '', time: '',
  firstName: '', lastName: '', birthDate: '', sex: '', email: '', phone: '', occupation: '', city: '',
  heightCm: '', weightKg: '', goalWeight: '', waistCm: '', hipCm: '', bodyType: '',
  diseasesList: [], diseasesOther: '', medications: '', surgeries: '', injuries: '', familyHistory: '', digestive: '', femaleHealth: '', labs: '',
  allergies: '', intolerances: '', foodDislikes: '', foodPreferences: 'omnivora', mealsPerDay: '4', waterLiters: '', budget: '', cooking: '',
  alcohol: 'no', smoking: 'no', sleepHours: '', wakeTime: '', sleepTime: '', stress: 'medio',
  activityLevel: '', trainingExperience: 'principiante', trainingDays: '3', trainingSchedule: '', trainingPlace: 'gimnasio',
  goal: '', motivation: '', notes: '', consent: false,
};

const PROFILE_KEYS = Object.keys(EMPTY).filter((k) => !['service', 'date', 'time', 'consent', 'diseasesList', 'diseasesOther'].includes(k));

/** Junta la lista de enfermedades en un texto */
export function normalizeBooking(f) {
  const diseases = [...(f.diseasesList || []), f.diseasesOther].filter(Boolean).join(', ');
  const out = { diseases };
  for (const k of PROFILE_KEYS) out[k] = typeof f[k] === 'string' ? f[k].trim() : f[k];
  out.email = (out.email || '').toLowerCase();
  return out;
}

export default function BookingForm({ member, schedule, onDone, initialService }) {
  const short = !!member;
  const [f, setF] = useState(() => {
    const base = { ...EMPTY, service: initialService || '' };
    if (member) {
      for (const k of PROFILE_KEYS) if (member[k] != null) base[k] = String(member[k]);
      base.diseasesOther = member.diseases || '';
      base.consent = true;
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

  // Si la hora elegida se ocupa mientras llenas el formulario, se libera la selección
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
      : ['service', 'date', 'time', 'firstName', 'lastName', 'birthDate', 'sex', 'phone', 'email', 'heightCm', 'weightKg', 'goal', 'activityLevel', 'mealsPerDay'];
    const missing = req.filter((k) => !String(f[k] || '').trim());
    if (missing.length) return setErr('Completa los campos obligatorios marcados con *.');
    if (!short && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Escribe un correo válido.');
    if (!f.consent) return setErr('Debes aceptar el aviso de privacidad.');
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
              <>
                <small className="muted cap">{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })}</small>
                {!slots.length && <div className="slot-empty"><span>Ya no quedan horas libres este día. Elige otro.</span></div>}
                <div className="slot-grid fade-in" key={f.date}>
                  {slots.map((t) => (
                    <button type="button" key={t} className={cx('slot', f.time === t && 'on')} onClick={() => { setErr(''); setF((x) => ({ ...x, time: t })); }}>{t}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {short ? (
        <section className="stack form-section">
          <h3>Actualiza tus datos</h3>
          <div className="grid g3">
            <Field label="Peso actual (kg)"><input className="input" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} /></Field>
            <Field label="Cintura (cm)"><input className="input" inputMode="decimal" value={f.waistCm} onChange={set('waistCm')} /></Field>
            <Field label="Objetivo">
              <select className="select" value={f.goal} onChange={set('goal')}>
                <option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="¿Algún cambio de salud, medicamento o comentario para Keila?">
            <textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="Ej. Me cuesta cumplir la cena, empecé a correr, etc." />
          </Field>
        </section>
      ) : (
        <>
          <section className="stack form-section">
            <h3><span className="num">2</span>Datos personales</h3>
            <div className="grid g2">
              <Field label="Nombre(s)" required><input className="input" value={f.firstName} onChange={set('firstName')} autoComplete="given-name" /></Field>
              <Field label="Apellidos" required><input className="input" value={f.lastName} onChange={set('lastName')} autoComplete="family-name" /></Field>
              <Field label="Fecha de nacimiento" required hint={age != null ? `${age} años` : ''}><input className="input" type="date" max={todayISO()} value={f.birthDate} onChange={set('birthDate')} /></Field>
              <Field label="Sexo" required><Choice options={{ femenino: 'Femenino', masculino: 'Masculino' }} value={f.sex} onChange={set('sex')} /></Field>
              <Field label="Teléfono / WhatsApp" required><input className="input" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
              <Field label="Correo electrónico (Gmail para entrar con Google)" required><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
              <Field label="Ocupación"><input className="input" value={f.occupation} onChange={set('occupation')} /></Field>
              <Field label="Ciudad"><input className="input" value={f.city} onChange={set('city')} /></Field>
            </div>
          </section>

          <section className="stack form-section">
            <h3><span className="num">3</span>Medidas y composición</h3>
            <div className="grid g3">
              <Field label="Estatura (cm)" required><input className="input" inputMode="decimal" placeholder="165" value={f.heightCm} onChange={set('heightCm')} /></Field>
              <Field label="Peso actual (kg)" required><input className="input" inputMode="decimal" placeholder="68" value={f.weightKg} onChange={set('weightKg')} /></Field>
              <Field label="Peso meta (kg)"><input className="input" inputMode="decimal" value={f.goalWeight} onChange={set('goalWeight')} /></Field>
              <Field label="Cintura (cm)"><input className="input" inputMode="decimal" value={f.waistCm} onChange={set('waistCm')} /></Field>
              <Field label="Cadera (cm)"><input className="input" inputMode="decimal" value={f.hipCm} onChange={set('hipCm')} /></Field>
              <Field label="Complexión">
                <select className="select" value={f.bodyType} onChange={set('bodyType')}>
                  <option value="">—</option><option>Delgada</option><option>Media</option><option>Robusta</option><option>No sé</option>
                </select>
              </Field>
            </div>
            {b && <div className="notice">IMC estimado: <b>{b}</b> · {bmiLabel(b)}</div>}
          </section>

          <section className="stack form-section">
            <h3><span className="num">4</span>Historial médico</h3>
            <Field label="¿Tienes alguna enfermedad o diagnóstico?">
              <Choice multi options={Object.fromEntries(COMMON_DISEASES.map((d) => [d, d]))} value={f.diseasesList} onChange={set('diseasesList')} />
            </Field>
            <div className="grid g2">
              <Field label="Otra enfermedad o detalle"><input className="input" value={f.diseasesOther} onChange={set('diseasesOther')} /></Field>
              <Field label="Medicamentos o suplementos que tomas"><input className="input" value={f.medications} onChange={set('medications')} /></Field>
              <Field label="Cirugías previas"><input className="input" value={f.surgeries} onChange={set('surgeries')} /></Field>
              <Field label="Lesiones o limitaciones físicas"><input className="input" value={f.injuries} onChange={set('injuries')} placeholder="Ej. dolor de rodilla, hernia" /></Field>
              <Field label="Antecedentes familiares"><input className="input" value={f.familyHistory} onChange={set('familyHistory')} placeholder="Diabetes, hipertensión, cáncer…" /></Field>
              <Field label="Síntomas digestivos"><input className="input" value={f.digestive} onChange={set('digestive')} placeholder="Inflamación, estreñimiento, reflujo…" /></Field>
              {f.sex === 'femenino' && (
                <Field label="Salud femenina" hint="Ciclo regular/irregular, embarazo, lactancia, anticonceptivos"><input className="input" value={f.femaleHealth} onChange={set('femaleHealth')} /></Field>
              )}
              <Field label="Estudios de laboratorio recientes"><input className="input" value={f.labs} onChange={set('labs')} placeholder="Glucosa, perfil lipídico… (si los tienes)" /></Field>
            </div>
          </section>

          <section className="stack form-section">
            <h3><span className="num">5</span>Alimentación y hábitos</h3>
            <div className="grid g2">
              <Field label="¿Eres alérgica/o a algún alimento?"><input className="input" value={f.allergies} onChange={set('allergies')} placeholder="Ninguna / cacahuate, mariscos…" /></Field>
              <Field label="Intolerancias"><input className="input" value={f.intolerances} onChange={set('intolerances')} placeholder="Lactosa, gluten…" /></Field>
              <Field label="Alimentos que no te gustan"><input className="input" value={f.foodDislikes} onChange={set('foodDislikes')} /></Field>
              <Field label="Tipo de alimentación">
                <select className="select" value={f.foodPreferences} onChange={set('foodPreferences')}>
                  <option value="omnivora">Como de todo</option><option value="vegetariana">Vegetariana</option><option value="vegana">Vegana</option>
                  <option value="pescetariana">Pescetariana</option><option value="sin_cerdo">Sin cerdo</option><option value="otra">Otra</option>
                </select>
              </Field>
            </div>
            <Field label="¿Cuántas comidas puedes hacer al día?" required>
              <Choice options={{ 3: '3 comidas', 4: '4 comidas', 5: '5 comidas', 6: '6 comidas' }} value={f.mealsPerDay} onChange={set('mealsPerDay')} />
            </Field>
            <div className="grid g3">
              <Field label="Agua al día (litros)"><input className="input" inputMode="decimal" value={f.waterLiters} onChange={set('waterLiters')} /></Field>
              <Field label="Horas de sueño"><input className="input" inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} /></Field>
              <Field label="Nivel de estrés">
                <select className="select" value={f.stress} onChange={set('stress')}><option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option></select>
              </Field>
              <Field label="Hora en que despiertas"><input className="input" type="time" value={f.wakeTime} onChange={set('wakeTime')} /></Field>
              <Field label="Hora en que duermes"><input className="input" type="time" value={f.sleepTime} onChange={set('sleepTime')} /></Field>
              <Field label="Alcohol">
                <select className="select" value={f.alcohol} onChange={set('alcohol')}><option value="no">No</option><option value="ocasional">Ocasional</option><option value="fines">Fines de semana</option><option value="frecuente">Frecuente</option></select>
              </Field>
              <Field label="Tabaco">
                <select className="select" value={f.smoking} onChange={set('smoking')}><option value="no">No</option><option value="si">Sí</option></select>
              </Field>
              <Field label="Presupuesto para comida">
                <select className="select" value={f.budget} onChange={set('budget')}><option value="">—</option><option>Bajo</option><option>Medio</option><option>Alto</option></select>
              </Field>
              <Field label="¿Quién cocina?"><input className="input" value={f.cooking} onChange={set('cooking')} placeholder="Yo / familia / como fuera" /></Field>
            </div>
          </section>

          <section className="stack form-section">
            <h3><span className="num">6</span>Actividad física y objetivo</h3>
            <Field label="Actividad física diaria" required>
              <select className="select" value={f.activityLevel} onChange={set('activityLevel')}>
                <option value="">Selecciona…</option>{Object.entries(ACTIVITY).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
              </select>
            </Field>
            <div className="grid g2">
              <Field label="Experiencia entrenando">
                <Choice options={{ principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' }} value={f.trainingExperience} onChange={set('trainingExperience')} />
              </Field>
              <Field label="¿Dónde entrenas?">
                <Choice options={{ gimnasio: 'Gimnasio', casa: 'Casa', aire_libre: 'Aire libre', no_entreno: 'No entreno' }} value={f.trainingPlace} onChange={set('trainingPlace')} />
              </Field>
              <Field label="Días que puedes entrenar por semana">
                <Choice options={{ 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }} value={f.trainingDays} onChange={set('trainingDays')} />
              </Field>
              <Field label="Horario de entrenamiento"><input className="input" value={f.trainingSchedule} onChange={set('trainingSchedule')} placeholder="Ej. 6:00 a 7:00 am" /></Field>
            </div>
            <Field label="Objetivo principal" required>
              <select className="select" value={f.goal} onChange={set('goal')}>
                <option value="">Selecciona…</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="¿Qué te motiva? ¿Hay alguna fecha o meta especial?"><textarea className="textarea" value={f.motivation} onChange={set('motivation')} /></Field>
            <Field label="Algo más que Keila deba saber"><textarea className="textarea" value={f.notes} onChange={set('notes')} /></Field>
          </section>

          <label className="row nowrap small consent">
            <input type="checkbox" checked={f.consent} onChange={set('consent')} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#5e6f4f' }} />
            <span>Acepto que mis datos de salud se usen únicamente para mi atención nutricional, de forma confidencial, conforme al aviso de privacidad.</span>
          </label>
        </>
      )}

      {err && <div className="error">{err}</div>}
      {f.date && f.time && f.service && (
        <div className="notice">Solicitas <b>{SERVICES[f.service].label}</b> el <b>{fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b> a las <b>{f.time}</b>. Keila confirmará tu cita.</div>
      )}
      <button className="btn sage block" disabled={busy} type="submit">
        {busy ? 'Enviando…' : <>Enviar reservación <Icon name="arrowR" size={18} /></>}
      </button>
    </form>
  );
}
