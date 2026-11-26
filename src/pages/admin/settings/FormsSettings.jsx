// Preguntas de la reservación y del historial clínico, y medidas de la báscula.
import { useState } from 'react';
import { Field, Icon, useToast } from '../../../components/ui';
import { BOOKING_FIELD_TYPES, CLINICAL_FIELD_TYPES, DEFAULT_BOOKING_FORM, mergeBookingForm, mergeClinicalForm, uid } from '../../../lib/config';
import { BODY_FIELDS, CLINICAL_SECTIONS } from '../../../data/clinical';
import { cx } from '../../../lib/utils';
import FormBuilder from './FormBuilder';
import { RowTools, SaveBar, Toggle, savePart } from './shared';

const clean = (sections) => sections.map((s) => ({
  ...s, title: String(s.title || '').trim() || 'Sección',
  fields: s.fields.filter((q) => q.builtin || String(q.label || '').trim()).map((q) => ({ ...q, label: String(q.label || '').trim() || q.key, ...(q.options ? { options: q.options.filter((o) => String(typeof o === 'string' ? o : o.label).trim()) } : {}) })),
}));

export function BookingFormSettings({ pub }) {
  const toast = useToast();
  const [form, setForm] = useState(() => mergeBookingForm(pub.bookingForm));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const bad = form.sections.flatMap((s) => s.fields).find((q) => ['choice', 'multi'].includes(q.type) && (q.options || []).filter((o) => String(typeof o === 'string' ? o : o.label).trim()).length < 2);
    if (bad) return toast(`La pregunta “${bad.label}” necesita al menos 2 opciones.`, 'err');
    setBusy(true);
    try { await savePart('public', { bookingForm: { ...form, sections: clean(form.sections) } }); setDirty(false); toast('Formulario de reservación guardado', 'ok'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="notice small">
        Así se ve el registro que llenan los pacientes al reservar. Puedes cambiar el texto de cada pregunta, apagarla, hacerla obligatoria, ordenarla o agregar preguntas y secciones nuevas.
        Las respuestas a tus preguntas nuevas aparecen en la reservación y en el expediente, y la IA también las lee. <a href="/reservar" target="_blank" rel="noreferrer">Ver el formulario →</a>
      </div>
      <Field label="Título del primer paso (servicio, día y hora)"><input className="input" value={form.scheduleTitle || ''} onChange={(e) => { setForm({ ...form, scheduleTitle: e.target.value }); setDirty(true); }} /></Field>
      <FormBuilder mode="booking" types={BOOKING_FIELD_TYPES} sections={form.sections} onChange={(sections) => { setForm({ ...form, sections }); setDirty(true); }} />
      <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { if (window.confirm('¿Regresar el formulario de reservación a las preguntas originales? Se borrarán tus preguntas nuevas.')) { setForm(JSON.parse(JSON.stringify(DEFAULT_BOOKING_FORM))); setDirty(true); } }}>Restaurar formulario original</button>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

export function ClinicalFormSettings({ adm }) {
  const toast = useToast();
  const [form, setForm] = useState(() => mergeClinicalForm(adm.clinicalForm));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const setBody = (bodyFields) => { setForm((f) => ({ ...f, bodyFields })); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try {
      await savePart('admin', { clinicalForm: { sections: clean(form.sections), bodyFields: form.bodyFields.filter((b) => String(b.label || '').trim()) } });
      setDirty(false); toast('Historial clínico guardado', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice small">
        Estas son las preguntas de la <b>Consulta</b> (Team → paciente → Consulta). Nada es obligatorio. Si apagas o borras una pregunta, las respuestas que ya existan se conservan en el expediente.
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Báscula y medidas</h4>
        <p className="small muted" style={{ margin: 0 }}>Campos numéricos del paso 2 (el IMC se calcula solo con peso y estatura).</p>
        <div className="stack" style={{ gap: 6 }}>
          {form.bodyFields.map((b, i) => (
            <div key={b.key} className={cx('row nowrap', b.enabled === false && 'muted')} style={{ gap: 8 }}>
              <Toggle small checked={b.enabled !== false} disabled={['weightKg', 'heightCm'].includes(b.key)} onChange={(v) => setBody(form.bodyFields.map((x, k) => (k === i ? { ...x, enabled: v } : x)))} />
              <input className="input sm grow" value={b.label} onChange={(e) => setBody(form.bodyFields.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} aria-label="Nombre de la medida" />
              <input className="input sm" style={{ width: 70 }} value={b.unit || ''} placeholder="Unidad" onChange={(e) => setBody(form.bodyFields.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))} aria-label="Unidad" />
              <RowTools list={form.bodyFields} i={i} onChange={setBody} canDelete={!b.builtin} label="medida" />
            </div>
          ))}
        </div>
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => setBody([...form.bodyFields, { key: uid('m'), label: 'Nueva medida', unit: 'cm', enabled: true }])}>+ Agregar medida</button>
      </div>
      <h4 style={{ margin: '4px 0 0' }}>Secciones del historial clínico</h4>
      <FormBuilder mode="clinical" types={CLINICAL_FIELD_TYPES} sections={form.sections} onChange={(sections) => { setForm((f) => ({ ...f, sections })); setDirty(true); }} />
      <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => {
        if (!window.confirm('¿Regresar el historial clínico y las medidas a las preguntas originales? Se borrarán tus preguntas nuevas (las respuestas guardadas no se pierden).')) return;
        setForm(mergeClinicalForm(null)); setDirty(true);
      }}><Icon name="x" size={12} /> Restaurar historial original ({CLINICAL_SECTIONS.length} secciones, {BODY_FIELDS.length} medidas)</button>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}
