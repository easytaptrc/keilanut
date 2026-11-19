import { useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol } from '../../lib/hooks';
import { Badge, Empty, Field, Icon, Modal, useToast } from '../../components/ui';
import { deleteFile, openFile, uploadFile } from '../../lib/files';
import { GOALS, cx, fmtDate } from '../../lib/utils';

export default function AdminTemplates() {
  const toast = useToast();
  const { list } = useCol('templates', () => [orderBy('createdAt', 'desc')], 'templates');
  const [type, setType] = useState('diet');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: '', purpose: '', goal: '', notes: '', file: null });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const save = async () => {
    if (!f.title.trim() || !f.purpose.trim() || !f.file) return toast('Completa título, para qué es y el PDF', 'err');
    setBusy(true);
    try {
      const up = await uploadFile(f.file, { kind: 'template' });
      await addDoc(collection(db, 'templates'), { type, title: f.title.trim(), purpose: f.purpose.trim(), goal: f.goal, notes: f.notes.trim(), fileId: up.id, fileName: up.name, size: up.size, createdAt: serverTimestamp() });
      setAdding(false); setF({ title: '', purpose: '', goal: '', notes: '', file: null });
      toast('Plantilla guardada. La IA ya puede usarla.', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const remove = async (t) => {
    if (!window.confirm(`¿Eliminar la plantilla “${t.title}”?`)) return;
    await deleteDoc(doc(db, 'templates', t.id));
    deleteFile(t.fileId).catch(() => {});
  };

  const shown = list.filter((t) => t.type === type);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Plantillas IA</h1><button className="btn sage sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Subir plantilla</button></div>
      <div className="notice">
        Sube tus dietas y rutinas modelo en PDF y explica <b>para qué es cada una</b> (ej. “Déficit 1400 kcal para mujer con SOP”, “Hipertrofia 5 días intermedio”).
        Al generar un plan, la IA lee el expediente del paciente, elige y adapta tus plantillas a su peso, objetivo, estructura e historial clínico.
      </div>
      <div className="tabs">
        <button className={cx('tab', type === 'diet' && 'on')} onClick={() => setType('diet')}>Dietas ({list.filter((t) => t.type === 'diet').length})</button>
        <button className={cx('tab', type === 'routine' && 'on')} onClick={() => setType('routine')}>Rutinas ({list.filter((t) => t.type === 'routine').length})</button>
      </div>
      {!shown.length ? <Empty icon="📄" title="Sin plantillas">Sube tu primera {type === 'diet' ? 'dieta' : 'rutina'} en PDF.</Empty> : (
        <div className="grid g3 stagger">
          {shown.map((t) => (
            <div key={t.id} className="card stack" style={{ gap: 8 }}>
              <div className="row between nowrap"><span className="avatar" style={{ borderRadius: 12 }}><Icon name="file" /></span>{t.goal && <Badge tone="sage" plain>{GOALS[t.goal]}</Badge>}</div>
              <h4 style={{ margin: 0 }}>{t.title}</h4>
              <p className="small" style={{ margin: 0 }}>{t.purpose}</p>
              {t.notes && <p className="tiny muted" style={{ margin: 0 }}>{t.notes}</p>}
              <div className="tiny muted">{t.fileName} · {Math.round((t.size || 0) / 1024)} KB · {fmtDate(t.createdAt)}</div>
              <div className="row">
                <button className="btn light xs" onClick={() => openFile(t.fileId).catch((e) => toast(e.message, 'err'))}><Icon name="eye" size={14} /> Ver</button>
                <button className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => remove(t)}><Icon name="trash" size={14} /> Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Modal title={`Nueva plantilla de ${type === 'diet' ? 'dieta' : 'rutina'}`} onClose={() => !busy && setAdding(false)}
          footer={<><button className="btn ghost" disabled={busy} onClick={() => setAdding(false)}>Cancelar</button><button className="btn sage" disabled={busy} onClick={save}>{busy ? 'Subiendo…' : 'Guardar'}</button></>}>
          <div className="stack">
            <div className="tabs">
              <button className={cx('tab', type === 'diet' && 'on')} onClick={() => setType('diet')}>Dieta</button>
              <button className={cx('tab', type === 'routine' && 'on')} onClick={() => setType('routine')}>Rutina</button>
            </div>
            <Field label="Nombre de la plantilla" required><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej. Déficit moderado 1500 kcal" /></Field>
            <Field label="¿Para qué es?" required hint="Perfil de paciente, objetivo, condición clínica, nivel…"><textarea className="textarea" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Ej. Mujeres 60–75 kg que quieren bajar grasa, actividad ligera, sin enfermedades." /></Field>
            <Field label="Objetivo principal">
              <select className="select" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}><option value="">—</option>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label="Indicaciones para la IA (opcional)"><textarea className="textarea" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej. Mantén siempre 2 opciones por comida. Usa porciones en tazas." /></Field>
            <Field label="Archivo PDF" required>
              <button type="button" className="btn light" onClick={() => fileRef.current.click()}><Icon name="upload" size={16} /> {f.file ? f.file.name : 'Seleccionar PDF'}</button>
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => setF({ ...f, file: e.target.files?.[0] || null })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
