// Ajustes del cálculo energético: fórmulas, porcentajes, g/kg por objetivo, METs, tiempos de comida y equivalentes.
import { useState } from 'react';
import { Field, Icon, useToast } from '../../../components/ui';
import { DEFAULT_ENERGY, FORMULAS, GET_METHODS, mergeEnergy } from '../../../lib/energy';
import { uid } from '../../../lib/config';
import { GOALS } from '../../../lib/utils';
import { LinesInput, RowTools, SaveBar, savePart } from './shared';

const numOr = (v, d) => { if (v === '' || v == null) return d; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : d; };

export default function EnergySettings({ adm }) {
  const toast = useToast();
  const [e, setE] = useState(() => mergeEnergy(adm.energy));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const upd = (patch) => { setE((x) => ({ ...x, ...patch })); setDirty(true); };
  const setGoal = (g, k, v) => {
    if (k === 'adj') upd({ goalAdjust: { ...e.goalAdjust, [g]: v } });
    else upd({ macros: { ...e.macros, [g]: { ...e.macros[g], [k]: v } } });
  };

  const save = async () => {
    setBusy(true);
    try {
      const clean = {
        ...e,
        etaPct: numOr(e.etaPct, 10), afPct: numOr(e.afPct, 10), waterMlPerKg: numOr(e.waterMlPerKg, 35),
        minKcalWomen: numOr(e.minKcalWomen, 1200), minKcalMen: numOr(e.minKcalMen, 1500), adjustedWeightBmi: numOr(e.adjustedWeightBmi, 30),
        goalAdjust: Object.fromEntries(Object.entries(e.goalAdjust).map(([k, v]) => [k, numOr(v, 0)])),
        macros: Object.fromEntries(Object.entries(e.macros).map(([k, v]) => [k, { p: numOr(v.p, 1.6), c: numOr(v.c, 3) }])),
        mets: e.mets.filter((m) => String(m.name).trim()).map((m) => ({ name: String(m.name).trim(), met: numOr(m.met, 3) })),
        exchanges: e.exchanges.filter((x) => String(x.group).trim()).map((x) => ({ ...x, kcal: numOr(x.kcal, 0), p: numOr(x.p, 0), f: numOr(x.f, 0), c: numOr(x.c, 0) })),
        meals: (e.meals || []).filter(Boolean).slice(0, 8),
      };
      if (!clean.meals.length) clean.meals = DEFAULT_ENERGY.meals;
      await savePart('admin', { energy: clean });
      setE(clean); setDirty(false); toast('Ajustes del cálculo guardados', 'ok');
    } catch (er) { toast(er.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice small">Estos valores se usan por defecto en la pestaña <b>Cálculo</b> de cada paciente (ahí puedes cambiarlos para un caso en particular). Vienen de tus Excel: Harris-Benedict, ETA 10% y actividad 10%, proteína e hidratos en g/kg y lípidos como lo que resta.</div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Fórmulas</h4>
        <div className="grid g2">
          <Field label="Fórmula del gasto basal"><select className="select" value={e.formula} onChange={(ev) => upd({ formula: ev.target.value })}>{Object.entries(FORMULAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Método del gasto total"><select className="select" value={e.method} onChange={(ev) => upd({ method: ev.target.value })}>{Object.entries(GET_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Efecto térmico de los alimentos (%)"><input className="input" inputMode="decimal" value={e.etaPct} onChange={(ev) => upd({ etaPct: ev.target.value })} /></Field>
          <Field label="Actividad física por defecto (%)"><input className="input" inputMode="decimal" value={e.afPct} onChange={(ev) => upd({ afPct: ev.target.value })} /></Field>
          <Field label="Agua (ml por kg de peso)"><input className="input" inputMode="numeric" value={e.waterMlPerKg} onChange={(ev) => upd({ waterMlPerKg: ev.target.value })} /></Field>
          <Field label="Peso ajustado desde IMC" hint="En obesidad los g/kg se calculan con peso ajustado. 0 = usar siempre el peso real."><input className="input" inputMode="decimal" value={e.adjustedWeightBmi} onChange={(ev) => upd({ adjustedWeightBmi: ev.target.value })} /></Field>
          <Field label="Mínimo de calorías (mujeres)"><input className="input" inputMode="numeric" value={e.minKcalWomen} onChange={(ev) => upd({ minKcalWomen: ev.target.value })} /></Field>
          <Field label="Mínimo de calorías (hombres)"><input className="input" inputMode="numeric" value={e.minKcalMen} onChange={(ev) => upd({ minKcalMen: ev.target.value })} /></Field>
        </div>
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Por objetivo</h4>
        <p className="tiny muted" style={{ margin: 0 }}>Ajuste de calorías sobre el GET (negativo = déficit) y gramos por kg de proteína e hidratos.</p>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 480 }}>
            <thead><tr><th>Objetivo</th><th>Ajuste %</th><th>Proteína g/kg</th><th>Hidratos g/kg</th></tr></thead>
            <tbody>
              {Object.entries(GOALS).map(([g, l]) => (
                <tr key={g}>
                  <td className="small">{l}</td>
                  <td><input className="input sm" style={{ width: 80 }} inputMode="decimal" value={e.goalAdjust[g] ?? 0} onChange={(ev) => setGoal(g, 'adj', ev.target.value)} aria-label={`Ajuste ${l}`} /></td>
                  <td><input className="input sm" style={{ width: 80 }} inputMode="decimal" value={e.macros[g]?.p ?? ''} onChange={(ev) => setGoal(g, 'p', ev.target.value)} aria-label={`Proteína ${l}`} /></td>
                  <td><input className="input sm" style={{ width: 80 }} inputMode="decimal" value={e.macros[g]?.c ?? ''} onChange={(ev) => setGoal(g, 'c', ev.target.value)} aria-label={`Hidratos ${l}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Actividades (METs)</h4>
        {e.mets.map((m, i) => (
          <div key={i} className="row nowrap" style={{ gap: 8 }}>
            <input className="input sm grow" value={m.name} onChange={(ev) => upd({ mets: e.mets.map((x, k) => (k === i ? { ...x, name: ev.target.value } : x)) })} aria-label="Actividad" />
            <input className="input sm" style={{ width: 80 }} inputMode="decimal" value={m.met} onChange={(ev) => upd({ mets: e.mets.map((x, k) => (k === i ? { ...x, met: ev.target.value } : x)) })} aria-label="MET" />
            <RowTools list={e.mets} i={i} onChange={(mets) => upd({ mets })} label="actividad" />
          </div>
        ))}
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ mets: [...e.mets, { name: 'Nueva actividad', met: 4 }] })}>+ Agregar actividad</button>
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Tiempos de comida del cuadro dietosintético</h4>
        <LinesInput rows={5} value={e.meals} onChange={(meals) => upd({ meals })} />
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Cuadro de equivalentes (por equivalente)</h4>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr><th>Grupo</th><th>Subgrupo</th><th>kcal</th><th>Prot</th><th>Líp</th><th>HC</th><th /></tr></thead>
            <tbody>
              {e.exchanges.map((x, i) => {
                const set = (k) => (ev) => upd({ exchanges: e.exchanges.map((y, j) => (j === i ? { ...y, [k]: ev.target.value } : y)) });
                return (
                  <tr key={x.key}>
                    <td><input className="input sm" value={x.group} onChange={set('group')} aria-label="Grupo" /></td>
                    <td><input className="input sm" value={x.sub} onChange={set('sub')} aria-label="Subgrupo" /></td>
                    {['kcal', 'p', 'f', 'c'].map((k) => <td key={k}><input className="input sm" style={{ width: 64 }} inputMode="decimal" value={x[k]} onChange={set(k)} aria-label={k} /></td>)}
                    <td><RowTools list={e.exchanges} i={i} onChange={(exchanges) => upd({ exchanges })} label="grupo" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ exchanges: [...e.exchanges, { key: uid('eq'), group: 'Nuevo grupo', sub: '', kcal: 0, p: 0, f: 0, c: 0 }] })}>+ Agregar grupo</button>
      </div>
      <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { if (window.confirm('¿Regresar todo el cálculo a los valores de tus Excel?')) { setE(mergeEnergy(null)); setDirty(true); } }}><Icon name="x" size={12} /> Restaurar valores originales</button>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}
