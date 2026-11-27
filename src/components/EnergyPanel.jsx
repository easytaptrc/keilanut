// Cálculo energético del paciente: GEB, GET, calorías objetivo, macronutrientes, cuadro dietosintético y sugerencias.
import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDoc, useProgress } from '../lib/hooks';
import { FORMULAS, GET_METHODS, adequacyTone, computeEnergy, exchangeTotals, mergeEnergy, personData } from '../lib/energy';
import { LEVEL_UI, patientSuggestions } from '../lib/suggestions';
import { notifyMember } from '../lib/admin';
import { ACTIVITY, GOALS, bmiLabel, cx, fmtDateTime } from '../lib/utils';
import { Badge, Field, Icon, Spinner, useToast } from './ui';

const num = (v) => (v === '' || v == null ? '' : String(v));
const fmt = (v, d = 0) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('es-MX', { maximumFractionDigits: d }));

export default function EnergyPanel({ member, compact = false }) {
  const toast = useToast();
  const cfg = mergeEnergy(useDoc('settings/admin').data?.energy);
  const hist = useDoc(`members/${member.id}/clinical/history`);
  const progress = useProgress(member.id).list;
  const clinical = hist.data;
  const [inp, setInp] = useState(null);
  const [counts, setCounts] = useState({});
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Carga lo guardado o valores por defecto de Ajustes
  useEffect(() => {
    if (inp || hist.loading) return;
    const saved = clinical?.energy?.inputs || {};
    setInp({
      formula: cfg.formula, method: cfg.method, etaPct: cfg.etaPct, afPct: cfg.afPct,
      activityLevel: member.activityLevel || 'ligera', activities: [{ name: cfg.mets[0]?.name || 'Pesas', met: cfg.mets[0]?.met || 5, minutes: 60, days: Number(member.trainingDays) || 3 }],
      goal: member.goal || 'mantener', adjustPct: '', vctOverride: '', pKg: '', cKg: '', sex: '', age: '', weight: '', height: '', bodyFat: '', useRealWeight: false,
      ...saved,
    });
    setCounts(clinical?.energy?.exchanges || {});
  }, [hist.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const person = useMemo(() => (inp ? personData(member, clinical, inp) : null), [member, clinical, inp]);
  const calc = useMemo(() => (inp && person ? computeEnergy(person, { ...inp, adjustPct: inp.adjustPct === '' ? undefined : inp.adjustPct }, cfg) : null), [person, inp, cfg]);
  const sugg = useMemo(() => patientSuggestions({ member: { ...member, goal: inp?.goal || member.goal }, clinical, calc, progress }), [member, clinical, calc, progress, inp?.goal]);
  if (!inp || !person) return <div className="skeleton" style={{ height: 300 }} />;

  const set = (k) => (e) => { setInp((x) => ({ ...x, [k]: e?.target ? e.target.value : e })); setDirty(true); };
  const setAct = (i, patch) => { setInp((x) => ({ ...x, activities: x.activities.map((a, k) => (k === i ? { ...a, ...patch } : a)) })); setDirty(true); };
  const mealCount = (key, mi) => counts[key]?.[mi] ?? '';
  const setCount = (key, mi, v) => { setCounts((c) => ({ ...c, [key]: { ...(c[key] || {}), [mi]: v.replace(',', '.').replace(/[^\d.]/g, '') } })); setDirty(true); };
  const totalOf = (key) => Math.round(Object.values(counts[key] || {}).reduce((s, v) => s + (Number(v) || 0), 0) * 100) / 100;
  const ex = exchangeTotals(Object.fromEntries(cfg.exchanges.map((e) => [e.key, totalOf(e.key)])), cfg.exchanges, calc?.ok ? calc : null);
  const anyCounts = cfg.exchanges.some((e) => totalOf(e.key) > 0);

  const save = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'members', member.id, 'clinical', 'history'), {
        energy: {
          inputs: inp, exchanges: counts, savedAt: serverTimestamp(),
          results: calc?.ok ? { geb: calc.geb, get: calc.get, vct: calc.vct, formula: inp.formula, method: inp.method, protein: calc.macros.p.g, carbs: calc.macros.c.g, fat: calc.macros.f.g, water: calc.water } : null,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setDirty(false); toast({ title: 'Cálculo guardado', body: 'Lo verás en el expediente, en la dieta (“Usar mi cálculo”) y la IA lo usará.' }, 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const sendSuggestions = async () => {
    const list = sugg.filter((_, i) => picked[i]);
    if (!list.length) return toast('Marca las sugerencias que quieres enviar', 'err');
    const body = list.map((s) => `• ${s.title}: ${s.text}`).join('\n');
    try {
      await notifyMember(member.id, { title: 'Recomendaciones de Keila 🌿', body, type: 'mensaje' });
      setPicked({}); toast(`Se enviaron ${list.length} sugerencias a ${member.firstName}`, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  const R = calc?.ok ? calc : null;
  return (
    <div className="stack energy" style={{ gap: 16 }}>
      {clinical?.energy?.savedAt && <div className="tiny muted">Último cálculo guardado: {fmtDateTime(clinical.energy.savedAt)}</div>}

      <div className="card stack">
        <h4 style={{ margin: 0 }}>1. Datos de {member.firstName}</h4>
        <p className="tiny muted" style={{ margin: 0 }}>Se toman de la báscula y del expediente. Si escribes un valor aquí, solo se usa para este cálculo.</p>
        <div className="grid g5 energy-data">
          <Field label="Sexo"><select className="select" value={inp.sex || member.sex || ''} onChange={set('sex')}><option value="">—</option><option value="femenino">Mujer</option><option value="masculino">Hombre</option></select></Field>
          <Field label="Edad" hint={!inp.age && person.age != null ? 'del expediente' : ''}><input className="input" inputMode="numeric" placeholder={num(person.age)} value={inp.age} onChange={set('age')} /></Field>
          <Field label="Peso (kg)"><input className="input" inputMode="decimal" placeholder={num(person.weight)} value={inp.weight} onChange={set('weight')} /></Field>
          <Field label="Estatura (cm)"><input className="input" inputMode="decimal" placeholder={num(person.height)} value={inp.height} onChange={set('height')} /></Field>
          <Field label="% grasa"><input className="input" inputMode="decimal" placeholder={num(person.bodyFat) || 'opcional'} value={inp.bodyFat} onChange={set('bodyFat')} /></Field>
        </div>
        {R && <div className="small">IMC <b>{R.bmi}</b> · {bmiLabel(R.bmi)}{R.idealWeight ? <> · Peso de referencia (IMC 22): <b>{R.idealWeight} kg</b></> : null}</div>}
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>2. Gasto energético</h4>
        <div className="grid g2">
          <Field label="Fórmula del gasto basal (GEB)"><select className="select" value={inp.formula} onChange={set('formula')}>{Object.entries(FORMULAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Cómo calcular el gasto total (GET)"><select className="select" value={inp.method} onChange={set('method')}>{Object.entries(GET_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <div className="formula-compare">
          {Object.entries(FORMULAS).map(([k, l]) => (
            <button type="button" key={k} className={cx('fc', inp.formula === k && 'on')} onClick={() => set('formula')(k)} disabled={!calc?.all?.[k]}>
              <span className="tiny">{l.split(' (')[0]}</span><b>{calc?.all?.[k] ? `${fmt(calc.all[k])} kcal` : 'faltan datos'}</b>
            </button>
          ))}
        </div>
        {inp.method === 'eta_af' && (
          <div className="grid g2">
            <Field label="Efecto térmico de los alimentos (% del GEB)"><input className="input" inputMode="decimal" value={inp.etaPct} onChange={set('etaPct')} /></Field>
            <Field label="Actividad física (% del GEB)" hint="Tu Excel usa 10%. Activa: 20–30% o más."><input className="input" inputMode="decimal" value={inp.afPct} onChange={set('afPct')} /></Field>
          </div>
        )}
        {inp.method === 'factor' && (
          <Field label="Nivel de actividad"><select className="select" value={inp.activityLevel} onChange={set('activityLevel')}>{Object.entries(ACTIVITY).map(([k, a]) => <option key={k} value={k}>{a.label} · ×{a.factor}</option>)}</select></Field>
        )}
        {inp.method === 'mets' && (
          <div className="stack" style={{ gap: 8 }}>
            <Field label="Efecto térmico de los alimentos (% del GEB)"><input className="input" style={{ maxWidth: 160 }} inputMode="decimal" value={inp.etaPct} onChange={set('etaPct')} /></Field>
            <span className="small"><b>Actividades</b> <span className="muted">(kcal = MET × 0.0175 × peso × minutos)</span></span>
            {inp.activities.map((a, i) => (
              <div key={i} className="met-row">
                <select className="select sm" value={a.name} onChange={(e) => { const m = cfg.mets.find((x) => x.name === e.target.value); setAct(i, { name: e.target.value, met: m?.met ?? a.met }); }}>
                  {[...new Set([...cfg.mets.map((m) => m.name), a.name])].map((nm) => <option key={nm}>{nm}</option>)}
                </select>
                <label className="tiny">MET<input className="input sm" inputMode="decimal" value={a.met} onChange={(e) => setAct(i, { met: e.target.value })} /></label>
                <label className="tiny">Min/sesión<input className="input sm" inputMode="numeric" value={a.minutes} onChange={(e) => setAct(i, { minutes: e.target.value })} /></label>
                <label className="tiny">Días/sem<input className="input sm" inputMode="numeric" value={a.days} onChange={(e) => setAct(i, { days: e.target.value })} /></label>
                <span className="tiny muted">{fmt(Number(a.met) * 0.0175 * (person.weight || 0) * Number(a.minutes))} kcal</span>
                <button type="button" className="icon-btn sm danger" aria-label="Quitar actividad" onClick={() => { setInp((x) => ({ ...x, activities: x.activities.filter((_, k) => k !== i) })); setDirty(true); }}><Icon name="trash" size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { setInp((x) => ({ ...x, activities: [...x.activities, { name: cfg.mets[1]?.name || 'Caminata', met: cfg.mets[1]?.met || 3.5, minutes: 30, days: 3 }] })); setDirty(true); }}>+ Agregar actividad</button>
          </div>
        )}
        {!R ? (
          <div className="notice small">Para calcular faltan: <b>{(calc?.missing || []).join(', ')}</b>. Captúralos en la Consulta (Perfil o Báscula) o escríbelos arriba.</div>
        ) : (
          <div className="energy-results">
            <div><span>GEB</span><b>{fmt(R.geb)}</b><small>kcal</small></div>
            <div><span>ETA</span><b>{fmt(R.eta)}</b><small>kcal</small></div>
            <div><span>Actividad</span><b>{fmt(R.af)}</b><small>kcal/día</small></div>
            <div className="hl"><span>GET</span><b>{fmt(R.get)}</b><small>kcal/día{R.getTrain ? ` · ${fmt(R.getTrain)} día de entreno` : ''}</small></div>
          </div>
        )}
      </div>

      {R && (
        <div className="card stack">
          <h4 style={{ margin: 0 }}>3. Calorías a consumir</h4>
          <div className="grid g3">
            <Field label="Objetivo"><select className="select" value={inp.goal} onChange={(e) => { setInp((x) => ({ ...x, goal: e.target.value, adjustPct: '', pKg: '', cKg: '' })); setDirty(true); }}>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Ajuste sobre el GET (%)" hint={`Por defecto ${cfg.goalAdjust[inp.goal] ?? 0}% para este objetivo`}><input className="input" inputMode="decimal" placeholder={String(cfg.goalAdjust[inp.goal] ?? 0)} value={inp.adjustPct} onChange={set('adjustPct')} /></Field>
            <Field label="Calorías finales (opcional)" hint={`Sugerido: ${fmt(R.suggested)} kcal`}><input className="input" inputMode="numeric" placeholder={String(R.suggested)} value={inp.vctOverride} onChange={set('vctOverride')} /></Field>
          </div>
          <div className="vct-card">
            <div><span className="eyebrow">Debe consumir</span><b>{fmt(R.vct)} kcal</b><small>al día ({R.adjust > 0 ? '+' : ''}{R.adjust}% del GET)</small></div>
            <div><span className="eyebrow">Agua</span><b>{R.water} L</b><small>al día</small></div>
          </div>
        </div>
      )}

      {R && (
        <div className="card stack">
          <h4 style={{ margin: 0 }}>4. Macronutrientes</h4>
          <div className="grid g3">
            <Field label="Proteína (g por kg)"><input className="input" inputMode="decimal" placeholder={String(cfg.macros[inp.goal]?.p ?? '')} value={inp.pKg} onChange={set('pKg')} /></Field>
            <Field label="Hidratos (g por kg)"><input className="input" inputMode="decimal" placeholder={String(cfg.macros[inp.goal]?.c ?? '')} value={inp.cKg} onChange={set('cKg')} /></Field>
            <div className="small muted" style={{ alignSelf: 'end' }}>Lípidos: lo que resta de las calorías (como tu Excel).</div>
          </div>
          {R.adjustedWeight && (
            <label className="row nowrap small"><input type="checkbox" checked={!!inp.useRealWeight} onChange={(e) => set('useRealWeight')(e.target.checked)} /> Usar el peso real ({person.weight} kg) en lugar del peso ajustado ({R.refWeight} kg) por IMC ≥ {cfg.adjustedWeightBmi}</label>
          )}
          <div className="table-wrap">
            <table className="tbl macro-table">
              <thead><tr><th>Nutrimento</th><th>g</th><th>kcal</th><th>%</th><th>g/kg</th></tr></thead>
              <tbody>
                {[['Proteína', R.macros.p], ['Hidratos de carbono', R.macros.c], ['Lípidos', R.macros.f]].map(([l, m]) => (
                  <tr key={l}><td>{l}</td><td><b>{fmt(m.g)}</b></td><td>{fmt(m.kcal)}</td><td>{fmt(m.pct, 1)}%</td><td>{fmt(m.gkg, 2)}</td></tr>
                ))}
                <tr className="tot"><td>Total</td><td /><td><b>{fmt(R.vct)}</b></td><td>100%</td><td /></tr>
              </tbody>
            </table>
          </div>
          {R.warnings.map((w) => <div key={w} className="notice small">⚠️ {w}</div>)}
        </div>
      )}

      {R && !compact && (
        <details className="card stack" open={anyCounts}>
          <summary className="row between" style={{ cursor: 'pointer' }}><h4 style={{ margin: 0 }}>5. Cuadro dietosintético (equivalentes)</h4><span className="tiny muted">opcional</span></summary>
          <p className="tiny muted" style={{ margin: 0 }}>Escribe cuántos equivalentes de cada grupo va en cada tiempo de comida. Abajo ves los totales y el % de adecuación (ideal 90–110%).</p>
          <div className="table-wrap">
            <table className="tbl eq-table">
              <thead><tr><th>Grupo</th>{cfg.meals.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
              <tbody>
                {cfg.exchanges.map((e) => (
                  <tr key={e.key}>
                    <td><b className="small">{e.group}</b>{e.sub && <div className="tiny muted">{e.sub}</div>}</td>
                    {cfg.meals.map((m, mi) => <td key={m}><input className="input xs" inputMode="decimal" value={mealCount(e.key, mi)} onChange={(ev) => setCount(e.key, mi, ev.target.value)} aria-label={`${e.group} ${e.sub} en ${m}`} /></td>)}
                    <td><b>{totalOf(e.key) || ''}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="energy-results eq-sum">
            {[['Energía', ex.kcal, R.vct, 'kcal', ex.adequacy?.kcal], ['Proteína', ex.p, R.macros.p.g, 'g', ex.adequacy?.p], ['Lípidos', ex.f, R.macros.f.g, 'g', ex.adequacy?.f], ['Hidratos', ex.c, R.macros.c.g, 'g', ex.adequacy?.c]].map(([l, v, t, u, a]) => (
              <div key={l} className={cx(anyCounts && adequacyTone(a))}><span>{l}</span><b>{fmt(v)} / {fmt(t)} {u}</b><small>{anyCounts && a != null && t > 0 ? `${a}% de adecuación` : '—'}</small></div>
            ))}
          </div>
        </details>
      )}

      {!compact && (
        <div className="card stack">
          <div className="row between">
            <h4 style={{ margin: 0 }}><Icon name="sparkle" size={18} /> Sugerencias para {member.firstName}</h4>
            <span className="tiny muted">Basadas en la báscula, el historial y el cálculo</span>
          </div>
          {!sugg.length ? <p className="small muted" style={{ margin: 0 }}>Completa la Consulta (báscula e historial) para ver sugerencias personalizadas.</p> : (
            <div className="sugg-list">
              {sugg.map((s, i) => (
                <label key={i} className={cx('sugg', s.level)}>
                  <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.checked }))} />
                  <div><div className="row nowrap" style={{ gap: 8 }}><Badge tone={LEVEL_UI[s.level].tone}>{LEVEL_UI[s.level].label}</Badge><b className="small">{s.title}</b></div><div className="small muted" style={{ marginTop: 4 }}>{s.text}</div></div>
                </label>
              ))}
            </div>
          )}
          {!!sugg.length && (
            <div className="row">
              <button type="button" className="btn light sm" onClick={() => setPicked(Object.fromEntries(sugg.map((s, i) => [i, s.level !== 'bien'])))}>Marcar todas</button>
              <button type="button" className="btn sage sm" onClick={sendSuggestions}><Icon name="bell" size={16} /> Enviar las marcadas a {member.firstName}</button>
            </div>
          )}
        </div>
      )}

      <div className="save-bar">
        {dirty && <span className="small" style={{ color: 'var(--warn)' }}>Cambios sin guardar</span>}
        <button className="btn" disabled={busy || !R} onClick={save}>{busy ? <Spinner /> : <Icon name="check" size={18} />} Guardar cálculo</button>
      </div>
    </div>
  );
}
