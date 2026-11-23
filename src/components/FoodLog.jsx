import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FOODS, FOOD_CATEGORIES } from '../data/foods';
import { addDaysISO } from '../lib/schedule';
import { cx, fmtDate, todayISO } from '../lib/utils';
import { Empty, Field, Icon, Modal, Spinner, useToast } from './ui';

export const LOG_MEALS = [
  { key: 'almuerzo', label: 'Almuerzo / desayuno' },
  { key: 'snack1', label: 'Snack de media mañana' },
  { key: 'comida', label: 'Comida' },
  { key: 'snack2', label: 'Snack de media tarde' },
  { key: 'cena', label: 'Cena' },
];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const RECENT_KEY = 'kg-recent-foods';
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const pushRecent = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...getRecent().filter((x) => x !== id)].slice(0, 12))); } catch { /* sin almacenamiento */ } };

export function totals(entries = []) {
  return entries.reduce((t, e) => ({ kcal: t.kcal + (e.kcal || 0), p: t.p + (e.p || 0), c: t.c + (e.c || 0), f: t.f + (e.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}

function Bar({ label, value, target, color, unit = 'g' }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target && value > target * 1.05;
  return (
    <div className="mbar">
      <div className="row between small"><b>{label}</b><span className={over ? 'over' : 'muted'}>{Math.round(value)}{target ? ` / ${Math.round(target)}` : ''} {unit}</span></div>
      <div className="mbar-track"><div style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} /></div>
    </div>
  );
}

/** Buscador de alimentos + porción */
function AddFood({ meal, onAdd, onClose }) {
  const [tab, setTab] = useState('base');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pick, setPick] = useState(null);
  const [portion, setPortion] = useState(0);
  const [qty, setQty] = useState('1');
  const [grams, setGrams] = useState('');
  const [off, setOff] = useState({ loading: false, list: [], error: '' });
  const [custom, setCustom] = useState({ name: '', kcal: '', p: '', c: '', f: '', label: '1 porción' });

  const recent = useMemo(() => getRecent().map((id) => FOODS.find((f) => f.id === id)).filter(Boolean), []);
  const results = useMemo(() => {
    const nq = norm(q);
    return FOODS.filter((f) => (!cat || f.cat === cat) && (!nq || nq.split(/\s+/).every((w) => norm(f.name).includes(w)))).slice(0, 60);
  }, [q, cat]);

  const searchOff = async () => {
    if (q.trim().length < 3) return setOff({ loading: false, list: [], error: 'Escribe al menos 3 letras.' });
    setOff({ loading: true, list: [], error: '' });
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page_size=24&fields=code,product_name,brands,nutriments,serving_quantity,serving_size`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = (data.products || []).map((p) => {
        const n = p.nutriments || {};
        const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
        if (kcal == null || !p.product_name) return null;
        const portions = [{ label: '100 g', g: 100 }];
        if (Number(p.serving_quantity) > 0) portions.unshift({ label: `1 porción${p.serving_size ? ` (${p.serving_size})` : ''}`, g: Number(p.serving_quantity) });
        return { id: 'off-' + p.code, name: `${p.product_name}${p.brands ? ` · ${p.brands.split(',')[0]}` : ''}`, kcal: r1(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g), portions, source: 'off' };
      }).filter(Boolean);
      setOff({ loading: false, list, error: list.length ? '' : 'No encontramos productos con ese nombre.' });
    } catch {
      setOff({ loading: false, list: [], error: 'No se pudo consultar la base de productos. Revisa tu conexión.' });
    }
  };

  const g = pick ? (grams !== '' ? Number(grams) || 0 : (pick.portions[portion]?.g || 100) * (Number(qty) || 0)) : 0;
  const k = g / 100;
  const preview = pick && { kcal: r1(pick.kcal * k), p: r1(pick.p * k), c: r1(pick.c * k), f: r1(pick.f * k) };

  const confirm = () => {
    if (!pick || !g) return;
    const label = grams !== '' ? `${g} ${pick.ml ? 'ml' : 'g'}` : `${qty} × ${pick.portions[portion]?.label}`;
    onAdd({ meal, name: pick.name, grams: Math.round(g), label, ...preview, foodId: pick.source === 'off' ? null : pick.id, source: pick.source || 'base' });
    if (!pick.source) pushRecent(pick.id);
  };

  const addCustom = () => {
    if (!custom.name.trim() || custom.kcal === '') return;
    onAdd({ meal, name: custom.name.trim().slice(0, 120), grams: 0, label: custom.label || '1 porción', kcal: r1(custom.kcal), p: r1(custom.p), c: r1(custom.c), f: r1(custom.f), foodId: null, source: 'custom' });
  };

  const List = ({ items }) => (
    <div className="food-list">
      {items.map((f) => (
        <button type="button" key={f.id} className="food-item" onClick={() => { setPick(f); setPortion(0); setQty('1'); setGrams(''); }}>
          <span className="grow"><b>{f.name}</b><small>{Math.round(f.kcal)} kcal · P {f.p} · C {f.c} · G {f.f} <i>por 100 {f.ml ? 'ml' : 'g'}</i></small></span>
          <Icon name="plus" size={18} />
        </button>
      ))}
    </div>
  );

  return (
    <Modal wide title={pick ? pick.name : `Agregar a ${LOG_MEALS.find((m) => m.key === meal)?.label}`} onClose={onClose}
      footer={pick ? <><button className="btn ghost" onClick={() => setPick(null)}>Volver</button><button className="btn" disabled={!g} onClick={confirm}><Icon name="check" size={18} /> Agregar</button></> : null}>
      {pick ? (
        <div className="stack">
          <Field label="Porción">
            <div className="checks">{pick.portions.map((p, i) => <button type="button" key={i} className={cx('opt', grams === '' && portion === i && 'on')} onClick={() => { setPortion(i); setGrams(''); }}>{p.label}</button>)}</div>
          </Field>
          <div className="grid g2">
            <Field label="Cantidad de porciones"><input className="input" inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value.replace(',', '.')); setGrams(''); }} /></Field>
            <Field label={`O escribe los ${pick.ml ? 'mililitros' : 'gramos'} exactos`}><input className="input" inputMode="decimal" value={grams} placeholder={String(Math.round(g) || '')} onChange={(e) => setGrams(e.target.value.replace(',', '.'))} /></Field>
          </div>
          <div className="macro-preview">
            <div><b>{Math.round(preview.kcal)}</b><span>kcal</span></div>
            <div><b>{preview.p}</b><span>proteína (g)</span></div>
            <div><b>{preview.c}</b><span>carbohidratos (g)</span></div>
            <div><b>{preview.f}</b><span>grasas (g)</span></div>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>{Math.round(g)} {pick.ml ? 'ml' : 'g'} · Valores aproximados{pick.source === 'off' ? ' tomados de Open Food Facts' : ' (USDA / SMAE)'}.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="tabs">
            <button className={cx('tab', tab === 'base' && 'on')} onClick={() => setTab('base')}>Alimentos</button>
            <button className={cx('tab', tab === 'off' && 'on')} onClick={() => setTab('off')}>Productos empacados</button>
            <button className={cx('tab', tab === 'custom' && 'on')} onClick={() => setTab('custom')}>Personalizado</button>
          </div>
          {tab !== 'custom' && (
            <div style={{ position: 'relative' }}>
              <input className="input" autoFocus placeholder={tab === 'off' ? 'Marca o producto (ej. yogurt griego, barra de proteína)' : 'Busca: pechuga, tortilla, manzana, tacos…'} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tab === 'off' && searchOff()} style={{ paddingLeft: 40 }} />
              <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
            </div>
          )}
          {tab === 'base' && (
            <>
              <div className="tabs">
                <button className={cx('tab', !cat && 'on')} onClick={() => setCat('')}>Todos</button>
                {FOOD_CATEGORIES.map((c) => <button key={c.key} className={cx('tab', cat === c.key && 'on')} onClick={() => setCat(c.key)}>{c.label}</button>)}
              </div>
              {!q && !cat && recent.length > 0 && <><small className="muted">Recientes</small><List items={recent} /></>}
              {(q || cat) && (results.length ? <List items={results} /> : <Empty icon="🔎">No está en la lista. Busca en “Productos empacados” o agrégalo como “Personalizado”.</Empty>)}
              {!q && !cat && !recent.length && <p className="small muted">Escribe el nombre del alimento o elige una categoría.</p>}
            </>
          )}
          {tab === 'off' && (
            <>
              <button className="btn light sm" style={{ alignSelf: 'flex-start' }} onClick={searchOff} disabled={off.loading}>{off.loading ? <Spinner /> : <Icon name="search" size={16} />} Buscar productos</button>
              {off.error && <p className="small muted">{off.error}</p>}
              <List items={off.list} />
              <p className="tiny muted">Datos de Open Food Facts (base pública colaborativa). Revisa la etiqueta si tienes dudas.</p>
            </>
          )}
          {tab === 'custom' && (
            <div className="stack">
              <Field label="Nombre"><input className="input" value={custom.name} maxLength={120} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Ej. Pescado empanizado de la fonda" /></Field>
              <Field label="Porción"><input className="input" value={custom.label} maxLength={60} onChange={(e) => setCustom({ ...custom, label: e.target.value })} /></Field>
              <div className="grid g4">
                {[['kcal', 'Calorías'], ['p', 'Proteína (g)'], ['c', 'Carbohidratos (g)'], ['f', 'Grasas (g)']].map(([kk, l]) => (
                  <Field key={kk} label={l}><input className="input" inputMode="decimal" value={custom[kk]} onChange={(e) => setCustom({ ...custom, [kk]: e.target.value.replace(',', '.') })} /></Field>
                ))}
              </div>
              <button className="btn" disabled={!custom.name.trim() || custom.kcal === ''} onClick={addCustom}><Icon name="plus" size={16} /> Agregar</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function FoodLog({ member, targets, readOnly }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState(null);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    setEntries(null);
    return onSnapshot(doc(db, 'members', member.id, 'foodlog', date),
      (d) => setEntries(d.exists() ? d.data().entries || [] : []),
      () => setEntries([]));
  }, [member.id, date]);

  const save = async (list) => {
    try { await setDoc(doc(db, 'members', member.id, 'foodlog', date), { date, entries: list, updatedAt: serverTimestamp() }); }
    catch (e) { toast(e.code === 'permission-denied' ? 'No se pudo guardar.' : e.message, 'err'); }
  };
  const add = async (e) => {
    if ((entries || []).length >= 80) return toast('Llegaste al máximo de registros del día.', 'err');
    await save([...(entries || []), { ...e, id: crypto.randomUUID().slice(0, 8), at: Date.now() }]);
    setAdding(null);
    toast(`${e.name} agregado`, 'ok');
  };
  const remove = (id) => save(entries.filter((x) => x.id !== id));

  const t = totals(entries || []);
  const tg = targets || {};
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row between">
        <button className="icon-btn" onClick={() => setDate(addDaysISO(date, -1))} aria-label="Día anterior"><Icon name="arrowL" size={18} /></button>
        <div className="center">
          <b className="cap">{date === todayISO() ? 'Hoy' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
          {date !== todayISO() && <button className="btn link xs" onClick={() => setDate(todayISO())}>Ir a hoy</button>}
        </div>
        <button className="icon-btn" disabled={date >= todayISO()} onClick={() => setDate(addDaysISO(date, 1))} aria-label="Día siguiente"><Icon name="arrowR" size={18} /></button>
      </div>

      <div className="card stack">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="stat"><span className="l">Calorías del día</span><span className="v">{Math.round(t.kcal)}{tg.kcal ? <small className="small muted"> / {tg.kcal} kcal</small> : <small className="small muted"> kcal</small>}</span></div>
          {tg.kcal ? <span className={cx('badge plain', t.kcal > tg.kcal * 1.05 ? 'danger' : 'sage')}>{t.kcal > tg.kcal ? `+${Math.round(t.kcal - tg.kcal)}` : `${Math.round(tg.kcal - t.kcal)} restantes`}</span> : null}
        </div>
        <Bar label="Proteína" value={t.p} target={tg.p} color="var(--wine)" />
        <Bar label="Carbohidratos" value={t.c} target={tg.c} color="var(--mocha)" />
        <Bar label="Grasas" value={t.f} target={tg.f} color="var(--sage)" />
        {!tg.kcal && <p className="tiny muted" style={{ margin: 0 }}>Cuando Keila publique tu dieta verás aquí tus metas diarias.</p>}
      </div>

      {entries === null ? <div className="skeleton" style={{ height: 200 }} /> : LOG_MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key);
        const mt = totals(list);
        return (
          <div key={m.key} className="card stack" style={{ gap: 8 }}>
            <div className="row between">
              <div><b>{m.label}</b>{list.length > 0 && <div className="tiny muted">{Math.round(mt.kcal)} kcal · P {r1(mt.p)} · C {r1(mt.c)} · G {r1(mt.f)}</div>}</div>
              {!readOnly && <button className="btn sm light" onClick={() => setAdding(m.key)}><Icon name="plus" size={16} /> Agregar</button>}
            </div>
            {list.map((e) => (
              <div key={e.id} className="log-row">
                <div className="grow"><span>{e.name}</span><small>{e.label} · P {e.p} · C {e.c} · G {e.f}</small></div>
                <b className="nowrap">{Math.round(e.kcal)} kcal</b>
                {!readOnly && <button className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => remove(e.id)} aria-label={`Quitar ${e.name}`}><Icon name="x" size={16} /></button>}
              </div>
            ))}
            {!list.length && <span className="tiny muted">Sin registros.</span>}
          </div>
        );
      })}
      {adding && <AddFood meal={adding} onAdd={add} onClose={() => setAdding(null)} />}
    </div>
  );
}
