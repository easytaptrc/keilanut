import { useState } from 'react';
import { Badge, Empty, ExerciseAnim, Icon, Modal, Ring, useToast } from './ui';
import { EXERCISES, EXERCISE_MAP, GROUPS, groupLabel } from '../data/exercises';
import { STATIC_PAGES, foodPhoto, suppImg, tipImg } from '../data/planAssets';
import { GOALS, cx, fmtDate } from '../lib/utils';
import { normalizeDiet, normalizeRoutine } from '../lib/plans';
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

/** Imagen que se amplía al tocarla */
function ZoomImage({ src, alt, className }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx('zoom-img', className)} onClick={() => setOpen(true)} aria-label={`Ampliar ${alt}`}><img src={src} alt={alt} loading="lazy" /></button>
      {open && <Modal wide title={alt} onClose={() => setOpen(false)}><img src={src} alt={alt} style={{ width: '100%', borderRadius: 12 }} /></Modal>}
    </>
  );
}

function MealCard({ m }) {
  const snack = m.slot?.startsWith('SNACK');
  return (
    <div className={cx('kmeal', snack && 'snack')}>
      {m.photo && !snack && <img className="kmeal-photo" src={foodPhoto(m.photo)} alt={m.title} loading="lazy" />}
      <div className="kmeal-body">
        <div className={snack ? 'snack-pill' : 'kmeal-slot'}>{m.slot}</div>
        {m.title && <div className="kmeal-title">{m.title}</div>}
        {(m.sections || []).map((s, i) => (
          <div key={i} className="kmeal-sec">
            {s.label && <i>{s.label}:</i>}
            <ul>{(s.items || []).filter(Boolean).map((it, j) => <li key={j}>{it}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DietView({ diet: raw, updatedAt }) {
  const diet = normalizeDiet(raw);
  const [day, setDay] = useState(() => Math.min(Math.max(0, new Date().getDay() - 1), Math.max(0, (diet?.days?.length || 1) - 1)));
  if (!diet || (!diet.days?.length && !raw?.file)) return <Empty icon="🥗" title="Tu dieta está en preparación">Keila la publicará pronto y te llegará una notificación.</Empty>;
  const m = diet.macros || {};
  const d = diet.days[day];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card ai-glow">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="eyebrow">{GOALS[diet.goal] || 'Plan personalizado'}</div>
            <h2 style={{ marginTop: 6 }}>{diet.title}</h2>
            <div className="small muted">
              {diet.checkFrom && diet.checkTo ? <>Check del {fmtDate(diet.checkFrom, { day: 'numeric', month: 'long' })} al {fmtDate(diet.checkTo, { day: 'numeric', month: 'long' })}</> : updatedAt ? <>Actualizado {fmtDate(updatedAt)}</> : null}
              {diet.nextChange && <> · Cambio de plan: <b>{fmtDate(diet.nextChange)}</b></>}
            </div>
          </div>
          {diet.calories ? <Ring value={1} max={1} label={diet.calories} sub="kcal / día" /> : null}
        </div>
        {(m.protein || diet.waterLiters) && (
          <div className="row small mt" style={{ gap: 14 }}>
            {m.protein ? <span><b style={{ color: 'var(--wine)' }}>●</b> Proteína {m.protein} g</span> : null}
            {m.carbs ? <span><b style={{ color: 'var(--mocha)' }}>●</b> Carbohidratos {m.carbs} g</span> : null}
            {m.fat ? <span><b style={{ color: 'var(--sage)' }}>●</b> Grasas {m.fat} g</span> : null}
            {diet.waterLiters ? <span>💧 Agua {diet.waterLiters} L</span> : null}
          </div>
        )}
      </div>

      {diet.dailyTip?.text && (
        <div className="kraft-band">
          {diet.dailyTip.image && <img src={tipImg(diet.dailyTip.image)} alt="" />}
          <p><b>Inicia tu día todos los días con:</b> {diet.dailyTip.text}</p>
        </div>
      )}

      <PdfAttachment file={raw?.file} />

      {!!diet.days?.length && (
        <>
          <div className="tabs">{diet.days.map((x, i) => <button key={i} className={cx('tab', i === day && 'on')} onClick={() => setDay(i)}>{x.day}</button>)}</div>
          {d && (
            <div className="stack fade-in" key={day} style={{ gap: 14 }}>
              <h2 className="day-title">{d.day}</h2>
              {d.tip?.text && <div className="kraft-band small">{d.tip.image && <img src={tipImg(d.tip.image)} alt="" />}<p>{d.tip.text}</p></div>}
              <div className="kmeal-grid">{d.meals.map((meal, i) => <MealCard key={i} m={meal} />)}</div>
            </div>
          )}
        </>
      )}

      {!!diet.supplements?.length && (
        <div className="card stack">
          <h3 className="kheading">Suplementos <span>sugeridos</span></h3>
          <div className="supp-grid">
            {diet.supplements.map((s, i) => (
              <div key={i} className="supp-card">
                {suppImg(s.key) && <img src={suppImg(s.key)} alt={s.name} loading="lazy" />}
                <b>{s.name}</b><span className="tiny muted">{s.when}</span><span className="small">{s.dose}</span>
              </div>
            ))}
          </div>
          {diet.waterLiters ? <p className="small" style={{ margin: 0 }}><b>Agua:</b> {diet.waterLiters} litros al día.</p> : null}
        </div>
      )}

      {!!diet.recommendations?.filter(Boolean).length && (
        <div className="card flat">
          <h3 className="kheading">Recomendaciones</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{diet.recommendations.filter(Boolean).map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}</ul>
        </div>
      )}
      {!!diet.avoid?.filter(Boolean).length && <div className="notice"><b>Evitar:</b> {diet.avoid.filter(Boolean).join(', ')}</div>}

      <div className="card stack">
        <h3 className="kheading">Productos <span>recomendados</span></h3>
        <p className="small muted" style={{ margin: 0 }}>Son las marcas con mejor contenido nutricional. Toca una imagen para verla completa.</p>
        <div className="grid g2">
          <ZoomImage src={STATIC_PAGES.marcas1} alt="Marcas recomendadas: lácteos y cereales" />
          <ZoomImage src={STATIC_PAGES.marcas2} alt="Marcas recomendadas: aderezos y extras" />
          <ZoomImage src={STATIC_PAGES.guiaVisual} alt="Guía visual de porciones" />
          <ZoomImage src={STATIC_PAGES.necesitas} alt="Lo que necesitas para medir tus porciones" />
        </div>
      </div>
      {diet.notes && <p className="small muted">{diet.notes}</p>}
    </div>
  );
}

export function ExerciseModal({ ex, item, onClose }) {
  const e = EXERCISE_MAP[ex] || null;
  return (
    <Modal title={item?.name || e?.name || 'Ejercicio'} onClose={onClose}>
      <ExerciseAnim id={e?.id} smooth />
      <div className="row mt">
        {e && <Badge tone="sage">{groupLabel(e.group)}</Badge>}
        {e && <Badge plain>{e.equipment}</Badge>}
      </div>
      {item?.detail && <div className="notice mt">{item.detail}</div>}
      {e?.tip && <p className="mt"><b>Técnica:</b> {e.tip}</p>}
    </Modal>
  );
}

export function RoutineView({ routine: raw, updatedAt }) {
  const routine = normalizeRoutine(raw);
  const [day, setDay] = useState(0);
  const [open, setOpen] = useState(null);
  if (!routine || (!routine.days?.length && !raw?.file)) return <Empty icon="🏋️" title="Tu rutina está en preparación">Mientras tanto, explora la biblioteca de ejercicios.</Empty>;
  const d = routine.days?.[day];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card ai-glow">
        <div className="eyebrow">{GOALS[routine.goal] || 'Entrenamiento'}</div>
        <h2 style={{ marginTop: 6 }}>{routine.title}</h2>
        <div className="row small muted">
          <span>{routine.daysPerWeek || routine.days?.length} días/semana</span>·<span>Nivel {routine.level}</span>
          {routine.schedule && <>·<span>{routine.schedule}</span></>}
          {updatedAt && <>·<span>Actualizada {fmtDate(updatedAt)}</span></>}
        </div>
      </div>
      <PdfAttachment file={raw?.file} />
      {!!routine.days?.length && (
        <>
          <div className="tabs">{routine.days.map((x, i) => <button key={i} className={cx('tab', i === day && 'on')} onClick={() => setDay(i)}>{x.name || `Día ${i + 1}`}</button>)}</div>
          {d && (
            <div className="stack fade-in" key={day} style={{ gap: 14 }}>
              <div className="rday-title">{d.name}</div>
              {d.warmup && <p className="small" style={{ margin: 0 }}>{d.warmup}</p>}
              {d.blocks.map((b, i) => (
                <div key={i} className="rblock">
                  <div className="rblock-head"><b>{b.kind}</b><Badge tone="sage" plain>{b.sets} series</Badge></div>
                  <div className="grid g2">
                    {b.exercises.map((x, j) => (
                      <button type="button" className="ex-row" key={j} onClick={() => setOpen(x)}>
                        <ExerciseAnim id={x.exerciseId} tag={false} />
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <b style={{ fontSize: '0.92rem' }}>{x.name || EXERCISE_MAP[x.exerciseId]?.name}</b>
                          {x.detail && <div className="tiny muted" style={{ marginTop: 4 }}>{x.detail}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {d.cardio && <div className="notice">❤️ <b>Cardio:</b> {d.cardio}</div>}
            </div>
          )}
        </>
      )}
      {routine.notes && <div className="card flat small" style={{ whiteSpace: 'pre-wrap' }}>{routine.notes}</div>}
      <div className="card stack">
        <h3 className="kheading">Indicaciones y <span>conceptos</span></h3>
        <div className="grid g3">
          <ZoomImage src={STATIC_PAGES.rutinaIndicaciones} alt="Indicaciones de entrenamiento" className="tall" />
          <ZoomImage src={STATIC_PAGES.rutinaConceptos1} alt="Conceptos: series" className="tall" />
          <ZoomImage src={STATIC_PAGES.rutinaConceptos2} alt="Conceptos: fases mecánicas" className="tall" />
        </div>
      </div>
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
      <div className="grow" style={{ position: 'relative' }}>
        <input className="input" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
        <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
      </div>
      {!q && <div className="tabs">{GROUPS.map((x) => <button key={x.key} className={cx('tab', g === x.key && 'on')} onClick={() => setG(x.key)}>{x.label}</button>)}</div>}
      <div className="ex-grid stagger" key={g + q}>
        {list.map((e) => (
          <button type="button" className="ex-card" key={e.id} onClick={() => (onPick ? onPick(e) : setOpen(e.id))}>
            <ExerciseAnim id={e.id} />
            <div className="nm">{e.name}</div>
            <div className="eq">{q ? groupLabel(e.group) + ' · ' : ''}{e.equipment}</div>
          </button>
        ))}
      </div>
      {!list.length && <Empty icon="🔎">No encontramos ese ejercicio.</Empty>}
      {open && <ExerciseModal ex={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
