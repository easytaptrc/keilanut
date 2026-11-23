import { useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCol, useDoc, useProgress } from '../../lib/hooks';
import { DietEditor, RoutineEditor } from '../../components/Editors';
import { DietView, RoutineView } from '../../components/PlanViews';
import { Badge, Empty, Field, Icon, Modal, Spinner, useToast } from '../../components/ui';
import { energy } from '../../lib/nutrition';
import { draftDiet, draftRoutine, emptyDiet, emptyRoutine, normalizeDiet, normalizeRoutine } from '../../lib/plans';
import { useContact } from '../Home';

import { notifyMember } from '../../lib/admin';
import { deleteFile, uploadFile } from '../../lib/files';
const pdfLib = () => import('../../lib/pdf');
import { cx, fmtDateTime } from '../../lib/utils';

export default function PlanTab({ member, kind }) {
  const toast = useToast();
  const isDiet = kind === 'diet';
  const label = isDiet ? 'dieta' : 'rutina';
  const pub = useDoc(`members/${member.id}/plans/${kind}`);
  const draft = useDoc(`members/${member.id}/drafts/${kind}`);
  const settings = useDoc('settings/admin').data;
  const templates = useCol('templates', () => [where('type', '==', kind)], 'tpl' + kind).list;
  const progress = useProgress(member.id).list;
  const clinical = useDoc(`members/${member.id}/clinical/history`).data;
  const contact = useContact();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [value, setValue] = useState(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('edit');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null); // estado del modal IA
  const fileRef = useRef();

  // Carga inicial: borrador > publicado > vacío
  useEffect(() => {
    if (value || pub.loading || draft.loading) return;
    const src = draft.data || pub.data;
    setValue(src?.data ? (isDiet ? normalizeDiet(src.data) : normalizeRoutine(src.data)) : (isDiet ? emptyDiet() : emptyRoutine()));
    setFile(src?.file || null);
  }, [pub.loading, draft.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (v) => { setValue(v); setDirty(true); };

  const saveDraft = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'members', member.id, 'drafts', kind), { data: value, file, updatedAt: serverTimestamp() });
      setDirty(false); toast('Borrador guardado', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const publish = async () => {
    if (isDiet && !value.days?.length) return toast('Agrega al menos un día a la dieta antes de publicar.', 'err');
    if (!isDiet && !value.days?.length) return toast('Agrega al menos un día a la rutina antes de publicar.', 'err');
    if (!window.confirm(`¿Publicar esta ${label}? ${member.firstName} la verá en su app y recibirá una notificación.`)) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'members', member.id, 'plans', kind), { data: value, file, updatedAt: serverTimestamp() });
      await setDoc(doc(db, 'members', member.id, 'drafts', kind), { data: value, file, updatedAt: serverTimestamp() });
      await notifyMember(member.id, { title: isDiet ? 'Tu dieta está lista 🥗' : 'Tu rutina está lista 💪', body: `Keila ${pub.data ? 'actualizó' : 'publicó'} tu ${label}. Ábrela en la app.`, type: 'plan' });
      setDirty(false); toast(`${isDiet ? 'Dieta' : 'Rutina'} publicada y notificada`, 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const onPdf = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return toast('Selecciona un archivo PDF', 'err');
    setBusy(true);
    try {
      const up = await uploadFile(f, { kind: 'plan', ownerMemberId: member.id });
      if (file?.id) deleteFile(file.id).catch(() => {});
      setFile(up); setDirty(true); toast('PDF adjuntado. Guarda o publica para aplicarlo.', 'ok');
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };

  const auto = () => {
    if (dirty && !window.confirm('Esto reemplazará el contenido actual del editor. ¿Continuar?')) return;
    change(isDiet ? draftDiet({ ...member, clinical }) : draftRoutine(member));
    toast('Borrador automático generado. Revísalo antes de publicar.', 'ok');
  };

  const runAI = async () => {
    setAi((x) => ({ ...x, running: true, status: 'Preparando…', error: '' }));
    try {
      const chosen = templates.filter((t) => ai.selected.includes(t.id));
      const { generateWithAI } = await import('../../lib/ai');
      const result = await generateWithAI({
        kind, profile: member, progress, clinical, templates: chosen, instructions: ai.instructions,
        apiKey: settings?.anthropicKey, model: settings?.model, onStatus: (s) => setAi((x) => ({ ...x, status: s })),
      });
      const { rationale, ...plan } = result;
      change(plan);
      setMode('edit');
      setAi(null);
      toast({ title: 'Borrador de IA listo', body: rationale || 'Revísalo y ajústalo antes de publicar.', duration: 9000 }, 'ok');
    } catch (e) {
      setAi((x) => ({ ...x, running: false, error: e.message }));
    }
  };

  if (!value) return <div className="skeleton" style={{ height: 300 }} />;
  const e = energy(member);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card ai-glow">
        <div className="row between">
          <div>
            <h4 style={{ margin: 0 }}>{isDiet ? 'Plan de alimentación' : 'Rutina de entrenamiento'}</h4>
            <div className="tiny muted">
              {pub.data ? <>Publicada {fmtDateTime(pub.data.updatedAt)}</> : 'Aún no publicada'}
              {draft.data && <> · Borrador {fmtDateTime(draft.data.updatedAt)}</>}
              {dirty && <> · <b style={{ color: 'var(--warn)' }}>Cambios sin guardar</b></>}
            </div>
          </div>
          <div className="row">
            <button className="btn light sm" onClick={auto}><Icon name="leaf" size={16} /> Borrador automático</button>
            <button className="btn sage sm" onClick={() => setAi({ selected: templates.slice(0, 3).map((t) => t.id), instructions: '', running: false })}><Icon name="sparkle" size={16} /> Generar con IA</button>
          </div>
        </div>
        {isDiet && e && <div className="small muted mt">Referencia: GET {e.tdee} kcal · sugerido {e.kcal} kcal · P {e.protein} g · C {e.carbs} g · G {e.fat} g · agua {e.water} L</div>}
      </div>

      <div className="row between">
        <div className="tabs">
          <button className={cx('tab', mode === 'edit' && 'on')} onClick={() => setMode('edit')}><Icon name="edit" size={14} /> Editar</button>
          <button className={cx('tab', mode === 'preview' && 'on')} onClick={() => setMode('preview')}><Icon name="eye" size={14} /> Vista del paciente</button>
        </div>
        <div className="row">
          <button className="btn light sm" disabled={busy} onClick={() => fileRef.current.click()}><Icon name="upload" size={16} /> {file ? 'Cambiar PDF' : 'Adjuntar PDF'}</button>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onPdf} />
          <button className="btn light sm" disabled={pdfBusy} onClick={() => { setPdfBusy(true); pdfLib().then((m) => (isDiet ? m.dietPdf(value, member, { contact }) : m.routinePdf(value, member, { contact }))).catch((er) => toast(er.message, 'err')).finally(() => setPdfBusy(false)); }}>{pdfBusy ? <Spinner /> : <Icon name="download" size={16} />} PDF con mi diseño</button>
        </div>
      </div>
      {file && (
        <div className="notice row between small">
          <span>📎 PDF adjunto: <b>{file.name}</b> (el paciente podrá verlo y descargarlo)</span>
          <button className="btn link xs" onClick={() => { setFile(null); setDirty(true); }}>Quitar</button>
        </div>
      )}

      <div className="card">
        {mode === 'edit'
          ? (isDiet ? <DietEditor value={value} onChange={change} /> : <RoutineEditor value={value} onChange={change} />)
          : (isDiet ? <DietView diet={{ ...value, file }} /> : <RoutineView routine={{ ...value, file }} />)}
      </div>

      <div className="row end" style={{ position: 'sticky', bottom: 'calc(80px + var(--safe-b))', zIndex: 5 }}>
        <button className="btn light" disabled={busy} onClick={saveDraft}>Guardar borrador</button>
        <button className="btn sage" disabled={busy} onClick={publish}><Icon name="check" size={18} /> Publicar al paciente</button>
      </div>

      {ai && (
        <Modal title={<span className="row nowrap"><Icon name="sparkle" /> Generar {label} con IA</span>} onClose={() => !ai.running && setAi(null)}
          footer={<><button className="btn ghost" disabled={ai.running} onClick={() => setAi(null)}>Cancelar</button><button className="btn sage" disabled={ai.running} onClick={runAI}>{ai.running ? <><Spinner /> {ai.status}</> : 'Generar borrador'}</button></>}>
          <div className="stack">
            {!settings?.anthropicKey && <div className="error">Primero agrega tu llave de API de Claude en <b>Ajustes</b>.</div>}
            <p className="small muted" style={{ margin: 0 }}>La IA leerá el expediente completo de {member.firstName} (peso, estatura, historial clínico, alergias, objetivo, horarios y progreso) y las plantillas que elijas, y armará un borrador con tu estilo. Tú lo revisas antes de publicar.</p>
            <Field label={`Plantillas de ${label} a usar como base`}>
              {!templates.length ? <div className="notice small">Aún no tienes plantillas de {label}. Súbelas en <b>Plantillas IA</b> (PDF + para qué sirve). Sin plantillas, la IA usará criterios generales.</div> : (
                <div className="stack" style={{ gap: 8 }}>
                  {templates.map((t) => (
                    <label key={t.id} className="row nowrap card flat" style={{ padding: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={ai.selected.includes(t.id)} style={{ width: 18, height: 18, accentColor: '#6e2236' }}
                        onChange={(ev) => setAi((x) => ({ ...x, selected: ev.target.checked ? [...x.selected, t.id] : x.selected.filter((y) => y !== t.id) }))} />
                      <div className="grow"><b className="small">{t.title}</b><div className="tiny muted">{t.purpose}</div></div>
                      <Badge plain>{Math.round((t.size || 0) / 1024)} KB</Badge>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Indicaciones adicionales (opcional)">
              <textarea className="textarea" value={ai.instructions} onChange={(ev) => setAi((x) => ({ ...x, instructions: ev.target.value }))}
                placeholder={isDiet ? 'Ej. 1500 kcal, sin lácteos, desayuno rápido para llevar, 2 opciones por comida…' : 'Ej. 4 días, enfoque glúteo, rodilla lastimada, entrena en casa con mancuernas…'} />
            </Field>
            {ai.error && <div className="error">{ai.error}</div>}
          </div>
        </Modal>
      )}
      {!pub.data && !draft.data && !dirty && <Empty icon={isDiet ? '🥗' : '🏋️'}>Empieza con el borrador automático, con la IA o captura el plan manualmente.</Empty>}
    </div>
  );
}
