import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useProgress } from '../lib/hooks';
import { bmi, cx, fmtDate, todayISO } from '../lib/utils';
import { Badge, Empty, Field, Icon, LineChart, Modal, useToast } from './ui';

const METRICS = [
  ['weightKg', 'Peso', 'kg'], ['waistCm', 'Cintura', 'cm'], ['hipCm', 'Cadera', 'cm'], ['bodyFat', 'Grasa corporal', '%'],
];

export default function ProgressPanel({ member, by = 'member' }) {
  const { list, loading } = useProgress(member.id);
  const toast = useToast();
  const [metric, setMetric] = useState('weightKg');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ date: todayISO(), weightKg: '', waistCm: '', hipCm: '', bodyFat: '', muscleKg: '', notes: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const asc = [...list].reverse();
  const unit = METRICS.find((m) => m[0] === metric)[2];
  const data = asc.map((p) => ({ y: p[metric] != null && p[metric] !== '' ? Number(p[metric]) : null, label: fmtDate(p.date), short: fmtDate(p.date, { day: 'numeric', month: 'short' }) }));
  const last = list[0], first = list[list.length - 1];

  const save = async () => {
    if (!f.weightKg && !f.waistCm && !f.hipCm && !f.bodyFat) return toast('Registra al menos una medida', 'err');
    const num = (v) => (v === '' ? null : Number(String(v).replace(',', '.')));
    try {
      await addDoc(collection(db, 'members', member.id, 'progress'), {
        date: f.date, weightKg: num(f.weightKg), waistCm: num(f.waistCm), hipCm: num(f.hipCm), bodyFat: num(f.bodyFat), muscleKg: num(f.muscleKg),
        notes: f.notes.trim(), by, createdAt: serverTimestamp(),
      });
      setAdding(false);
      setF({ date: todayISO(), weightKg: '', waistCm: '', hipCm: '', bodyFat: '', muscleKg: '', notes: '' });
      toast('Progreso guardado', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid g4 stagger">
        {METRICS.map(([k, l, u]) => {
          const v = last?.[k], v0 = first?.[k];
          const d = v != null && v0 != null && last !== first ? Math.round((v - v0) * 10) / 10 : null;
          return (
            <div key={k} className={cx('card click', metric === k && 'soft')} onClick={() => setMetric(k)}>
              <div className="stat"><span className="l">{l}</span><span className="v">{v ?? '—'}<small className="small muted"> {v != null ? u : ''}</small></span></div>
              {d != null && <Badge tone={d <= 0 ? 'ok' : 'warn'} plain>{d > 0 ? '+' : ''}{d} {u} desde el inicio</Badge>}
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title"><h4>Evolución · {METRICS.find((m) => m[0] === metric)[1]}</h4><button className="btn sm sage" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Registrar</button></div>
        {loading ? <div className="skeleton" style={{ height: 200 }} /> : <LineChart data={data} unit={unit} />}
        {last?.weightKg && member.heightCm && <div className="small muted">IMC actual: <b>{bmi(last.weightKg, member.heightCm)}</b>{member.goalWeight ? <> · Meta: <b>{member.goalWeight} kg</b></> : null}</div>}
      </div>
      <div className="card">
        <h4>Historial</h4>
        {!list.length ? <Empty icon="📏">Aún no hay registros. ¡Haz tu primera medición!</Empty> : (
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Cadera</th><th>% Grasa</th><th>Notas</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{fmtDate(p.date)}</td><td>{p.weightKg ?? '—'}</td><td>{p.waistCm ?? '—'}</td><td>{p.hipCm ?? '—'}</td><td>{p.bodyFat ?? '—'}</td>
                    <td className="small">{p.notes}{p.by === 'admin' && <Badge tone="sage" plain>Keila</Badge>}</td>
                    <td>{(by === 'admin' || p.by === 'member') && <button className="btn link xs" onClick={() => window.confirm('¿Eliminar registro?') && deleteDoc(doc(db, 'members', member.id, 'progress', p.id))}><Icon name="trash" size={16} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && (
        <Modal title="Registrar progreso" onClose={() => setAdding(false)} footer={<><button className="btn ghost" onClick={() => setAdding(false)}>Cancelar</button><button className="btn sage" onClick={save}>Guardar</button></>}>
          <div className="grid g2">
            <Field label="Fecha"><input className="input" type="date" max={todayISO()} value={f.date} onChange={set('date')} /></Field>
            <Field label="Peso (kg)"><input className="input" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} /></Field>
            <Field label="Cintura (cm)"><input className="input" inputMode="decimal" value={f.waistCm} onChange={set('waistCm')} /></Field>
            <Field label="Cadera (cm)"><input className="input" inputMode="decimal" value={f.hipCm} onChange={set('hipCm')} /></Field>
            <Field label="% Grasa corporal"><input className="input" inputMode="decimal" value={f.bodyFat} onChange={set('bodyFat')} /></Field>
            <Field label="Masa muscular (kg)"><input className="input" inputMode="decimal" value={f.muscleKg} onChange={set('muscleKg')} /></Field>
          </div>
          <Field label="Notas" className="mt"><textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="¿Cómo te sentiste esta semana?" /></Field>
        </Modal>
      )}
    </div>
  );
}
