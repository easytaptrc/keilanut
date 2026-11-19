import { EXERCISES, EXERCISE_MAP, GROUPS } from '../data/exercises';
import { GOALS } from '../lib/utils';
import { ExerciseAnim, Field, Icon } from './ui';

const lines = (arr) => (arr || []).join('\n');
const unlines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function Mover({ list, i, onChange }) {
  const move = (d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const c = [...list];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  return (
    <div className="row nowrap" style={{ gap: 4 }}>
      <button type="button" className="btn link xs" onClick={() => move(-1)} aria-label="Subir">↑</button>
      <button type="button" className="btn link xs" onClick={() => move(1)} aria-label="Bajar">↓</button>
      <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
    </div>
  );
}

export function DietEditor({ value, onChange }) {
  const v = value;
  const set = (k, x) => onChange({ ...v, [k]: x });
  const setMeal = (i, m) => set('meals', v.meals.map((x, k) => (k === i ? m : x)));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid g2">
        <Field label="Título"><input className="input" value={v.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Objetivo">
          <select className="select" value={v.goal || ''} onChange={(e) => set('goal', e.target.value)}>
            <option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid g4">
        <Field label="Calorías (kcal)"><input className="input" inputMode="numeric" value={v.calories ?? ''} onChange={(e) => set('calories', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
        {['protein', 'carbs', 'fat'].map((k) => (
          <Field key={k} label={{ protein: 'Proteína (g)', carbs: 'Carbohidratos (g)', fat: 'Grasas (g)' }[k]}>
            <input className="input" inputMode="numeric" value={v.macros?.[k] ?? ''} onChange={(e) => set('macros', { ...v.macros, [k]: e.target.value === '' ? '' : Number(e.target.value) })} />
          </Field>
        ))}
        <Field label="Agua (L)"><input className="input" inputMode="decimal" value={v.waterLiters ?? ''} onChange={(e) => set('waterLiters', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
      </div>

      <div className="stack">
        <div className="row between"><h4 style={{ margin: 0 }}>Comidas</h4>
          <button type="button" className="btn light sm" onClick={() => set('meals', [...(v.meals || []), { name: 'Nueva comida', time: '', items: [{ food: '', qty: '' }], notes: '' }])}><Icon name="plus" size={16} /> Comida</button>
        </div>
        {(v.meals || []).map((m, i) => (
          <div key={i} className="card flat stack" style={{ gap: 10, padding: 14 }}>
            <div className="row nowrap">
              <input className="input sm grow" value={m.name} onChange={(e) => setMeal(i, { ...m, name: e.target.value })} placeholder="Nombre" />
              <input className="input sm" style={{ width: 96 }} value={m.time} onChange={(e) => setMeal(i, { ...m, time: e.target.value })} placeholder="08:00" />
              <Mover list={v.meals} i={i} onChange={(x) => set('meals', x)} />
            </div>
            {(m.items || []).map((it, j) => (
              <div key={j} className="editor-row">
                <input className="input sm" value={it.food} placeholder="Alimento" onChange={(e) => setMeal(i, { ...m, items: m.items.map((x, k) => (k === j ? { ...x, food: e.target.value } : x)) })} />
                <input className="input sm" value={it.qty} placeholder="Cantidad" onChange={(e) => setMeal(i, { ...m, items: m.items.map((x, k) => (k === j ? { ...x, qty: e.target.value } : x)) })} />
                <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => setMeal(i, { ...m, items: m.items.filter((_, k) => k !== j) })}><Icon name="x" size={16} /></button>
              </div>
            ))}
            <div className="row between">
              <button type="button" className="btn link xs" onClick={() => setMeal(i, { ...m, items: [...(m.items || []), { food: '', qty: '' }] })}>+ Alimento</button>
            </div>
            <input className="input sm" value={m.notes || ''} placeholder="Notas / equivalentes" onChange={(e) => setMeal(i, { ...m, notes: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="grid g2">
        <Field label="Recomendaciones (una por línea)"><textarea className="textarea" value={lines(v.recommendations)} onChange={(e) => set('recommendations', unlines(e.target.value))} /></Field>
        <Field label="Evitar (una por línea)"><textarea className="textarea" value={lines(v.avoid)} onChange={(e) => set('avoid', unlines(e.target.value))} /></Field>
      </div>
      <Field label="Notas para el paciente"><textarea className="textarea" value={v.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
    </div>
  );
}

function ExerciseSelect({ value, onChange }) {
  return (
    <select className="select sm" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Ejercicio personalizado…</option>
      {GROUPS.map((g) => (
        <optgroup key={g.key} label={g.label}>
          {EXERCISES.filter((x) => x.group === g.key).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function RoutineEditor({ value, onChange }) {
  const v = value;
  const set = (k, x) => onChange({ ...v, [k]: x });
  const setDay = (i, d) => set('days', v.days.map((x, k) => (k === i ? d : x)));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid g4">
        <Field label="Título" className="span2"><input className="input" value={v.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Días/semana"><input className="input" inputMode="numeric" value={v.daysPerWeek ?? ''} onChange={(e) => set('daysPerWeek', Number(e.target.value) || '')} /></Field>
        <Field label="Nivel">
          <select className="select" value={v.level || ''} onChange={(e) => set('level', e.target.value)}>
            <option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
          </select>
        </Field>
      </div>
      <div className="grid g3">
        <Field label="Objetivo">
          <select className="select" value={v.goal || ''} onChange={(e) => set('goal', e.target.value)}>
            <option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Calentamiento"><input className="input" value={v.warmup || ''} onChange={(e) => set('warmup', e.target.value)} /></Field>
        <Field label="Enfriamiento"><input className="input" value={v.cooldown || ''} onChange={(e) => set('cooldown', e.target.value)} /></Field>
      </div>
      <div className="row between"><h4 style={{ margin: 0 }}>Días</h4>
        <button type="button" className="btn light sm" onClick={() => set('days', [...(v.days || []), { name: `Día ${(v.days?.length || 0) + 1}`, focus: '', cardio: '', exercises: [] }])}><Icon name="plus" size={16} /> Día</button>
      </div>
      {(v.days || []).map((d, i) => (
        <div key={i} className="card flat stack" style={{ gap: 10, padding: 14 }}>
          <div className="row nowrap">
            <input className="input sm grow" value={d.name} onChange={(e) => setDay(i, { ...d, name: e.target.value })} />
            <Mover list={v.days} i={i} onChange={(x) => set('days', x)} />
          </div>
          {(d.exercises || []).map((x, j) => {
            const upd = (patch) => setDay(i, { ...d, exercises: d.exercises.map((y, k) => (k === j ? { ...y, ...patch } : y)) });
            return (
              <div key={j} className="row nowrap" style={{ alignItems: 'flex-start', borderBottom: '1px dashed var(--line)', paddingBottom: 10 }}>
                <div style={{ width: 70, flex: 'none' }}><ExerciseAnim id={x.exerciseId} tag={false} /></div>
                <div className="grow stack" style={{ gap: 6 }}>
                  <ExerciseSelect value={x.exerciseId} onChange={(id) => upd({ exerciseId: id, name: EXERCISE_MAP[id]?.name || x.name })} />
                  {!x.exerciseId && <input className="input sm" placeholder="Nombre del ejercicio" value={x.name || ''} onChange={(e) => upd({ name: e.target.value })} />}
                  <div className="row nowrap" style={{ gap: 6 }}>
                    <input className="input sm" style={{ width: 64 }} placeholder="Series" value={x.sets ?? ''} onChange={(e) => upd({ sets: e.target.value })} />
                    <input className="input sm" style={{ width: 84 }} placeholder="Reps" value={x.reps ?? ''} onChange={(e) => upd({ reps: e.target.value })} />
                    <input className="input sm grow" placeholder="Descanso" value={x.rest ?? ''} onChange={(e) => upd({ rest: e.target.value })} />
                  </div>
                  <input className="input sm" placeholder="Notas (tempo, carga, técnica)" value={x.notes || ''} onChange={(e) => upd({ notes: e.target.value })} />
                </div>
                <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => setDay(i, { ...d, exercises: d.exercises.filter((_, k) => k !== j) })}><Icon name="trash" size={16} /></button>
              </div>
            );
          })}
          <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => setDay(i, { ...d, exercises: [...(d.exercises || []), { exerciseId: '', name: '', sets: 3, reps: '12', rest: '60 s', notes: '' }] })}>+ Ejercicio</button>
          <input className="input sm" placeholder="Cardio del día (opcional)" value={d.cardio || ''} onChange={(e) => setDay(i, { ...d, cardio: e.target.value })} />
        </div>
      ))}
      <Field label="Notas generales"><textarea className="textarea" value={v.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
    </div>
  );
}
