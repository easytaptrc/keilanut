import { useState } from 'react';
import { EXERCISES, EXERCISE_MAP, GROUPS } from '../data/exercises';
import { BLOCK_KINDS, FOOD_PHOTOS, MEAL_SLOTS, SUPPLEMENTS, TIP_IMAGES, WEEK_DAYS, foodPhoto, suppImg, tipImg } from '../data/planAssets';
import { GOALS, cx } from '../lib/utils';
import { ExerciseAnim, Field, Icon, Modal } from './ui';

const lines = (arr) => (arr || []).join('\n');
const unlines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const move = (list, i, d) => { const j = i + d; if (j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; };

function Mover({ list, i, onChange, label = 'elemento' }) {
  return (
    <div className="row nowrap" style={{ gap: 2 }}>
      <button type="button" className="btn link xs" onClick={() => onChange(move(list, i, -1))} aria-label={`Subir ${label}`}>↑</button>
      <button type="button" className="btn link xs" onClick={() => onChange(move(list, i, 1))} aria-label={`Bajar ${label}`}>↓</button>
      <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => window.confirm(`¿Quitar ${label}?`) && onChange(list.filter((_, k) => k !== i))} aria-label={`Quitar ${label}`}><Icon name="trash" size={16} /></button>
    </div>
  );
}

function PhotoPicker({ value, onPick, onClose }) {
  const [q, setQ] = useState('');
  const list = FOOD_PHOTOS.filter((p) => !q || `${p.label} ${p.tags}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal wide title="Foto del platillo" onClose={onClose}>
      <input className="input mb" placeholder="Buscar: pollo, huevo, avena…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-grid">
        <button type="button" className={cx('pick', !value && 'on')} onClick={() => onPick('')}><div className="pick-none">Sin foto</div><span>Sin foto</span></button>
        {list.map((p) => (
          <button type="button" key={p.key} className={cx('pick', value === p.key && 'on')} onClick={() => onPick(p.key)}>
            <img src={foodPhoto(p.key)} alt="" loading="lazy" /><span>{p.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function EquivalentsEditor({ value, onChange }) {
  const setG = (i, patch) => onChange(value.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  return (
    <div className="card flat stack" style={{ padding: 14 }}>
      <div className="row between">
        <h4 style={{ margin: 0 }}>Tabla de equivalentes</h4>
        <button type="button" className="btn light sm" onClick={() => onChange([...value, { group: 'NUEVO GRUPO', portion: '1 PORCIÓN', items: [] }])}><Icon name="plus" size={16} /> Grupo</button>
      </div>
      {!value.length && <p className="tiny muted" style={{ margin: 0 }}>Opcional. Útil en planes por porciones (cereales, proteína, grasas, fruta, verdura…).</p>}
      <div className="equiv-grid">
        {value.map((g, i) => (
          <div key={i} className="equiv stack" style={{ gap: 6 }}>
            <div className="row nowrap">
              <input className="input sm grow" value={g.group} aria-label="Grupo" onChange={(e) => setG(i, { group: e.target.value.toUpperCase() })} />
              <button type="button" className="btn ghost xs" aria-label="Quitar grupo" onClick={() => onChange(value.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button>
            </div>
            <input className="input sm" value={g.portion || ''} placeholder="1 PORCIÓN" onChange={(e) => setG(i, { portion: e.target.value })} />
            <textarea className="textarea" rows={6} value={lines(g.items)} placeholder="Un alimento por renglón" onChange={(e) => setG(i, { items: e.target.value.split('\n') })} onBlur={(e) => setG(i, { items: unlines(e.target.value) })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionsEditor({ sections, onChange }) {
  const set = (i, patch) => onChange(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {sections.map((s, i) => (
        <div key={i} className="section-edit">
          <div className="row nowrap">
            <input className="input sm grow" value={s.label} placeholder="Título (Utilizar, Toppings, Opciones…)" onChange={(e) => set(i, { label: e.target.value })} />
            <Mover list={sections} i={i} onChange={onChange} label="sección" />
          </div>
          <textarea className="textarea sm" rows={Math.max(2, s.items.length)} value={lines(s.items)} placeholder="Un renglón por ingrediente o indicación" onChange={(e) => set(i, { items: e.target.value.split('\n') })} onBlur={(e) => set(i, { items: unlines(e.target.value) })} />
        </div>
      ))}
      <div className="row" style={{ gap: 4 }}>
        {['Utilizar', 'Elige solo una opción para acompañar', 'Toppings', 'Acompañar con'].map((l) => (
          <button type="button" key={l} className="btn link xs" onClick={() => onChange([...sections, { label: l, items: [] }])}>+ {l}</button>
        ))}
      </div>
    </div>
  );
}

export function DietEditor({ value, onChange }) {
  const v = value;
  const [day, setDay] = useState(0);
  const [photoFor, setPhotoFor] = useState(null);
  const set = (k, x) => onChange({ ...v, [k]: x });
  const days = v.days || [];
  const d = days[day];
  const setDayData = (patch) => set('days', days.map((x, k) => (k === day ? { ...x, ...patch } : x)));
  const setMeal = (i, patch) => setDayData({ meals: d.meals.map((m, k) => (k === i ? { ...m, ...patch } : m)) });

  const addDay = () => {
    const name = WEEK_DAYS[days.length] || `DÍA ${days.length + 1}`;
    set('days', [...days, { day: name, tip: { text: '', image: '' }, meals: ['ALMUERZO', 'COMIDA', 'CENA'].map((slot) => ({ slot, title: '', photo: '', sections: [{ label: 'Utilizar', items: [] }] })) }]);
    setDay(days.length);
  };
  const duplicateDay = () => {
    const copy = structuredClone(d);
    copy.day = WEEK_DAYS[days.length] || `DÍA ${days.length + 1}`;
    set('days', [...days, copy]);
    setDay(days.length);
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="grid g2">
        <Field label="Título del plan"><input className="input" value={v.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Objetivo"><select className="select" value={v.goal || ''} onChange={(e) => set('goal', e.target.value)}><option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <div className="grid g4">
        <Field label="Check del"><input className="input" type="date" value={v.checkFrom || ''} onChange={(e) => set('checkFrom', e.target.value)} /></Field>
        <Field label="Check al"><input className="input" type="date" value={v.checkTo || ''} onChange={(e) => set('checkTo', e.target.value)} /></Field>
        <Field label="Cambio de plan"><input className="input" type="date" value={v.nextChange || ''} onChange={(e) => set('nextChange', e.target.value)} /></Field>
        <Field label="Agua (L/día)"><input className="input" inputMode="decimal" value={v.waterLiters ?? ''} onChange={(e) => set('waterLiters', e.target.value)} /></Field>
        <Field label="Calorías (kcal)"><input className="input" inputMode="numeric" value={v.calories ?? ''} onChange={(e) => set('calories', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
        {['protein', 'carbs', 'fat'].map((k) => (
          <Field key={k} label={{ protein: 'Proteína (g)', carbs: 'Carbohidratos (g)', fat: 'Grasas (g)' }[k]}>
            <input className="input" inputMode="numeric" value={v.macros?.[k] ?? ''} onChange={(e) => set('macros', { ...v.macros, [k]: e.target.value === '' ? '' : Number(e.target.value) })} />
          </Field>
        ))}
      </div>

      <div className="card flat stack" style={{ padding: 14 }}>
        <h4 style={{ margin: 0 }}>Inicia tu día todos los días con…</h4>
        <div className="row nowrap">
          <input className="input grow" value={v.dailyTip?.text || ''} placeholder="Ej. Un shot de kéfir en ayunas (o una tableta de probióticos)." onChange={(e) => set('dailyTip', { ...v.dailyTip, text: e.target.value })} />
          <select className="select sm" style={{ width: 150 }} value={v.dailyTip?.image || ''} onChange={(e) => set('dailyTip', { ...v.dailyTip, image: e.target.value })}>
            <option value="">Sin imagen</option>{TIP_IMAGES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card flat stack" style={{ padding: 14 }}>
        <h4 style={{ margin: 0 }}>Suplementos sugeridos</h4>
        <div className="supp-pick">
          {SUPPLEMENTS.map((s) => {
            const on = (v.supplements || []).some((x) => x.key === s.key);
            return (
              <button type="button" key={s.key} className={cx('supp-chip', on && 'on')} onClick={() => set('supplements', on ? v.supplements.filter((x) => x.key !== s.key) : [...(v.supplements || []), { key: s.key, name: s.name, when: 'En ayunas', dose: s.dose }])}>
                <img src={suppImg(s.key)} alt="" loading="lazy" /><span>{s.name}</span>
              </button>
            );
          })}
        </div>
        {(v.supplements || []).map((s, i) => (
          <div key={s.key + i} className="supp-row">
            <img src={suppImg(s.key)} alt="" />
            <input className="input sm" value={s.name} onChange={(e) => set('supplements', v.supplements.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <select className="select sm" value={s.when} onChange={(e) => set('supplements', v.supplements.map((x, k) => (k === i ? { ...x, when: e.target.value } : x)))}>
              {[...new Set(['En ayunas', 'Después del desayuno', 'Antes de entrenar', 'Después de entrenar', 'Con la comida', 'Antes de dormir', s.when].filter(Boolean))].map((w) => <option key={w}>{w}</option>)}
            </select>
            <input className="input sm" value={s.dose} placeholder="Dosis" onChange={(e) => set('supplements', v.supplements.map((x, k) => (k === i ? { ...x, dose: e.target.value } : x)))} />
          </div>
        ))}
      </div>

      <div className="stack">
        <div className="row between">
          <div className="tabs">
            {days.map((x, i) => <button key={i} type="button" className={cx('tab', i === day && 'on')} onClick={() => setDay(i)}>{x.day || `Día ${i + 1}`}</button>)}
          </div>
          <div className="row">
            {d && <button type="button" className="btn light sm" onClick={duplicateDay}><Icon name="copy" size={16} /> Duplicar día</button>}
            <button type="button" className="btn light sm" onClick={addDay}><Icon name="plus" size={16} /> Día</button>
          </div>
        </div>
        {!d ? <p className="muted small">Agrega el primer día del plan.</p> : (
          <div className="card flat stack fade-in" key={day} style={{ padding: 14 }}>
            <div className="row nowrap">
              <input className="input grow" value={d.day} onChange={(e) => setDayData({ day: e.target.value.toUpperCase() })} aria-label="Nombre del día" />
              <Mover list={days} i={day} onChange={(x) => { set('days', x); setDay(0); }} label="día" />
            </div>
            <div className="row nowrap">
              <input className="input sm grow" value={d.tip?.text || ''} placeholder="Tip del día (ej. Puedes acompañar una comida con agua de jamaica…)" onChange={(e) => setDayData({ tip: { ...d.tip, text: e.target.value } })} />
              <select className="select sm" style={{ width: 150 }} value={d.tip?.image || ''} onChange={(e) => setDayData({ tip: { ...d.tip, image: e.target.value } })}>
                <option value="">Sin imagen</option>{TIP_IMAGES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {d.tip?.image && <img src={tipImg(d.tip.image)} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />}
            </div>
            <input className="input sm" value={d.note || ''} placeholder="Nota del día (ej. Al terminar la opción 3 volver a repetir la opción 1)" onChange={(e) => setDayData({ note: e.target.value })} />
            {d.meals.map((m, i) => (
              <div key={i} className="meal-edit">
                <button type="button" className="meal-photo" onClick={() => setPhotoFor(i)} title="Cambiar foto">
                  {m.photo ? <img src={foodPhoto(m.photo)} alt="" /> : <span><Icon name="camera" size={20} /><br />Foto</span>}
                </button>
                <div className="stack grow" style={{ gap: 8, minWidth: 0 }}>
                  <div className="row meal-head">
                    <select className="select sm" style={{ maxWidth: 190 }} value={m.slot} onChange={(e) => setMeal(i, { slot: e.target.value })}>
                      {[...new Set([...MEAL_SLOTS, m.slot])].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <input className="input sm" style={{ width: 96 }} value={m.time || ''} placeholder="Hora" aria-label="Hora" onChange={(e) => setMeal(i, { time: e.target.value.toUpperCase() })} />
                    <input className="input sm grow" value={m.title} placeholder="Nombre del platillo" onChange={(e) => setMeal(i, { title: e.target.value.toUpperCase() })} />
                    <Mover list={d.meals} i={i} onChange={(x) => setDayData({ meals: x })} label="comida" />
                  </div>
                  <SectionsEditor sections={m.sections || []} onChange={(x) => setMeal(i, { sections: x })} />
                </div>
              </div>
            ))}
            <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => setDayData({ meals: [...d.meals, { slot: 'SNACK MEDIA TARDE', title: '', photo: '', sections: [{ label: 'Utilizar', items: [] }] }] })}>+ Agregar comida o snack</button>
          </div>
        )}
      </div>

      <div className="grid g2">
        <Field label="Recomendaciones (una por renglón)"><textarea className="textarea" value={lines(v.recommendations)} onChange={(e) => set('recommendations', e.target.value.split('\n'))} onBlur={(e) => set('recommendations', unlines(e.target.value))} /></Field>
        <Field label="Evitar (una por renglón)"><textarea className="textarea" value={lines(v.avoid)} onChange={(e) => set('avoid', e.target.value.split('\n'))} onBlur={(e) => set('avoid', unlines(e.target.value))} /></Field>
      </div>
      <Field label="Instrucciones (una por renglón)"><textarea className="textarea" value={lines(v.instructions)} onChange={(e) => set('instructions', e.target.value.split('\n'))} onBlur={(e) => set('instructions', unlines(e.target.value))} /></Field>
      <EquivalentsEditor value={v.equivalents || []} onChange={(x) => set('equivalents', x)} />
      <Field label="Notas para el paciente"><textarea className="textarea" value={v.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      {photoFor != null && d && <PhotoPicker value={d.meals[photoFor]?.photo} onClose={() => setPhotoFor(null)} onPick={(k) => { setMeal(photoFor, { photo: k }); setPhotoFor(null); }} />}
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
  const [day, setDay] = useState(0);
  const set = (k, x) => onChange({ ...v, [k]: x });
  const days = v.days || [];
  const d = days[day];
  const setDayData = (patch) => set('days', days.map((x, k) => (k === day ? { ...x, ...patch } : x)));
  const setBlock = (i, patch) => setDayData({ blocks: d.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="grid g4">
        <Field label="Título" className="span2"><input className="input" value={v.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Horario de entrenamiento"><input className="input" value={v.schedule || ''} placeholder="4:00 PM – 5:30 PM" onChange={(e) => set('schedule', e.target.value)} /></Field>
        <Field label="Nivel"><select className="select" value={v.level || ''} onChange={(e) => set('level', e.target.value)}><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></select></Field>
        <Field label="Objetivo" className="span2"><select className="select" value={v.goal || ''} onChange={(e) => set('goal', e.target.value)}><option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Días por semana"><input className="input" inputMode="numeric" value={v.daysPerWeek ?? ''} onChange={(e) => set('daysPerWeek', Number(e.target.value) || '')} /></Field>
      </div>
      <div className="row between">
        <div className="tabs">{days.map((x, i) => <button key={i} type="button" className={cx('tab', i === day && 'on')} onClick={() => setDay(i)}>{x.name || `Día ${i + 1}`}</button>)}</div>
        <button type="button" className="btn light sm" onClick={() => { set('days', [...days, { name: `DÍA ${days.length + 1}`, warmup: 'Estiramiento y calentamiento dinámico en la parte a trabajar.', blocks: [], cardio: '' }]); setDay(days.length); }}><Icon name="plus" size={16} /> Día</button>
      </div>
      {d && (
        <div className="card flat stack fade-in" key={day} style={{ padding: 14 }}>
          <div className="row nowrap">
            <input className="input grow" value={d.name} onChange={(e) => setDayData({ name: e.target.value.toUpperCase() })} aria-label="Nombre del día" />
            <Mover list={days} i={day} onChange={(x) => { set('days', x); setDay(0); }} label="día" />
          </div>
          <input className="input sm" value={d.warmup || ''} placeholder="Calentamiento" onChange={(e) => setDayData({ warmup: e.target.value })} />
          {d.blocks.map((b, i) => (
            <div key={i} className="block-edit">
              <input className="input sm" value={b.title || ''} placeholder="Sección (opcional, ej. HOMBRO, TRÍCEPS, PANTORRILLA (NEUTRO))" onChange={(e) => setBlock(i, { title: e.target.value.toUpperCase() })} />
              <div className="row block-head">
                <select className="select sm" style={{ flex: '1 1 150px', minWidth: 0 }} value={b.kind} onChange={(e) => setBlock(i, { kind: e.target.value })}>{[...new Set([...BLOCK_KINDS, b.kind])].map((k) => <option key={k}>{k}</option>)}</select>
                <input className="input sm" style={{ width: 80 }} inputMode="numeric" value={b.sets} onChange={(e) => setBlock(i, { sets: Number(e.target.value) || '' })} aria-label="Series" />
                <span className="tiny muted">series</span>
                <span className="grow hide-sm" />
                <Mover list={d.blocks} i={i} onChange={(x) => setDayData({ blocks: x })} label="bloque" />
              </div>
              {b.exercises.map((x, j) => {
                const upd = (patch) => setBlock(i, { exercises: b.exercises.map((y, k) => (k === j ? { ...y, ...patch } : y)) });
                return (
                  <div key={j} className="row nowrap" style={{ alignItems: 'flex-start' }}>
                    <div style={{ width: 64, flex: 'none' }}><ExerciseAnim id={x.exerciseId} tag={false} /></div>
                    <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                      <ExerciseSelect value={x.exerciseId} onChange={(id) => upd({ exerciseId: id, name: EXERCISE_MAP[id]?.name || x.name })} />
                      <input className="input sm" placeholder="Nombre como aparecerá" value={x.name || ''} onChange={(e) => upd({ name: e.target.value })} />
                      <textarea className="textarea sm" rows={2} placeholder="Indicaciones (repeticiones, tempo, aproximación…)" value={x.detail || ''} onChange={(e) => upd({ detail: e.target.value })} />
                    </div>
                    <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => setBlock(i, { exercises: b.exercises.filter((_, k) => k !== j) })} aria-label="Quitar ejercicio"><Icon name="x" size={16} /></button>
                  </div>
                );
              })}
              <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => setBlock(i, { exercises: [...b.exercises, { exerciseId: '', name: '', detail: '' }] })}>+ Ejercicio</button>
              <input className="input sm" value={b.note || ''} placeholder="Nota del bloque (opcional, ej. Descansar 30seg entre cada serie)" onChange={(e) => setBlock(i, { note: e.target.value })} />
            </div>
          ))}
          <div className="row" style={{ gap: 4 }}>
            {BLOCK_KINDS.map((k) => <button type="button" key={k} className="btn link xs" onClick={() => setDayData({ blocks: [...d.blocks, { kind: k, sets: 3, exercises: [{ exerciseId: '', name: '', detail: '' }] }] })}>+ {k}</button>)}
          </div>
          <input className="input sm" value={d.cardio || ''} placeholder="Cardio del día (opcional)" onChange={(e) => setDayData({ cardio: e.target.value })} />
          {(d.extras || []).map((x, k) => (
            <div key={k} className="card flat stack" style={{ padding: 10, gap: 6 }}>
              <div className="row nowrap">
                <input className="input sm grow" value={x.title || ''} placeholder="Título (ej. CARDIO, HIPOPRESIVOS)" onChange={(e) => setDayData({ extras: d.extras.map((y, n) => (n === k ? { ...y, title: e.target.value.toUpperCase() } : y)) })} />
                <button type="button" className="btn ghost xs" aria-label="Quitar sección" onClick={() => setDayData({ extras: d.extras.filter((_, n) => n !== k) })}><Icon name="x" size={14} /></button>
              </div>
              <textarea className="textarea sm" rows={3} value={lines(x.items)} placeholder="Un renglón por indicación" onChange={(e) => setDayData({ extras: d.extras.map((y, n) => (n === k ? { ...y, items: e.target.value.split('\n') } : y)) })} onBlur={(e) => setDayData({ extras: d.extras.map((y, n) => (n === k ? { ...y, items: unlines(e.target.value) } : y)) })} />
            </div>
          ))}
          <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => setDayData({ extras: [...(d.extras || []), { title: 'CARDIO', items: [] }] })}>+ Sección de texto (cardio, hipopresivos, intervalos…)</button>
        </div>
      )}
      <Field label="Indicaciones generales"><textarea className="textarea" value={v.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
    </div>
  );
}
