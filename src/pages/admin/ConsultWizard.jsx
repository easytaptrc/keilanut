import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDoc } from '../../lib/hooks';
import { activeBodyFields, activeClinicalSections, mergeClinicalForm, usePublicSettings } from '../../lib/config';
import { FORMULAS, computeEnergy, mergeEnergy, personData } from '../../lib/energy';
import { ACTIVITY, CLINICAL_GOAL_KEY, GOALS, ageFrom, bmi, bmiLabel, cx, fmtDate, todayISO } from '../../lib/utils';
import { addDays } from '../../lib/admin';
import { Choice, Field, Icon, Spinner, useToast } from '../../components/ui';
import ProgressPhotos from '../../components/ProgressPhotos';

const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return v === '' || v == null || Number.isNaN(n) ? null : n; };

function ClinicalField({ f, value, other, onChange, onOther }) {
  const opts = Object.fromEntries((f.options || []).map((o) => (typeof o === 'string' ? [o, o] : [o.value, o.label])));
  const showOther = f.other && (f.type === 'multi' ? true : value === 'Otro' || value === 'Otros');
  return (
    <div className="field">
      <span>{f.label}</span>
      {f.hint && <small className="hint">{f.hint}</small>}
      {f.type === 'multi' && <Choice multi options={opts} value={value || []} onChange={onChange} />}
      {f.type === 'single' && (
        <div className="checks">
          {Object.entries(opts).map(([o, l]) => <button type="button" key={o} className={cx('opt', value === o && 'on')} onClick={() => onChange(value === o ? '' : o)}>{l}</button>)}
        </div>
      )}
      {f.type === 'text' && <input className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={500} />}
      {f.type === 'area' && <textarea className="textarea" value={value || ''} onChange={(e) => onChange(e.target.value)} maxLength={4000} />}
      {f.type === 'number' && <input className="input" inputMode="decimal" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 260 }} />}
      {f.type === 'date' && <input className="input" type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 260 }} />}
      {showOther && <input className="input" value={other || ''} onChange={(e) => onOther(e.target.value)} placeholder="Otros: especifica" maxLength={300} />}
    </div>
  );
}

export default function ConsultWizard({ member, onDone }) {
  const toast = useToast();
  const hist = useDoc(`members/${member.id}/clinical/history`);
  const adm = useDoc('settings/admin');
  const pub = usePublicSettings();
  const reviewWeeks = pub?.team?.reviewWeeks || 3;
  const form = useMemo(() => mergeClinicalForm(adm.data?.clinicalForm), [adm.data]);
  const SECTIONS = useMemo(() => activeClinicalSections(form), [form]);
  const BODY_FIELDS = useMemo(() => activeBodyFields(form), [form]);
  const STEPS = useMemo(() => [{ key: 'perfil', title: 'Perfil' }, { key: 'bascula', title: 'Báscula y medidas' }, ...SECTIONS.map((s) => ({ key: s.key, title: s.title }))], [SECTIONS]);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [body, setBody] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data || hist.loading || adm.loading) return;
    const h = hist.data || {};
    setData(Object.fromEntries(form.sections.map((s) => [s.key, h[s.key] || {}])));
    setBody({ date: todayISO(), heightCm: member.heightCm || '', weightKg: member.weightKg || '', ...(h.body || {}) });
    setProfile({
      firstName: member.firstName || '', lastName: member.lastName || '', birthDate: member.birthDate || '', sex: member.sex || '',
      phone: member.phone || '', email: member.email || '', reason: member.reason || '', goal: member.goal || '', goalOther: member.goalOther || '',
      goalWeight: member.goalWeight || '', activityLevel: member.activityLevel || '',
      diseases: member.diseases || '', medications: member.medications || '', allergies: member.allergies || '', injuries: member.injuries || '',
    });
  }, [hist.loading, adm.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const b = useMemo(() => body && bmi(body.weightKg, body.heightCm), [body]);
  if (!data || !profile || !body) return <div className="skeleton" style={{ height: 300 }} />;

  const cur = STEPS[Math.min(step, STEPS.length - 1)];
  const section = SECTIONS.find((s) => s.key === cur.key);
  const setVal = (k, v) => setData((d) => ({ ...d, [cur.key]: { ...(d[cur.key] || {}), [k]: v } }));
  const setP = (k) => (e) => setProfile((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const setB = (k) => (e) => setBody((x) => ({ ...x, [k]: e.target.value }));

  async function saveStep() {
    if (cur.key === 'perfil') {
      await updateDoc(doc(db, 'members', member.id), { ...profile, email: profile.email.trim().toLowerCase() });
    } else if (cur.key === 'bascula') {
      const clean = { date: body.date || todayISO() };
      for (const f of BODY_FIELDS) clean[f.key] = num(body[f.key]);
      for (const k of ['weightKg', 'heightCm']) if (!(k in clean)) clean[k] = num(body[k]);
      clean.bmi = bmi(clean.weightKg, clean.heightCm);
      const bodyLabels = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, `${f.label}${f.unit ? `|${f.unit}` : ''}`]));
      await setDoc(doc(db, 'members', member.id, 'clinical', 'history'), { body: clean, _bodyLabels: bodyLabels, updatedAt: serverTimestamp() }, { merge: true });
      // Se guarda también como registro de progreso de esa fecha
      await setDoc(doc(db, 'members', member.id, 'progress', `consulta-${clean.date}`), { ...clean, notes: 'Medición en consulta', by: 'admin', createdAt: serverTimestamp() }, { merge: true });
      const patch = {};
      for (const k of ['weightKg', 'heightCm']) if (clean[k] != null) patch[k] = clean[k];
      if (Object.keys(patch).length) await updateDoc(doc(db, 'members', member.id), patch);
    } else {
      const labels = { title: section.title, fields: Object.fromEntries(section.fields.map((f) => [f.key, f.label])) };
      await setDoc(doc(db, 'members', member.id, 'clinical', 'history'), { [cur.key]: data[cur.key] || {}, _labels: { [cur.key]: labels }, updatedAt: serverTimestamp() }, { merge: true });
    }
  }

  async function next(dir = 1) {
    setBusy(true);
    try {
      await saveStep();
      if (dir > 0 && step === STEPS.length - 1) await finish();
      else setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + dir)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  }

  // Al saltar a otro paso también se guarda lo capturado
  async function goTo(i) {
    setBusy(true);
    try { await saveStep(); setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  }

  async function finish() {
    const ac = data.acuerdos || {}, nu = data.nutricion || {}, ob = data.objetivos || {}, act = data.actividad || {};
    const consultDate = ac.consultDate || body.date || todayISO();
    const patch = { lastVisit: consultDate, nextReview: ac.nextReview || addDays(consultDate, reviewWeeks * 7), clinicalStatus: ac.status || 'Completada' };
    if (ob.goal && CLINICAL_GOAL_KEY[ob.goal]) patch.goal = CLINICAL_GOAL_KEY[ob.goal];
    if (nu.mealsPerDay) patch.mealsPerDay = nu.mealsPerDay;
    if (act.days) patch.trainingDays = { '0 a 1': '2', '2 a 3': '3', '4 a 5': '5', '6 a 7': '6' }[act.days];
    if (act.experience) patch.trainingExperience = act.experience.startsWith('Principiante') ? 'principiante' : act.experience.includes('1 año') ? 'avanzado' : 'intermedio';
    if (!profile.activityLevel && act.days) patch.activityLevel = { '0 a 1': 'sedentaria', '2 a 3': 'ligera', '4 a 5': 'moderada', '6 a 7': 'alta' }[act.days];
    if (nu.allergies && !profile.allergies) patch.allergies = nu.allergies;
    await updateDoc(doc(db, 'members', member.id), patch);
    toast({ title: 'Consulta guardada', body: `Próxima revisión: ${fmtDate(patch.nextReview)}. La IA ya puede usar este historial.` }, 'ok');
    onDone?.();
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="wizard-steps" role="tablist">
        {STEPS.map((s, i) => (
          <button key={s.key} type="button" className={cx('wstep', i === step && 'on', i < step && 'done')} onClick={() => !busy && i !== step && goTo(i)}>
            <span>{i + 1}</span>{s.title}
          </button>
        ))}
      </div>

      <div className="card stack fade-in" key={cur.key}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>{step + 1}. {cur.title}</h3>
          <span className="tiny muted">Nada es obligatorio · se guarda al avanzar</span>
        </div>

        {cur.key === 'perfil' && (
          <div className="grid g2">
            <Field label="Nombre(s)"><input className="input" value={profile.firstName} onChange={setP('firstName')} /></Field>
            <Field label="Apellidos"><input className="input" value={profile.lastName} onChange={setP('lastName')} /></Field>
            <Field label="Fecha de nacimiento" hint={ageFrom(profile.birthDate) != null ? `${ageFrom(profile.birthDate)} años` : ''}><input className="input" type="date" value={profile.birthDate} onChange={setP('birthDate')} /></Field>
            <Field label="Sexo"><Choice options={{ femenino: 'Femenino', masculino: 'Masculino' }} value={profile.sex} onChange={setP('sex')} /></Field>
            <Field label="Teléfono / WhatsApp"><input className="input" value={profile.phone} onChange={setP('phone')} /></Field>
            <Field label="Correo (para entrar con Google)"><input className="input" type="email" value={profile.email} onChange={setP('email')} /></Field>
            <Field label="Objetivo"><select className="select" value={profile.goal} onChange={setP('goal')}><option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Peso meta (kg)"><input className="input" inputMode="decimal" value={profile.goalWeight} onChange={setP('goalWeight')} /></Field>
            <Field label="Actividad física diaria" className="span2"><select className="select" value={profile.activityLevel} onChange={setP('activityLevel')}><option value="">—</option>{Object.entries(ACTIVITY).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}</select></Field>
            <Field label="Motivo de consulta" className="span2"><textarea className="textarea" value={profile.reason} onChange={setP('reason')} /></Field>
            <Field label="Enfermedades (lo que dijo al reservar)"><input className="input" value={profile.diseases} onChange={setP('diseases')} /></Field>
            <Field label="Medicamentos"><input className="input" value={profile.medications} onChange={setP('medications')} /></Field>
            <Field label="Alergias / intolerancias"><input className="input" value={profile.allergies} onChange={setP('allergies')} /></Field>
            <Field label="Lesiones o condiciones"><input className="input" value={profile.injuries} onChange={setP('injuries')} /></Field>
          </div>
        )}

        {cur.key === 'bascula' && (
          <>
            <div className="grid g4">
              <Field label="Fecha de medición" className="span2"><input className="input" type="date" max={todayISO()} value={body.date} onChange={setB('date')} /></Field>
              <div className="card soft stat span2" style={{ padding: 14 }}><span className="l">IMC</span><span className="v">{b ?? '—'}</span><span className="tiny muted">{bmiLabel(b)}</span></div>
              {BODY_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}>
                  <input className="input" inputMode="decimal" value={body[f.key] ?? ''} onChange={setB(f.key)} />
                </Field>
              ))}
            </div>
            {(() => {
              const cfg = mergeEnergy(adm.data?.energy);
              const q = computeEnergy(personData({ ...member, ...profile }, { body }), { goal: profile.goal || member.goal || 'mantener' }, cfg);
              return q.ok ? (
                <div className="notice small energy-mini">
                  <b>Cálculo rápido ({FORMULAS[cfg.formula].split(' (')[0]}):</b>
                  <span>GEB {q.geb} kcal</span><span>GET {q.get} kcal</span><span>Consumir ≈ <b>{q.vct} kcal</b></span><span>Agua {q.water} L</span>
                  <span className="muted">Ajusta todo en la pestaña Cálculo al terminar.</span>
                </div>
              ) : <div className="notice small">Con peso, estatura, sexo y fecha de nacimiento verás aquí las calorías del paciente.</div>;
            })()}
            <ProgressPhotos member={member} by="admin" />
          </>
        )}

        {section && (
          <div className="stack" style={{ gap: 18 }}>
            {!section.fields.length && <p className="small muted">Esta sección no tiene preguntas activas. Puedes agregarlas en Ajustes → Historial clínico.</p>}
            {section.fields.filter((f) => !f.showIf || (data[cur.key] || {})[f.showIf[0]] === f.showIf[1]).map((f) => (
              <ClinicalField key={f.key} f={f} value={(data[cur.key] || {})[f.key]} other={(data[cur.key] || {})[f.key + 'Other']}
                onChange={(v) => setVal(f.key, v)} onOther={(v) => setVal(f.key + 'Other', v)} />
            ))}
          </div>
        )}
      </div>

      <div className="row between wizard-nav">
        <button className="btn ghost" disabled={busy || step === 0} onClick={() => next(-1)}><Icon name="arrowL" size={18} /> Anterior</button>
        <button className="btn" disabled={busy} onClick={() => next(1)}>
          {busy ? <Spinner /> : step === STEPS.length - 1 ? <>Terminar consulta <Icon name="check" size={18} /></> : <>Siguiente <Icon name="arrowR" size={18} /></>}
        </button>
      </div>
    </div>
  );
}
