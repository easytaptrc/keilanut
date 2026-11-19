import { useState } from 'react';
import { Badge, Empty, ExerciseAnim, Icon, Modal, Ring, useToast } from './ui';
import { EXERCISES, EXERCISE_MAP, GROUPS, groupLabel } from '../data/exercises';
import { GOALS, cx, fmtDate } from '../lib/utils';
import { openFile } from '../lib/files';

export function PdfAttachment({ file }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!file?.id) return null;
  const go = async (dl) => {
    setBusy(true);
    try { await openFile(file.id, dl); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="card flat row between" style={{ padding: 14 }}>
      <div className="row nowrap"><span className="avatar" style={{ borderRadius: 12 }}><Icon name="file" /></span><div><b className="small">{file.name}</b><div className="tiny muted">PDF de Keila</div></div></div>
      <div className="row">
        <button className="btn light sm" disabled={busy} onClick={() => go(false)}><Icon name="eye" size={16} /> Ver</button>
        <button className="btn light sm" disabled={busy} onClick={() => go(true)}><Icon name="download" size={16} /> Descargar</button>
      </div>
    </div>
  );
}

export function DietView({ diet, updatedAt }) {
  if (!diet || (!diet.meals?.length && !diet.file)) return <Empty icon="🥗" title="Tu dieta está en preparación">Keila la publicará pronto y te llegará una notificación.</Empty>;
  const m = diet.macros || {};
  const kP = (m.protein || 0) * 4, kC = (m.carbs || 0) * 4, kF = (m.fat || 0) * 9;
  const tot = kP + kC + kF || 1;
  return (
    <div className="stack stagger" style={{ gap: 18 }}>
      <div className="card ai-glow">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="eyebrow">{GOALS[diet.goal] || diet.goal || 'Plan personalizado'}</div>
            <h2 style={{ marginTop: 6 }}>{diet.title}</h2>
            {updatedAt && <div className="tiny muted">Actualizado {fmtDate(updatedAt)}</div>}
          </div>
          {diet.calories ? <Ring value={1} max={1} label={diet.calories} sub="kcal / día" /> : null}
        </div>
        {tot > 1 && (
          <div className="mt">
            <div className="macro-bar">
              <div style={{ width: `${(kP / tot) * 100}%`, background: '#5e6f4f' }} />
              <div style={{ width: `${(kC / tot) * 100}%`, background: '#c9b48f' }} />
              <div style={{ width: `${(kF / tot) * 100}%`, background: '#9aa98a' }} />
            </div>
            <div className="row small mt" style={{ gap: 18 }}>
              <span><b style={{ color: '#5e6f4f' }}>●</b> Proteína {m.protein} g</span>
              <span><b style={{ color: '#c9b48f' }}>●</b> Carbohidratos {m.carbs} g</span>
              <span><b style={{ color: '#9aa98a' }}>●</b> Grasas {m.fat} g</span>
              {diet.waterLiters ? <span>💧 Agua {diet.waterLiters} L</span> : null}
            </div>
          </div>
        )}
      </div>
      <PdfAttachment file={diet.file} />
      <div className="grid g2">
        {(diet.meals || []).map((meal, i) => (
          <div className="meal" key={i}>
            <div className="meal-head"><h4>{meal.name}</h4>{meal.time && <Badge tone="sage" plain>{meal.time}</Badge>}</div>
            <ul>{(meal.items || []).map((it, j) => <li key={j}><span>{it.food}</span><span className="q">{it.qty}</span></li>)}</ul>
            {meal.notes && <div className="tiny muted" style={{ padding: '0 18px 14px' }}>{meal.notes}</div>}
          </div>
        ))}
      </div>
      {!!diet.recommendations?.length && (
        <div className="card flat">
          <h4>Recomendaciones</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{diet.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}</ul>
        </div>
      )}
      {!!diet.avoid?.filter(Boolean).length && <div className="notice"><b>Evitar:</b> {diet.avoid.filter(Boolean).join(', ')}</div>}
      {diet.notes && <p className="small muted">{diet.notes}</p>}
    </div>
  );
}

export function ExerciseModal({ ex, item, onClose }) {
  const e = EXERCISE_MAP[ex] || null;
  return (
    <Modal title={e?.name || item?.name || 'Ejercicio'} onClose={onClose}>
      <ExerciseAnim id={e?.id} smooth />
      <div className="row mt">
        {e && <Badge tone="sage">{groupLabel(e.group)}</Badge>}
        {e && <Badge plain>{e.equipment}</Badge>}
        {item?.sets && <Badge tone="info" plain>{item.sets} series × {item.reps}</Badge>}
        {item?.rest && <Badge plain>Descanso {item.rest}</Badge>}
      </div>
      {e?.tip && <p className="mt"><b>Técnica:</b> {e.tip}</p>}
      {item?.notes && <div className="notice">{item.notes}</div>}
    </Modal>
  );
}

export function RoutineView({ routine, updatedAt }) {
  const [day, setDay] = useState(0);
  const [open, setOpen] = useState(null);
  if (!routine || (!routine.days?.length && !routine.file)) return <Empty icon="🏋️" title="Tu rutina está en preparación">Mientras tanto, explora la biblioteca de ejercicios.</Empty>;
  const d = routine.days?.[day];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card ai-glow">
        <div className="eyebrow">{GOALS[routine.goal] || routine.goal || 'Entrenamiento'}</div>
        <h2 style={{ marginTop: 6 }}>{routine.title}</h2>
        <div className="row small muted">
          <span>{routine.daysPerWeek || routine.days?.length} días/semana</span>·<span>Nivel {routine.level}</span>
          {updatedAt && <>·<span>Actualizada {fmtDate(updatedAt)}</span></>}
        </div>
        {routine.warmup && <p className="small mt" style={{ marginBottom: 0 }}><b>Calentamiento:</b> {routine.warmup}</p>}
      </div>
      <PdfAttachment file={routine.file} />
      {!!routine.days?.length && (
        <>
          <div className="tabs">
            {routine.days.map((x, i) => <button key={i} className={cx('tab', i === day && 'on')} onClick={() => setDay(i)}>{x.name?.split('·')[0]?.trim() || `Día ${i + 1}`}</button>)}
          </div>
          {d && (
            <div className="stack fade-in" key={day}>
              <h3 style={{ margin: 0 }}>{d.name}</h3>
              <div className="grid g2 stagger">
                {(d.exercises || []).map((x, i) => (
                  <div className="ex-row" key={i} onClick={() => setOpen(x)}>
                    <ExerciseAnim id={x.exerciseId} tag={false} />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: '0.95rem' }}>{EXERCISE_MAP[x.exerciseId]?.name || x.name}</b>
                      <div className="sets">
                        <Badge tone="sage" plain>{x.sets} × {x.reps}</Badge>
                        {x.rest && <Badge plain>⏱ {x.rest}</Badge>}
                      </div>
                      {x.notes && <div className="tiny muted mt" style={{ marginTop: 6 }}>{x.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {d.cardio && <div className="notice">❤️ <b>Cardio:</b> {d.cardio}</div>}
            </div>
          )}
        </>
      )}
      {routine.cooldown && <p className="small"><b>Enfriamiento:</b> {routine.cooldown}</p>}
      {routine.notes && <p className="small muted">{routine.notes}</p>}
      {open && <ExerciseModal ex={open.exerciseId} item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function ExerciseLibrary({ onPick }) {
  const [g, setG] = useState('pecho');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = EXERCISES.filter((e) => (q ? e.name.toLowerCase().includes(q.toLowerCase()) : e.group === g));
  return (
    <div className="stack">
      <div className="row nowrap">
        <div className="grow" style={{ position: 'relative' }}>
          <input className="input" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
          <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
        </div>
      </div>
      {!q && (
        <div className="tabs">
          {GROUPS.map((x) => <button key={x.key} className={cx('tab', g === x.key && 'on')} onClick={() => setG(x.key)}>{x.label}</button>)}
        </div>
      )}
      <div className="ex-grid stagger" key={g + q}>
        {list.map((e) => (
          <div className="ex-card" key={e.id} onClick={() => (onPick ? onPick(e) : setOpen(e.id))}>
            <ExerciseAnim id={e.id} />
            <div className="nm">{e.name}</div>
            <div className="eq">{q ? groupLabel(e.group) + ' · ' : ''}{e.equipment}</div>
          </div>
        ))}
      </div>
      {!list.length && <Empty icon="🔎">No encontramos ese ejercicio.</Empty>}
      {open && <ExerciseModal ex={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
